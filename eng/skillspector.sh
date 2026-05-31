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
#                         [--timeout <seconds>] [--jobs <n>]
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
SCAN_TIMEOUT=120  # Per-scan timeout in seconds (default: 2 minutes)
MAX_JOBS=4        # Number of concurrent scans

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sarif)    SARIF_OUTPUT="$2"; shift 2 ;;
    --markdown) MARKDOWN_OUTPUT="$2"; shift 2 ;;
    --no-llm)   NO_LLM="--no-llm"; shift ;;
    --timeout)  SCAN_TIMEOUT="$2"; shift 2 ;;
    --jobs)     MAX_JOBS="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--sarif <path>] [--markdown <path>] [--no-llm] [--timeout <seconds>] [--jobs <n>]"
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

# --- Scan a single repository (called in parallel) ---
# Arguments: <index> <total> <url> <tmpdir>
# Uses exported: SKILLSPECTOR_BIN, NO_LLM, SCAN_TIMEOUT
scan_repo() {
  local idx="$1" total="$2" url="$3" tmpdir="$4"

  local sarif_file="$tmpdir/$idx.sarif"
  local md_file="$tmpdir/$idx.md"
  local status_file="$tmpdir/$idx.status"
  local md_result=""
  local status="OK"
  local score="-"
  local severity="-"

  echo "[$idx/$total] $url"

  # Run scan with markdown output (with timeout)
  local exit_code=0
  md_result=$(timeout "${SCAN_TIMEOUT}s" $SKILLSPECTOR_BIN scan "$url" --format markdown $NO_LLM 2>/dev/null) \
    || exit_code=$?

  if [[ $exit_code -eq 124 ]]; then
    status="TIMEOUT"
    echo "  [WARN] Timed out after ${SCAN_TIMEOUT}s: $url" >&2
  elif [[ -n "$md_result" ]]; then
    score=$(echo "$md_result" | grep -oP 'Score \| \K[0-9]+/100' | head -1) || score="-"
    severity=$(echo "$md_result" | grep -oP 'Severity \| \K\w+' | head -1) || severity="-"
  else
    status="FAILED"
    echo "  [WARN] Scan failed: $url" >&2
  fi

  # Save per-repo results to files for later assembly
  echo "$status" > "$status_file"

  {
    echo "| $idx | $url | $score | $severity | $status |"
  } > "$md_file.row"

  if [[ -n "$md_result" ]]; then
    {
      echo ""
      echo "<details><summary><code>$url</code> — $severity ($score)</summary>"
      echo ""
      echo "$md_result"
      echo ""
      echo "</details>"
    } > "$md_file"
  fi

  # Run scan with SARIF output (with timeout)
  if [[ "$status" != "TIMEOUT" ]]; then
    timeout "${SCAN_TIMEOUT}s" $SKILLSPECTOR_BIN scan "$url" --format sarif $NO_LLM \
      --output "$sarif_file" 2>/dev/null || true
  fi

  echo "  Report saved to: "
  echo "  $sarif_file"
}
export -f scan_repo

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

  local tmpdir="$REPO_ROOT/.skillspector-tmp"
  rm -rf "$tmpdir"
  mkdir -p "$tmpdir"

  echo "[INFO] Scanning $total repositories (concurrency: $MAX_JOBS, timeout: ${SCAN_TIMEOUT}s per scan)..."

  # Export variables needed by scan_repo
  export SKILLSPECTOR_BIN NO_LLM SCAN_TIMEOUT

  # Run scans in parallel using xargs
  local idx=0
  echo "$repo_urls" | while IFS= read -r url; do
    [[ -n "$url" ]] || continue
    idx=$((idx + 1))
    echo "$idx $total $url $tmpdir"
  done | xargs -P "$MAX_JOBS" -L 1 bash -c 'scan_repo "$@"' _

  # Assemble markdown report in order
  {
    echo "## SkillSpector Scan Results"
    echo ""
    echo "| # | Repository | Score | Severity | Status |"
    echo "|---|-----------|-------|----------|--------|"
  } > "$MARKDOWN_OUTPUT"

  local failed=0
  local scanned=0
  for i in $(seq 1 "$total"); do
    if [[ -f "$tmpdir/$i.status" ]]; then
      scanned=$((scanned + 1))
      local st
      st=$(cat "$tmpdir/$i.status")
      if [[ "$st" == "FAILED" || "$st" == "TIMEOUT" ]]; then
        failed=$((failed + 1))
      fi
    fi
    if [[ -f "$tmpdir/$i.md.row" ]]; then
      cat "$tmpdir/$i.md.row" >> "$MARKDOWN_OUTPUT"
    fi
    if [[ -f "$tmpdir/$i.md" ]]; then
      cat "$tmpdir/$i.md" >> "$MARKDOWN_OUTPUT"
    fi
  done

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
