#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# eng/skillspector.sh
#
# Parses official/skills/ALL.md and community/skills/ALL.md for skill URLs,
# then runs NVIDIA SkillSpector against each URL.
#
# Outputs:
#   - SARIF report (for GitHub Security tab)
#   - Markdown report (for GitHub Actions step summary)
#
# Usage:
#   ./eng/skillspector.sh [--sarif <path>] [--markdown <path>]
#
# Environment:
#   SKILLSPECTOR_REPO   - Override skillspector repo (default: https://github.com/nvidia/skillspector.git)
#   SKILLSPECTOR_REF    - Override branch/tag (default: main)
#   SKILLSPECTOR_BIN    - Path to existing skillspector binary (skips clone/build)
#   MANIFEST_FILES      - Space-separated list of ALL.md files to parse
#                         (default: official/skills/ALL.md community/skills/ALL.md)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Configuration ---
SKILLSPECTOR_REPO="${SKILLSPECTOR_REPO:-https://github.com/nvidia/skillspector.git}"
SKILLSPECTOR_REF="${SKILLSPECTOR_REF:-main}"
SKILLSPECTOR_BIN="${SKILLSPECTOR_BIN:-}"
MANIFEST_FILES="${MANIFEST_FILES:-official/skills/ALL.md community/skills/ALL.md}"

SARIF_OUTPUT=""
MARKDOWN_OUTPUT=""

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sarif)
      SARIF_OUTPUT="$2"
      shift 2
      ;;
    --markdown)
      MARKDOWN_OUTPUT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--sarif <path>] [--markdown <path>]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# --- Resolve output paths ---
SARIF_OUTPUT="${SARIF_OUTPUT:-$REPO_ROOT/skillspector.sarif}"
MARKDOWN_OUTPUT="${MARKDOWN_OUTPUT:-$REPO_ROOT/skillspector-report.md}"

# --- Extract skill URLs from ALL.md files ---
extract_urls() {
  local urls=()
  for manifest in $MANIFEST_FILES; do
    local filepath="$REPO_ROOT/$manifest"
    if [[ ! -f "$filepath" ]]; then
      echo "[WARN] Manifest not found: $filepath" >&2
      continue
    fi
    # Extract URLs from markdown table links: [name](https://github.com/...)
    while IFS= read -r url; do
      urls+=("$url")
    done < <(grep -oP '\(https://github\.com/[^)]+\)' "$filepath" | tr -d '()')
  done

  # Deduplicate and sort
  printf '%s\n' "${urls[@]}" | sort -u
}

# --- Install/locate skillspector ---
setup_skillspector() {
  if [[ -n "$SKILLSPECTOR_BIN" ]]; then
    if [[ ! -x "$SKILLSPECTOR_BIN" ]]; then
      echo "[ERROR] SKILLSPECTOR_BIN is set but not executable: $SKILLSPECTOR_BIN" >&2
      exit 1
    fi
    echo "$SKILLSPECTOR_BIN"
    return
  fi

  local install_dir="$REPO_ROOT/.skillspector"

  if [[ -d "$install_dir/.git" ]]; then
    echo "[INFO] Updating skillspector..." >&2
    git -C "$install_dir" fetch origin "$SKILLSPECTOR_REF" --depth=1 2>/dev/null || true
    git -C "$install_dir" checkout FETCH_HEAD 2>/dev/null || true
  else
    echo "[INFO] Cloning skillspector from $SKILLSPECTOR_REPO ($SKILLSPECTOR_REF)..." >&2
    rm -rf "$install_dir"
    git clone --depth=1 --branch "$SKILLSPECTOR_REF" "$SKILLSPECTOR_REPO" "$install_dir" 2>&1 | head -5 >&2
  fi

  # Attempt to find and prepare the binary
  # Strategy: check for package.json (node), setup.py/pyproject.toml (python), or pre-built binary
  if [[ -f "$install_dir/package.json" ]]; then
    echo "[INFO] Installing skillspector npm dependencies..." >&2
    (cd "$install_dir" && npm install --production 2>&1 | tail -3 >&2)

    # Find the bin entry
    local bin_path
    bin_path=$(cd "$install_dir" && node -e "
      const pkg = require('./package.json');
      const bin = pkg.bin;
      if (typeof bin === 'string') { console.log(bin); }
      else if (bin && typeof bin === 'object') { console.log(Object.values(bin)[0]); }
      else { console.log(''); }
    " 2>/dev/null || echo "")

    if [[ -n "$bin_path" && -f "$install_dir/$bin_path" ]]; then
      chmod +x "$install_dir/$bin_path"
      echo "$install_dir/$bin_path"
      return
    fi

    # Fallback: look for common entry points
    for candidate in cli.js bin/cli.js dist/cli.js src/cli.js index.js; do
      if [[ -f "$install_dir/$candidate" ]]; then
        echo "$install_dir/$candidate"
        return
      fi
    done
  fi

  if [[ -f "$install_dir/pyproject.toml" ]] || [[ -f "$install_dir/setup.py" ]]; then
    echo "[INFO] Installing skillspector python package..." >&2
    pip install --quiet "$install_dir" 2>&1 | tail -3 >&2 || true
    if command -v skillspector &>/dev/null; then
      command -v skillspector
      return
    fi
  fi

  # Look for any executable named skillspector
  local found
  found=$(find "$install_dir" -name "skillspector" -type f -executable 2>/dev/null | head -1)
  if [[ -n "$found" ]]; then
    echo "$found"
    return
  fi

  echo "[ERROR] Could not determine how to run skillspector after cloning." >&2
  echo "[ERROR] Set SKILLSPECTOR_BIN to point to the skillspector executable." >&2
  exit 1
}

# --- Run skillspector on a single URL ---
run_scan() {
  local bin="$1"
  local url="$2"
  local format="$3"

  # Determine how to invoke: node script vs native binary
  if [[ "$bin" == *.js ]]; then
    node "$bin" scan "$url" --format "$format" 2>/dev/null
  else
    "$bin" scan "$url" --format "$format" 2>/dev/null
  fi
}

# --- SARIF envelope (wraps individual results into one valid SARIF file) ---
sarif_header() {
  cat <<'EOF'
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "SkillSpector",
          "informationUri": "https://github.com/nvidia/skillspector",
          "rules": []
        }
      },
      "results": [
EOF
}

sarif_footer() {
  cat <<'EOF'
      ]
    }
  ]
}
EOF
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
    echo "[WARN] No skill URLs found. Nothing to scan."
    exit 0
  fi

  echo "[INFO] Setting up skillspector..."
  local bin
  bin=$(setup_skillspector)
  echo "[INFO] Using skillspector: $bin"

  # Initialize outputs
  local failed=0
  local scanned=0
  local sarif_results=""
  local first_result=true

  {
    echo "## SkillSpector Scan Results"
    echo ""
    echo "| # | Skill URL | Status |"
    echo "|---|-----------|--------|"
  } > "$MARKDOWN_OUTPUT"

  echo "[INFO] Starting scans..."

  while IFS= read -r url; do
    [[ -n "$url" ]] || continue
    ((scanned++))

    echo "::group::[$scanned/$total] $url"

    local md_result
    if md_result=$(run_scan "$bin" "$url" "markdown" 2>/dev/null); then
      echo "| $scanned | $url | OK |" >> "$MARKDOWN_OUTPUT"

      # Append markdown detail
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
      echo "| $scanned | $url | FAILED |" >> "$MARKDOWN_OUTPUT"
      echo "[WARN] Scan failed for: $url" >&2
    fi

    # SARIF collection
    local sarif_result
    if sarif_result=$(run_scan "$bin" "$url" "sarif" 2>/dev/null); then
      # Extract results array from individual SARIF output if present
      local extracted
      extracted=$(echo "$sarif_result" | node -e "
        let data = '';
        process.stdin.on('data', c => data += c);
        process.stdin.on('end', () => {
          try {
            const sarif = JSON.parse(data);
            const results = sarif?.runs?.[0]?.results || [];
            if (results.length > 0) {
              process.stdout.write(JSON.stringify(results));
            }
          } catch {}
        });
      " 2>/dev/null || echo "")

      if [[ -n "$extracted" && "$extracted" != "[]" && "$extracted" != "" ]]; then
        if [[ "$first_result" == true ]]; then
          first_result=false
        else
          sarif_results+=","
        fi
        # Strip outer brackets and append
        sarif_results+="${extracted:1:${#extracted}-2}"
      fi
    fi

    echo "::endgroup::"
  done <<< "$urls"

  # Write SARIF file
  {
    sarif_header
    echo "        $sarif_results"
    sarif_footer
  } > "$SARIF_OUTPUT"

  # Summary footer
  {
    echo ""
    echo "---"
    echo "**Scanned: $scanned | Failed: $failed**"
  } >> "$MARKDOWN_OUTPUT"

  echo ""
  echo "[INFO] Scan complete. Scanned: $scanned, Failed: $failed"
  echo "[INFO] SARIF report: $SARIF_OUTPUT"
  echo "[INFO] Markdown report: $MARKDOWN_OUTPUT"

  if [[ "$failed" -gt 0 ]]; then
    echo "[WARN] $failed scan(s) failed."
  fi
}

main
