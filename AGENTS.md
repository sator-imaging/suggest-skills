# AGENTS.md

## Cursor Cloud specific instructions

**suggest-skills** is a single-package Bun/TypeScript MCP server and CLI. There is no database, Docker, or multi-service stack.

### Services

| Service | Command | Notes |
|---------|---------|-------|
| HTTP MCP server | `SUGGEST_SKILLS_MANIFEST_URLS='["https://github.com/OWNER/REPO/blob/main/path/ALL.md"]' bun run server` | Listens on `http://localhost:3100/mcp`; health at `/health` |
| stdio MCP server | Same env var + `bun run start` (or `bun src/index.ts`) | Default transport for MCP clients |
| CLI generate/download | `bun src/index.ts generate <github-url>` / `download <github-url>` | Requires outbound access to `api.github.com` |

`SUGGEST_SKILLS_MANIFEST_URLS` is required for MCP modes. See `README.md` for accepted formats.

### Standard commands

Documented in `package.json` scripts and `README.md`:

- **Install deps:** `bun install`
- **Lint + typecheck + tests:** `bun run test` (runs `bunx tsgo --noEmit`, `bunx oxlint`, then `bun test`)
- **Unit tests only:** `bun test`
- **Build:** `bun run build` → `dist/index.js`

### Gotchas

- **Runtime:** Bun `>=1.3.13` is required (`packageManager` / `engines` in `package.json`).
- **Network:** Live MCP tool calls and `generate`/`download` need GitHub (`api.github.com`, `raw.githubusercontent.com`). Optional `GITHUB_PAT` improves API rate limits.
- **No pre-commit hooks** in this repo.
- **Official/community manifest trees** (`official/`, `community/`) may be absent in a sparse checkout; use remote manifest URLs (as in `README.md` examples) for manual MCP testing.
