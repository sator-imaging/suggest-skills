[![npm](https://img.shields.io/npm/v/suggest-skills)](https://www.npmjs.com/package/suggest-skills)
[![test](https://github.com/sator-imaging/suggest-skills/actions/workflows/test.yml/badge.svg)](https://github.com/sator-imaging/suggest-skills/actions/workflows/test.yml)



# Key Features

- Generates skill manifest from a GitHub skills directory
- MCP server for recommending and downloading repository-specific AI agent skills
- Supports `stdio` and HTTP runtime modes from the same codebase

> [!TIP]
> To find official skills repository, visit: https://skills.sh/official





# Getting Started

## Example MCP Configuration

```json
{
  "mcpServers": {
    "suggest-skills": {
      "command": "npx",
      "args": [
        "-y",
        "suggest-skills",
        "--",
        "--output=.agents/skills",
        "https://github.com/sator-imaging/suggest-skills/blob/main/official/official-skills.md",
        "https://github.com/sator-imaging/suggest-skills/blob/main/community/community-skills.md"
      ],
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


### Official & Community Skills

Prebuilt skill manifests can be found in this repository:
- [Official Skills, Agents and Designs](./official/)
- [Community Skills, Agents and Designs](./community/)

> [!TIP]
> Security scanning is provided by [NVIDIA SkillSpector](https://github.com/NVIDIA/skillspector) via the [CI workflow](https://github.com/sator-imaging/suggest-skills/actions/workflows/generate-manifests.yml). Each skill is scanned individually and the resulting risk score is written to the `Security Risk` column.


## Generate a Manifest

```bash
npx suggest-skills generate \
  https://github.com/OWNER/REPO/tree/main/skills
```

```bash
npx suggest-skills generate \
  --recursive \
  https://github.com/OWNER/REPO/tree/main/skills
```

This may write the following files in the current working directory:

- `<owner>.<repo>[.<path>].skills.md`: entries collected from skill directories that contain `SKILL.md`
- `<owner>.<repo>[.<path>].designs.md`: entries collected from skill directories that contain `DESIGN.md`
- `<owner>.<repo>[.<path>].agents.md`: entries collected from flat top-level markdown files, with `Name` and `Description` columns only
- Accepts plain GitHub repository URLs in generate mode by assuming repo root on `main`

Generate mode uses these rules:

- GitHub directory discovery uses a recursive tree listing internally
- `SKILL.md` and `DESIGN.md` are discovered in skill directories, and bundled assets are any other files next to them or in nested subdirectories
- Symlinks found during generate are not handled specially; they may appear in bundled assets, but are not traversed
- Without `--recursive`, `SKILL.md` and `DESIGN.md` are discovered from direct child directories of the generate root
- With `--recursive`, only subdirectory search is expanded, so nested directories are also scanned for `SKILL.md` and `DESIGN.md`
- Root-level markdown files for `.agents.md` are still discovered the same way whether `--recursive` is present or not
- Output file naming stays based on the original generate root whether `--recursive` is present or not
- Output file names are normalized to remove redundant type suffixes (e.g., `some-skills.md` instead of `some-skills.skills.skills.md`)
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
- `generate [-r|--recursive] <github-url>`: generate markdown inventories from a GitHub skills directory or repo root
- `server --port <number>`: run the streamable HTTP server

Default output directory:

```text
.agents/skills
```



## Run in `stdio` Mode

```bash
SUGGEST_SKILLS_MANIFEST_URLS='["https://some/skill-manifest.md"]' \
  npx suggest-skills
```



## Run in HTTP Mode

```bash
SUGGEST_SKILLS_MANIFEST_URLS='["https://some/skill-manifest.md"]' \
  npx suggest-skills server --port 3100
```

The HTTP endpoint is served at `http://localhost:3100/mcp` and the health check is available at `http://localhost:3100/health`.





# MCP Tools

## `suggest_skills`

Accepts an optional `manifestUrl` to overwrite the default configuration.

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
- File symlinks are downloaded when GitHub provides a `download_url`
- Repository-relative directory symlinks are resolved and downloaded recursively





# Technology Stack

- Bun
- TypeScript
- @modelcontextprotocol/sdk
- Zod





# Project Architecture

```text
Config -> MCP tool registration -> stdio or HTTP transport

CLI generate -> GitHub directory scan -> manifest markdown file
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
