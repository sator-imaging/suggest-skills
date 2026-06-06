# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

**suggest-skills** is a single-package Bun/TypeScript MCP server that recommends and downloads AI agent skills from manifest URLs. There is no database, Docker, or multi-service stack — only the Bun process plus optional outbound HTTP to GitHub for live manifest/skill fetches.

### Services

| Service | Required? | How to run |
|---------|-----------|------------|
| suggest-skills (stdio MCP) | For MCP client integration | `SUGGEST_SKILLS_MANIFEST_URLS='["https://…/manifest.md"]' bun src/index.ts` |
| suggest-skills (HTTP MCP) | For HTTP transport testing | `SUGGEST_SKILLS_MANIFEST_URLS='["https://…/manifest.md"]' bun run server` → `http://localhost:3100/mcp`, health at `/health` |

Bundled manifests in `official/` and `community/` can be referenced via raw GitHub URLs (see README).

### Standard commands

See `package.json` scripts and `.github/workflows/test.yml`:

- **Install:** `bun install --frozen-lockfile`
- **Lint + typecheck:** `bun run check` (`bunx tsgo --noEmit && bunx oxlint`)
- **Test:** `bun run test` (runs check then `bun test`); unit tests alone: `bun test`
- **Build:** `bun run build` → `dist/index.js`
- **Pack check:** `npm pack --dry-run`

### Runtime requirements

- **Bun ≥ 1.3.13** (pinned in `packageManager` / `engines`)
- **`SUGGEST_SKILLS_MANIFEST_URLS`** must be set (JSON array, comma-separated, or newline-separated `.md` URLs) unless using `generate`, `download`, `--help`, or `--version`
- **`GITHUB_PAT`** optional — avoids GitHub API rate limits for `download_skill` / `generate`

### Gotchas

- Tests mock all network calls; `bun test` does not require GitHub or a running server.
- Live E2E (`fetch_manifest`, `download_skill`, `generate`) needs outbound network to `raw.githubusercontent.com` and `api.github.com`.
- HTTP MCP creates a fresh transport per request; no persistent session is required for basic tool calls.
- `fetch_manifest` tool argument is `url` (not `manifestUrl`).
