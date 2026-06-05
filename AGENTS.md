# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**suggest-skills** is a single Bun/TypeScript package: an MCP server that recommends and downloads AI agent skills, plus CLI commands for manifest generation and skill downloads. There is no database, Docker stack, or multi-service backend.

### Runtime

- **Bun `>=1.3.13`** is required (`packageManager`: `bun@1.3.13` in `package.json`).
- Ensure `~/.bun/bin` is on `PATH`. If Bun was installed from the GitHub release zip (not `bun.sh/install`), create a `bunx` symlink: `ln -sf ~/.bun/bin/bun ~/.bun/bin/bunx`.

### Common commands

See `package.json` scripts and `README.md` for full usage. Quick reference:

| Task | Command |
|------|---------|
| Install deps | `bun install --frozen-lockfile` |
| Lint + typecheck | `bun run check` (`bunx tsgo --noEmit && bunx oxlint`) |
| Tests | `bun test` (unit tests only) or `bun run test` (check + tests) |
| Build | `bun run build` |
| Stdio MCP (default) | `SUGGEST_SKILLS_MANIFEST_URLS='["https://…/ALL.md"]' bun run start` |
| HTTP MCP server | `SUGGEST_SKILLS_MANIFEST_URLS='["https://…/ALL.md"]' bun run server` |

### Running the HTTP MCP server

`SUGGEST_SKILLS_MANIFEST_URLS` must be set to at least one `.md` manifest URL before starting (see `README.md`). Example using this repo's official catalog:

```bash
export SUGGEST_SKILLS_MANIFEST_URLS='["https://raw.githubusercontent.com/sator-imaging/suggest-skills/main/official/skills/ALL.md"]'
bun run server
```

- Health: `GET http://localhost:3100/health`
- MCP: `POST http://localhost:3100/mcp` (JSON-RPC; `accept: application/json, text/event-stream`)
- MCP tools: `suggest_skills`, `fetch_manifest` (arg: `url`), `download_skill` (arg: `url`)

`GITHUB_PAT` is optional; it only helps with GitHub API rate limits for `generate` / `download` against live repos. Do not embed GitHub tokens in manifest or GitHub URLs (for example `https://token@raw.githubusercontent.com/...`); credentials in `SUGGEST_SKILLS_MANIFEST_URLS` are stripped automatically and will not be used for authentication.

### Testing notes

- `bun test` runs 63 unit/integration tests with mocked `fetch` and short-lived processes — no long-running server required.
- Tests do not need `SUGGEST_SKILLS_MANIFEST_URLS` unless exercising CLI/MCP spawn paths that set it in the test harness.
- `bun run check` may report `tsgo` errors in `src/utils.ts` under strict `noUncheckedIndexedAccess`; `bun test` and `bun run build` still succeed at the current tree.

### Optional / CI-only

- **NVIDIA SkillSpector** (`eng/skillspector.ts`, `.github/workflows/skillspector.yml`) — security scanning in CI only; not needed for local dev.
