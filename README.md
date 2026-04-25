[![npm](https://img.shields.io/npm/v/suggest-skills)](https://www.npmjs.com/package/suggest-skills)



# Key Features

- Generates skill manifest from a GitHub skills directory
- MCP server for recommending and downloading repository-specific AI agent skills
- Supports `stdio` and HTTP runtime modes from the same codebase

To find official skills repository: https://skills.sh/official





# Getting Started

## Example MCP Configuration

```json
{
  "mcpServers": {
    "suggest-skills": {
      "command": "npx -y suggest-skills",
      "args": ["-o", ".agents/skills"],
      "env": {
        "SUGGEST_SKILLS_MANIFEST_URLS": [
          "https://some/skill-manifest.md",
          "https://other/skill-manifest.md"
        ]
      }
    }
  }
}
```



## Generate a Manifest

```bash
npx suggest-skills --generate \
  https://github.com/OWNER/REPO/tree/main/skills
```

This may write the following files in the current working directory:

- `<owner>.<repo>.skills.md`: entries collected from skill directories that contain `SKILL.md`
- `<owner>.<repo>.designs.md`: entries collected from skill directories that contain `DESIGN.md`
- `<owner>.<repo>.agents.md`: entries collected from flat top-level markdown files, with `Name` and `Description` columns only
- Accepts plain GitHub repository URLs in generate mode by assuming repo root on `main`

Generate mode uses these rules:

- `SKILL.md` and `DESIGN.md` are discovered in skill directories, and bundled assets are any other files next to them or in nested subdirectories
- `DESIGN.md` reads optional `name` and `description` from YAML front matter, and emits `None` when description is missing
- flat top-level markdown files with front matter are treated as agent definitions for `.agents.md`
- Empty generated outputs are skipped, so no file is written and no overwrite prompt is shown for them





# Configuration

## Environment Variables

`GITHUB_PAT` is optional and is used for authenticated requests to `api.github.com`.

`SUGGEST_SKILLS_MANIFEST_URLS` is required and must contain at least one URL.

Accepted formats:

- JSON array
- Comma-separated string
- Newline-separated string

GitHub `blob` URLs are converted to `raw.githubusercontent.com` URLs automatically.



## CLI Options

- `-o <dir>` or `--output <dir>`: output directory for installed skills
- `--output=<dir>`: inline form
- `--generate <github-url>` or `--generate=<github-url>`: generate markdown inventories from a GitHub skills directory or repo root
- `--server <port>` or `--server=<port>`: run the streamable HTTP server

Default output directory:

```text
.agents/skills
```



## Run in stdio Mode

```bash
SUGGEST_SKILLS_MANIFEST_URLS='["https://some/skill-manifest.md"]' \
  npx suggest-skills
```



## Run in HTTP Mode

```bash
SUGGEST_SKILLS_MANIFEST_URLS='["https://some/skill-manifest.md"]' \
  npx suggest-skills --server 3100
```

The HTTP endpoint is served at `http://localhost:3100/mcp` and the health check is available at `http://localhost:3100/health`.





# MCP Tools

## `suggest_skills`

Returns a generated instruction payload that tells an agent how to:

- Fetch available skills from configured manifests
- Scan locally installed skills
- Compare remote and local capabilities
- Present suggestions without installing anything until requested



## `fetch_manifest`

Accepts a manifest URL and returns its text content.



## `download_skill`

Accepts a GitHub folder URL in the form:

```text
https://github.com/<owner>/<repo>/tree/<ref>/<path>
```

Returns every file in that folder with:

- Path relative to the requested folder
- UTF-8 text content





# Technology Stack

- Bun `>=1.2.0`
- TypeScript
- `@modelcontextprotocol/sdk`
- Hono
- Zod





# Project Architecture

```text
Config -> MCP tool registration -> stdio or HTTP transport

CLI --generate -> GitHub directory scan -> manifest markdown file
               \-> GitHub URL normalization / folder download
```





# Coding Standards

The codebase follows a few clear implementation patterns:

- Small focused modules with runtime concerns split by file
- Explicit config validation through `ConfigError`
- Typed tool schemas and structured output for MCP tools
- Minimal transport wrappers around shared server creation
- Tests centered on observable behavior rather than implementation detail





# Contributing

- Keep changes aligned with the MCP server's current responsibilities
- Prefer updating shared logic in `src/core.ts`, `src/config.ts`, and helper modules before adding transport-specific behavior
- Add or update tests when changing config parsing, MCP responses, or GitHub download behavior
- Use `SPEC.md` as the starting point for intended behavior and direction
