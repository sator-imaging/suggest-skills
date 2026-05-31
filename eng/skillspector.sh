#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# eng/skillspector.sh
#
# Parses ALL.md manifests for skill URLs, then runs NVIDIA SkillSpector
# (https://github.com/NVIDIA/skillspector) against each.
#
# Outputs:
#   - SARIF report  (for GitHub Security tab)
#   - Markdown report (for GitHub Actions step summary)
#
# Usage:
#   ./eng/skillspector.sh [--sarif <path>] [--markdown <path>] [--no-llm]
#
# Environment:
#   SKILLSPECTOR_BIN    - Path to existing skillspector binary (skips install)
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

# --- Install skillspector ---
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

  echo "[INFO] Installing skillspector..."
  python3 -m venv "$install_dir/.venv"
  source "$install_dir/.venv/bin/activate"
  make -C "$install_dir" install

  SKILLSPECTOR_BIN="skillspector"
}

# --- Extract skill URLs from ALL.md ---
extract_urls() {
  for manifest in $MANIFEST_FILES; do
    local filepath="$REPO_ROOT/$manifest"
    if [[ ! -f "$filepath" ]]; then
      echo "[WARN] Manifest not found: $filepath" >&2
      continue
    fi
    grep -oP '\(https://github\.com/[^)]+\)' "$filepath" | tr -d '()'
  done | sort -u
}

# --- Main ---
main() {
  echo "[INFO] Extracting skill URLs from manifests..."
  local urls
  urls=$(extract_urls)
  local total
  total=$(echo "$urls" | grep -c . || echo 0)
  echo "[INFO] Found $total unique skill URLs"

  if [[ "$total" -eq 0 ]]; then
    echo "[WARN] No skill URLs found."
    exit 0
  fi

  setup_skillspector

  local failed=0
  local scanned=0

  : > "$SARIF_OUTPUT"
  {
    echo "## SkillSpector Scan Results"
    echo ""
    echo "| # | Skill URL | Status |"
    echo "|---|-----------|--------|"
  } > "$MARKDOWN_OUTPUT"

  echo "[INFO] Scanning $total skills..."

  while IFS= read -r url; do
    [[ -n "$url" ]] || continue
    ((scanned++))

    echo "::group::[$scanned/$total] $url"

    # Markdown scan
    local md_result
    if md_result=$($SKILLSPECTOR_BIN scan "$url" --format markdown $NO_LLM 2>/dev/null); then
      echo "| $scanned | \`$url\` | OK |" >> "$MARKDOWN_OUTPUT"
      {
        echo ""
        echo "<details><summary><code>$url</code></summary>"
        echo ""
        echo "$md_result"
        echo ""
        echo "</details>"
      } >> "$MARKDOWN_OUTPUT"
    else
      ((failed++))
      echo "| $scanned | \`$url\` | FAILED |" >> "$MARKDOWN_OUTPUT"
      echo "[WARN] Scan failed: $url" >&2
    fi

    # SARIF scan (append per-URL)
    $SKILLSPECTOR_BIN scan "$url" --format sarif $NO_LLM \
      --output "$REPO_ROOT/.skillspector-tmp-$scanned.sarif" 2>/dev/null || true

    echo "::endgroup::"
  done <<< "$urls"

  # Merge SARIF files into one
  merge_sarif

  # Footer
  {
    echo ""
    echo "---"
    echo "**Scanned: $scanned | Failed: $failed**"
  } >> "$MARKDOWN_OUTPUT"

  echo "[INFO] Done. Scanned: $scanned, Failed: $failed"
  echo "[INFO] SARIF:    $SARIF_OUTPUT"
  echo "[INFO] Markdown: $MARKDOWN_OUTPUT"
}

merge_sarif() {
  # Merge individual SARIF files into a single valid SARIF document
  python3 - "$SARIF_OUTPUT" "$REPO_ROOT"/.skillspector-tmp-*.sarif 2>/dev/null <<'PYTHON' || true
import json, sys, glob

output_path = sys.argv[1]
input_files = sys.argv[2:]

all_results = []
for path in sorted(input_files):
    try:
        with open(path) as f:
            sarif = json.load(f)
        for run in sarif.get("runs", []):
            all_results.extend(run.get("results", []))
    except (json.JSONDecodeError, FileNotFoundError):
        pass

merged = {
    "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    "version": "2.1.0",
    "runs": [{
        "tool": {
            "driver": {
                "name": "SkillSpector",
                "informationUri": "https://github.com/NVIDIA/skillspector",
                "rules": []
            }
        },
        "results": all_results
    }]
}

with open(output_path, "w") as f:
    json.dump(merged, f, indent=2)

print(f"[INFO] Merged {len(all_results)} SARIF results from {len(input_files)} files")
PYTHON

  # Cleanup temp files
  rm -f "$REPO_ROOT"/.skillspector-tmp-*.sarif
}

main
