# AGENTS.md

## Cursor Cloud specific instructions

### Product

**suggest-skills** is a Bun/TypeScript CLI and MCP server. It generates skill manifests from GitHub, exposes MCP tools (`suggest_skills`, `fetch_manifest`, `download_skill`), and runs in **stdio** (default) or **HTTP** mode. There is no database or Docker Compose stack; CI and local dev only need Bun and installed npm dependencies.

### Bun runtime

The repo requires **Bun ≥ 1.3.13** (`package.json` `engines`). Cloud VMs may not ship Bun globally. Install it once (outside the update script) if needed:

```bash
npm install --prefix "$HOME/.bun" bun@1.3.13
echo 'export PATH="$HOME/.bun/node_modules/.bin:$PATH"' >> ~/.bashrc
```

Ensure `~/.bun/node_modules/.bin` is on `PATH` before any `bun` command.

### Commands (from repo root)

| Task | Command |
|------|---------|
| Install deps | `bun install --frozen-lockfile` |
| Lint + typecheck | `bun run check` (`tsgo --noEmit` + `oxlint` via `bunx`) |
| Tests (full CI script) | `bun run test` (= `check` + `bun test`) |
| Tests only | `bun test` |
| Build | `bun run build` → `dist/index.js` |
| Stdio MCP | `SUGGEST_SKILLS_MANIFEST_URLS='["https://…/manifest.md"]' bun run start` |
| HTTP MCP | Same env + `bun run server` (port **3100**, `/mcp`, `/health`) |

See `README.md` for `SUGGEST_SKILLS_MANIFEST_URLS` formats and optional `GITHUB_PAT`.

### Running the HTTP server

Use **tmux** for long-lived dev servers (not one-shot background shells):

```bash
tmux -f /exec-daemon/tmux.portal.conf new-session -d -s suggest-skills-http -c /workspace -- bash -l
tmux -f /exec-daemon/tmux.portal.conf send-keys -t suggest-skills-http:0.0 \
  'export PATH="$HOME/.bun/node_modules/.bin:$PATH" && \
   SUGGEST_SKILLS_MANIFEST_URLS='"'"'["https://raw.githubusercontent.com/sator-imaging/suggest-skills/main/official/skills/ALL.md"]'"'"' \
   bun run server' C-m
curl -s http://localhost:3100/health   # {"status":"ok"}
```

### Typecheck note

As of setup on `main`, `bun run check` can fail with `TS2532` in `src/utils.ts` (lines 207, 215) under the pinned `@typescript/native-preview` (`tsgo`). **`bun test`** (63 tests) and **`bun run build`** still succeed. Use `bun test` when you only need runtime verification until `check` is fixed on the branch you are on.

### Optional: SkillSpector eng tool

`bun eng/skillspector.ts` needs Python 3.12 + [NVIDIA/skillspector](https://github.com/NVIDIA/skillspector); not required for MCP or unit tests.

### Hello-world verification

1. `bun test` — all tests pass (GitHub `fetch` is mocked in `test/`).
2. `curl http://localhost:3100/health` after starting `bun run server`.
3. MCP `fetch_manifest` over stdio against a raw manifest URL (e.g. `official/skills/anthropics.skills.md` on this repo’s `main` branch).

No pre-commit hooks or `.devcontainer` config in this repository.
