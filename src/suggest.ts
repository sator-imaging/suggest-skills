import type { SuggestSkillsConfig } from "./config.js";

export function buildSuggestionResponse(
  config: SuggestSkillsConfig,
): string {
  const sourceUrlList = config.sourceUrls
    .map((url) => `- ${url}\n`)
    .join();
  return INSTRUCTIONS
    .replaceAll('###manifests###', sourceUrlList.trimEnd())
    .replaceAll('###outdir###', config.outputDirectory);
}

// https://github.com/github/awesome-copilot/blob/main/plugins/awesome-copilot/skills/suggest-awesome-github-copilot-skills/SKILL.md
// Variables
// - ###manifests###
// - ###outdir###
// Removed
// - Version Comparison Process
// - Update Handling
// - githubRepo and fetch tool
const INSTRUCTIONS = `\
# Suggest Skills

Agent Skills are self-contained folders, each containing a \`SKILL.md\` file with instructions and optional bundled assets.
Analyze the current repository context and suggest relevant Agent Skills based on the manifests listed below.

## Manifests of Agent Skills

###manifests###

## Process

1. **Fetch Available Skills**: Use \`fetch_manifest\` to read each manifest, then extract the list of skills and their descriptions
2. **Scan Local Skills**: Discover existing skill folders in \`###outdir###\` folder
3. **Extract Descriptions**: Read front matter from local \`SKILL.md\` files to get \`name\` and \`description\`
4. **Analyze Context**: Review chat history, repository files, and current project needs
5. **Compare Existing**: Check against skills already available in this repository
6. **Match Relevance**: Compare available skills against identified patterns and requirements
7. **Present Options**: Display relevant skills with descriptions, rationale, and availability status
8. **Validate**: Ensure suggested skills would add value not already covered by existing skills
9. **Output**: Provide structured table with suggestions, descriptions, and links to both remote skills and similar local skills
   **AWAIT** user request to proceed with installation or updates of specific skills. DO NOT INSTALL OR UPDATE UNLESS DIRECTED TO DO SO.
10. **Download/Update Assets**: For requested skills, automatically:
    - Download new skills to \`###outdir###\` folder, preserving the folder structure
    - Update outdated skills by replacing with latest version from remote source
    - Download both \`SKILL.md\` and any bundled assets (scripts, templates, data files)
    - Do NOT adjust content of the files

## Context Analysis Criteria

🔍 **Repository Patterns**:
- Programming languages used (.cs, .js, .py, .ts, etc.)
- Framework indicators (ASP.NET, React, Azure, Next.js, etc.)
- Project types (web apps, APIs, libraries, tools, infrastructure)
- Development workflow requirements (testing, CI/CD, deployment)
- Infrastructure and cloud providers (Azure, AWS, GCP)

🗨️ **Chat History Context**:
- Recent discussions and pain points
- Feature requests or implementation needs
- Code review patterns
- Development workflow requirements
- Specialized task needs (diagramming, evaluation, deployment)

## Output Format

Display analysis results in structured table comparing remote skills with existing repository skills:

| Agent Skill | Description | Bundled Assets | Already Installed | Similar Local Skill | Suggestion Rationale |
|-------------|-------------|----------------|-------------------|---------------------|----------------------|
| [gh-cli](https://github.com/github/awesome-copilot/tree/main/skills/gh-cli) | GitHub CLI skill for managing repositories and workflows | None | ❌ No | None | Would enhance GitHub workflow automation capabilities |
| [aspire](https://github.com/github/awesome-copilot/tree/main/skills/aspire) | Aspire skill for distributed application development | 9 reference files | ✅ Yes | aspire | Already covered by existing Aspire skill |
| [terraform-azurerm-set-diff-analyzer](https://github.com/github/awesome-copilot/tree/main/skills/terraform-azurerm-set-diff-analyzer) | Analyze Terraform AzureRM provider changes | Reference files | ⚠️ Outdated | terraform-azurerm-set-diff-analyzer | Instructions updated with new validation patterns - Update recommended |

## Local Skills Discovery Process

1. List all folders in \`###outdir###\` directory
2. For each folder, read \`SKILL.md\` front matter to extract \`name\` and \`description\`
3. List any bundled assets within each skill folder
4. Build comprehensive inventory of existing skills with their capabilities
5. Use this inventory to avoid suggesting duplicates

## Skill Structure Requirements

Based on the Agent Skills specification, each skill is a folder containing:
- **\`SKILL.md\`**: Main instruction file with front matter (\`name\`, \`description\`) and detailed instructions
- **Optional bundled assets**: Scripts, templates, reference data, and other files referenced from \`SKILL.md\`
- **Folder naming**: Lowercase with hyphens (e.g., \`azure-deployment-preflight\`)
- **Name matching**: The \`name\` field in \`SKILL.md\` front matter must match the folder name

## Front Matter Structure

Skills use this front matter format in \`SKILL.md\`:
\`\`\`markdown
---
name: 'skill-name'
description: 'Brief description of what this skill provides and when to use it'
---
\`\`\`

## Requirements

- Scan local file system for existing skills in \`###outdir###\` directory
- Read YAML front matter from local \`SKILL.md\` files to extract names and descriptions
- Compare against existing skills in this repository to avoid duplicates
- Focus on gaps in current skill library coverage
- Validate that suggested skills align with repository's purpose and technology stack
- Provide clear rationale for each suggestion
- Include links to both remote skills and similar local skills
- Consider bundled asset requirements and compatibility
- Don't provide any additional information or context beyond the table and the analysis

## Icons Reference

- ✅ Already installed
- ❌ Not installed in repo
- ⚠️ Installed but outdated

## How To Download

There are 3 ways to download the skills.
If the user has not stated a preference, ask which they prefer.

- Use shell command \`gh skill\` (reference: https://github.blog/changelog/2026-04-16-manage-agent-skills-with-github-cli/)
- Use shell command \`npx skills\` (reference: https://raw.githubusercontent.com/vercel-labs/skills/refs/heads/main/README.md)
- Use MCP tool \`download_skill\`
  - Pass a GitHub folder URL in the form \`https://github.com/<owner>/<repo>/tree/<ref>/<path>\`
  - The URL must include the folder path inside the repository
  - The tool returns every downloaded file with its relative path and file content
  - Preserve the returned folder structure when writing files locally

## Update Process

This update process applies only when using MCP tool \`download_skill\`.

- When updating a skill, treat the downloaded folder as the full replacement for that skill
- Delete the existing local skill folder with the same name before writing the updated files
- Recreate the folder from the downloaded files using the returned relative paths
- Replace all bundled assets with the downloaded versions
- Do not merge old files with new files
- Do not preserve files that are missing from the downloaded result
`;
