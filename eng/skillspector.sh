#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# eng/skillspector.sh
#
# Parses ALL.md manifests for skill URLs, deduplicates to repository level,
# then runs NVIDIA SkillSpector (https://github.com/NVIDIA/skillspector)
# against each repository.
#
# Usage:
#   ./eng/skillspector.sh [--sarif <path>] [--markdown <path>] [--no-llm]
#
# Environment:
#   SKILLSPECTOR_BIN    - Path to existing skillspector command (skips install)
#   MANIFEST_FILES      - Space-separated ALL.md paths to parse
#                         (default: official/skills/ALL.md community/skills/ALL.md)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MANIFEST_FILES="${MANIFEST_FILES:-official/skills/ALL.md community/skills/ALL.md}"
SKILLSPECTOR_BIN="${SKILLSPECTOR_BIN:-}"

SARIF_OUTPUT=""
MARKDOWN_OUTPUT=""
NO_LLM=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sarif)    SARIF_OUTPUT="$2"; shift 2 ;;
    --markdown) MARKDOWN_OUTPUT="$2"; shift 2 ;;
    --no-llm)   NO_LLM="--no-llm"; shift ;;
    --help|-h)
      echo "Usage: $0 [--sarif <path>] [--markdown <path>] [--no-llm]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

SARIF_OUTPUT="${SARIF_OUTPUT:-$REPO_ROOT/skillspector.sarif}"
MARKDOWN_OUTPUT="${MARKDOWN_OUTPUT:-$REPO_ROOT/skillspector-report.md}"

# --- Install skillspector (per upstream README) ---
setup_skillspector() {
  if [[ -n "$SKILLSPECTOR_BIN" ]]; then
    if ! command -v "$SKILLSPECTOR_BIN" &>/dev/null && [[ ! -x "$SKILLSPECTOR_BIN" ]]; then
      echo "[ERROR] SKILLSPECTOR_BIN not found: $SKILLSPECTOR_BIN" >&2
      exit 1
    fi
    return
  fi

  local install_dir="$REPO_ROOT/.skillspector"

  if [[ ! -d "$install_dir/.git" ]]; then
    echo "[INFO] Cloning NVIDIA/skillspector..."
    rm -rf "$install_dir"
    git clone --depth=1 https://github.com/NVIDIA/skillspector.git "$install_dir"
  fi

  echo "[INFO] Installing skillspector (make install)..."
  make -C "$install_dir" install

  # Activate venv so skillspector is on PATH
  source "$install_dir/.venv/bin/activate"
  SKILLSPECTOR_BIN="skillspector"
}

# --- Extract unique repository URLs from ALL.md ---
extract_repo_urls() {
  for manifest in $MANIFEST_FILES; do
    local filepath="$REPO_ROOT/$manifest"
    if [[ ! -f "$filepath" ]]; then
      echo "[WARN] Manifest not found: $filepath" >&2
      continue
    fi
    grep -ohP '\(https://github\.com/[^)]+\)' "$filepath" | tr -d '()'
  done \
    | sed -E 's|^https://github\.com/([^/]+/[^/]+).*|https://github.com/\1|' \
    | sort -u
}

# --- Merge individual SARIF files into one ---
merge_sarif() {
  local output="$1"
  shift
  python3 - "$output" "$@" <<'PYTHON'
import json, sys, os

output_path = sys.argv[1]
input_patterns = sys.argv[2:]

all_results = []
all_rules = []
rule_ids_seen = set()

for path in input_patterns:
    if not os.path.isfile(path):
        continue
    try:
        with open(path) as f:
            sarif = json.load(f)
        for run in sarif.get("runs", []):
            all_results.extend(run.get("results", []))
            for rule in run.get("tool", {}).get("driver", {}).get("rules", []):
                if rule.get("id") not in rule_ids_seen:
                    rule_ids_seen.add(rule["id"])
                    all_rules.append(rule)
    except (json.JSONDecodeError, FileNotFoundError, KeyError):
        pass

merged = {
    "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    "version": "2.1.0",
    "runs": [{
        "tool": {
            "driver": {
                "name": "SkillSpector",
                "informationUri": "https://github.com/NVIDIA/skillspector",
                "rules": all_rules
            }
        },
        "results": all_results
    }]
}

with open(output_path, "w") as f:
    json.dump(merged, f, indent=2)

print(f"[INFO] Merged {len(all_results)} results, {len(all_rules)} rules from {len(input_patterns)} files")
PYTHON
}

# --- Main ---
main() {
  echo "[INFO] Extracting repository URLs from manifests..."
  local repo_urls
  repo_urls=$(extract_repo_urls)
  local total
  total=$(echo "$repo_urls" | grep -c . || echo 0)
  echo "[INFO] Found $total unique repositories to scan"

  if [[ "$total" -eq 0 ]]; then
    echo "[WARN] No repositories found."
    exit 0
  fi

  setup_skillspector

  local failed=0
  local scanned=0
  local score severity status md_result sarif_file
  local tmpdir="$REPO_ROOT/.skillspector-tmp"
  rm -rf "$tmpdir"
  mkdir -p "$tmpdir"

  {
    echo "## SkillSpector Scan Results"
    echo ""
    echo "| # | Repository | Score | Severity | Status |"
    echo "|---|-----------|-------|----------|--------|"
  } > "$MARKDOWN_OUTPUT"

  echo "[INFO] Scanning $total repositories..."

  while IFS= read -r url; do
    [[ -n "$url" ]] || continue
    scanned=$((scanned + 1))

    echo "::group::[$scanned/$total] $url"

    sarif_file="$tmpdir/$scanned.sarif"
    md_result=""
    status="OK"
    score="-"
    severity="-"

    # Run scan with markdown output
    # Note: skillspector exits non-zero when findings exist, so we capture regardless
    md_result=$($SKILLSPECTOR_BIN scan "$url" --format markdown $NO_LLM 2>/dev/null) || true

    if [[ -n "$md_result" ]]; then
      score=$(echo "$md_result" | grep -oP 'Score \| \K[0-9]+/100' | head -1) || score="-"
      severity=$(echo "$md_result" | grep -oP 'Severity \| \K\w+' | head -1) || severity="-"
    else
      status="FAILED"
      failed=$((failed + 1))
      echo "[WARN] Scan failed: $url" >&2
    fi

    echo "| $scanned | $url | $score | $severity | $status |" >> "$MARKDOWN_OUTPUT"

    # Append markdown details
    if [[ -n "$md_result" ]]; then
      {
        echo ""
        echo "<details><summary><code>$url</code> — $severity ($score)</summary>"
        echo ""
        echo "$md_result"
        echo ""
        echo "</details>"
      } >> "$MARKDOWN_OUTPUT"
    fi

    # Run scan with SARIF output
    $SKILLSPECTOR_BIN scan "$url" --format sarif $NO_LLM \
      --output "$sarif_file" 2>/dev/null || true

    echo "::endgroup::"
  done <<< "$repo_urls"

  # Merge all SARIF files
  merge_sarif "$SARIF_OUTPUT" "$tmpdir"/*.sarif
  rm -rf "$tmpdir"

  # Summary footer
  {
    echo ""
    echo "---"
    echo "**Repositories scanned: $scanned | Failed: $failed**"
  } >> "$MARKDOWN_OUTPUT"

  echo ""
  echo "[INFO] Done. Scanned: $scanned, Failed: $failed"
  echo "[INFO] SARIF:    $SARIF_OUTPUT"
  echo "[INFO] Markdown: $MARKDOWN_OUTPUT"
}

main
