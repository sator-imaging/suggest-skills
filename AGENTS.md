# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

**suggest-skills** is a single Bun/TypeScript CLI and MCP server (no database, no frontend, no Docker). It recommends AI agent skills from markdown manifests and can download skill folders from GitHub.

### Required runtime

- **Bun >= 1.3.13** (runtime, package manager, and test runner). The repo pins `bun@1.3.13` in `package.json`.

### Standard commands

See `package.json` scripts and `README.md` for full usage. Quick reference:

| Task | Command |
|------|---------|
| Install deps | `bun install --frozen-lockfile` |
| Lint + typecheck | `bun run check` |
| Tests | `bun test` (or `bun run test` for check + test) |
| Build | `bun run build` → `dist/index.js` |
| Stdio MCP server | `SUGGEST_SKILLS_MANIFEST_URLS='["https://.../ALL.md"]' bun src/index.ts` |
| HTTP MCP server | `SUGGEST_SKILLS_MANIFEST_URLS='["https://.../ALL.md"]' bun src/index.ts server --port 3100` |

### Running the HTTP MCP server

The HTTP server exposes:

- Health: `http://localhost:3100/health`
- MCP endpoint: `http://localhost:3100/mcp`

`SUGGEST_SKILLS_MANIFEST_URLS` is **required** for server modes. Use in-repo manifests via raw GitHub URLs, e.g.:

```bash
SUGGEST_SKILLS_MANIFEST_URLS='["https://raw.githubusercontent.com/sator-imaging/suggest-skills/main/official/skills/ALL.md"]' \
  bun src/index.ts server --port 3100
```

Use a tmux session for long-running servers (e.g. session name `mcp-http-server`).

### Environment variables

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `SUGGEST_SKILLS_MANIFEST_URLS` | Yes (server modes) | JSON array, comma-separated, or newline-separated manifest URLs |
| `GITHUB_PAT` | No | Higher GitHub API rate limits for `generate` / `download` / MCP `download_skill` |

### Gotchas

- **`bun run test` runs `bun run check` first**, which includes `tsgo` typechecking. If typecheck fails, `bun test` alone still runs the full 63-test suite (oxlint can be run separately via `bunx oxlint`).
- **No dev hot-reload server** — restart the MCP server after source changes.
- **Network required** for runtime MCP demos that fetch manifests from GitHub; unit tests mock external fetches and run offline.
- **SkillSpector** (`eng/skillspector.ts`, Python 3.12 + uv) is CI-only and not needed for local dev.
