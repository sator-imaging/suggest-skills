/**
 * eng/diff-skills.ts
 *
 * Compares skill manifests between two git revisions/refs to find added and removed skills.
 *
 * Usage:
 *   bun eng/diff-skills.ts [--base <ref>] [--head <ref>] [--markdown <path>] [--summary]
 *
 * Defaults:
 *   --base: origin/main (or main if origin/main does not exist)
 *   --head: HEAD
 *   --summary: if set, also appends report to process.env.GITHUB_STEP_SUMMARY
 *   --markdown: if set, writes report to the specified file path
 */

import { parseArgs } from "util";
import { Glob, spawnSync } from "bun";
import { resolve, relative, join } from "path";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";

export interface SkillEntry {
  name: string;
  url: string;
  repo: string;
  ref: string;
  skillPath: string;
  description: string;
  manifest: string;
}

export interface SkillDiffResult {
  added: SkillEntry[];
  removed: SkillEntry[];
}

const REPO_ROOT = resolve(import.meta.dir, "..");
const SKILL_ROW_PATTERN = /\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^/)]+)\/?([^)]*))\)\s*\|\s*([^|]*)\s*\|/g;

/**
 * Parses skill entries from markdown manifest content.
 */
export function parseSkillsFromContent(content: string, manifest: string): Map<string, SkillEntry> {
  const skills = new Map<string, SkillEntry>();

  for (const m of content.matchAll(SKILL_ROW_PATTERN)) {
    const name = m[1]?.trim();
    const url = m[2]?.trim();
    const repo = m[3]?.trim();
    const ref = m[4]?.trim();
    const skillPath = m[5]?.trim() ?? "";
    const description = m[6]?.trim() ?? "";

    if (!name || !url || !repo || !ref) continue;

    // Use repo + skillPath (or repo + name if skillPath is empty) as unique canonical key across revisions
    const key = skillPath ? `${repo}/${skillPath}` : `${repo}/${name}`;

    skills.set(key, {
      name,
      url,
      repo,
      ref,
      skillPath,
      description,
      manifest,
    });
  }

  return skills;
}

/**
 * Retrieves file content at a given git revision.
 */
export function getGitFileContent(revision: string, filePath: string): string | null {
  const relPath = relative(REPO_ROOT, resolve(REPO_ROOT, filePath)).replace(/\\/g, "/");
  const proc = spawnSync(["git", "show", `${revision}:${relPath}`], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    return null;
  }

  return proc.stdout.toString();
}

/**
 * Returns list of skill manifest relative paths (matching community/skills/*.md and official/skills/*.md).
 */
export function findSkillManifests(): string[] {
  const glob = new Glob("{community,official}/skills/*.md");
  const files: string[] = [];
  for (const match of glob.scanSync({ cwd: REPO_ROOT })) {
    files.push(match.replace(/\\/g, "/"));
  }
  return files.sort();
}

/**
 * Compares skill manifests between baseRef and headRef.
 */
export function computeSkillDiff(
  baseRef: string,
  headRef: string,
  manifests: readonly string[] = findSkillManifests(),
): SkillDiffResult {
  const baseSkills = new Map<string, SkillEntry>();
  const headSkills = new Map<string, SkillEntry>();

  for (const manifest of manifests) {
    const baseContent = getGitFileContent(baseRef, manifest);
    if (baseContent) {
      const parsed = parseSkillsFromContent(baseContent, manifest);
      for (const [key, skill] of parsed) {
        baseSkills.set(key, skill);
      }
    }

    // For headRef: if headRef is HEAD or empty, we can check git or working tree
    let headContent = getGitFileContent(headRef, manifest);
    if (headContent === null && headRef === "HEAD") {
      const fullPath = join(REPO_ROOT, manifest);
      if (existsSync(fullPath)) {
        headContent = readFileSync(fullPath, "utf-8");
      }
    }

    if (headContent) {
      const parsed = parseSkillsFromContent(headContent, manifest);
      for (const [key, skill] of parsed) {
        headSkills.set(key, skill);
      }
    }
  }

  const added: SkillEntry[] = [];
  const removed: SkillEntry[] = [];

  for (const [key, skill] of headSkills) {
    if (!baseSkills.has(key)) {
      added.push(skill);
    }
  }

  for (const [key, skill] of baseSkills) {
    if (!headSkills.has(key)) {
      removed.push(skill);
    }
  }

  // Sort by repo then name
  const comparator = (a: SkillEntry, b: SkillEntry) => {
    const repoCmp = a.repo.localeCompare(b.repo);
    if (repoCmp !== 0) return repoCmp;
    return a.name.localeCompare(b.name);
  };

  added.sort(comparator);
  removed.sort(comparator);

  return { added, removed };
}

function escapeTableCell(text: string): string {
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

/**
 * Formats a list of skills as a Markdown table.
 */
function formatSkillTable(skills: readonly SkillEntry[]): string {
  if (skills.length === 0) {
    return "_None_\n";
  }

  const lines = [
    "| Skill | Repository | Description |",
    "|-------|------------|-------------|",
  ];

  for (const s of skills) {
    const skillLink = `[${escapeTableCell(s.name)}](${s.url})`;
    const repoLink = `[${escapeTableCell(s.repo)}](https://github.com/${s.repo})`;
    const desc = escapeTableCell(s.description || "-");
    lines.push(`| ${skillLink} | ${repoLink} | ${desc} |`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Formats the complete report using <details> tags.
 */
export function formatSkillDiffReport(diff: SkillDiffResult): string {
  const addedCount = diff.added.length;
  const removedCount = diff.removed.length;

  const lines: string[] = [
    "### Skills Changes Summary",
    "",
    `- **Added skills**: ${addedCount}`,
    `- **Removed skills**: ${removedCount}`,
    "",
  ];

  lines.push(`<details><summary><b>Added Skills (${addedCount})</b></summary>`);
  lines.push("");
  lines.push(formatSkillTable(diff.added));
  lines.push("</details>");
  lines.push("");

  lines.push(`<details><summary><b>Removed Skills (${removedCount})</b></summary>`);
  lines.push("");
  lines.push(formatSkillTable(diff.removed));
  lines.push("</details>");
  lines.push("");

  return lines.join("\n");
}

function resolveDefaultBaseRef(): string {
  const checkOriginMain = spawnSync(["git", "rev-parse", "--verify", "origin/main"], {
    cwd: REPO_ROOT,
  });
  if (checkOriginMain.exitCode === 0) {
    return "origin/main";
  }

  const checkMain = spawnSync(["git", "rev-parse", "--verify", "main"], {
    cwd: REPO_ROOT,
  });
  if (checkMain.exitCode === 0) {
    return "main";
  }

  return "HEAD~1";
}

export async function run(): Promise<void> {
  const { values: args } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      base: { type: "string" },
      head: { type: "string", default: "HEAD" },
      markdown: { type: "string" },
      summary: { type: "boolean", default: false },
    },
    strict: true,
  });

  const baseRef = args.base || resolveDefaultBaseRef();
  const headRef = args.head || "HEAD";

  console.log(`[INFO] Comparing skills between ${baseRef} and ${headRef}...`);

  const diff = computeSkillDiff(baseRef, headRef);
  const report = formatSkillDiffReport(diff);

  if (args.markdown) {
    const outPath = resolve(args.markdown);
    writeFileSync(outPath, report);
    console.log(`[INFO] Report written to ${outPath}`);
  }

  if (args.summary) {
    const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
    if (summaryFile) {
      appendFileSync(summaryFile, report);
      console.log(`[INFO] Report appended to GITHUB_STEP_SUMMARY`);
    } else {
      console.warn(`[WARN] GITHUB_STEP_SUMMARY environment variable is not defined.`);
    }
  }

  if (!args.markdown && !args.summary) {
    console.log(report);
  }
}

if (import.meta.main) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
