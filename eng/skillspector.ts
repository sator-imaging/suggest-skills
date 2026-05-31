/**
 * eng/skillspector.ts
 *
 * Scans individual skills listed in ALL.md manifests using NVIDIA SkillSpector.
 * Repos are cloned locally (with submodules, resolving symlinks), then each
 * skill directory is scanned individually.
 *
 * Uses ts-fibers for concurrent scanning with per-scan timeout (AbortController + process kill).
 *
 * Usage:
 *   bun eng/skillspector.ts [--sarif <path>] [--markdown <path>] [--no-llm]
 *                           [--timeout <seconds>] [--jobs <n>]
 */

import { Fibers } from "ts-fibers";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, realpathSync, lstatSync } from "fs";
import { join, resolve } from "path";
import { spawn, type Subprocess } from "bun";
import { parseArgs } from "util";

// --- CLI ---

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    sarif: { type: "string", default: "skillspector.sarif" },
    markdown: { type: "string", default: "skillspector-report.md" },
    "no-llm": { type: "boolean", default: false },
    timeout: { type: "string" },
    jobs: { type: "string" },
  },
  strict: true,
});

const SARIF_OUTPUT = resolve(args.sarif!);
const MARKDOWN_OUTPUT = resolve(args.markdown!);
const NO_LLM = args["no-llm"]!;

const DEFAULT_TIMEOUT_SEC = 180 as const;
const DEFAULT_CONCURRENCY = 3 as const;

const TIMEOUT_MS = Number(args.timeout ?? DEFAULT_TIMEOUT_SEC) * 1000;
const CONCURRENCY = Number(args.jobs ?? DEFAULT_CONCURRENCY);

const REPO_ROOT = resolve(import.meta.dir, "..");
const MANIFEST_FILES = ["official/skills/ALL.md", "community/skills/ALL.md"];

// --- Types ---

interface SkillEntry {
  /** Display name of the skill */
  name: string;
  /** Full GitHub URL to the skill */
  url: string;
  /** Repository in OWNER/REPO format */
  repo: string;
  /** Git ref (branch/tag) */
  ref: string;
  /** Skill path within the repo (e.g. skills/my-skill) */
  skillPath: string;
}

interface ScanResult {
  index: number;
  skill: SkillEntry;
  status: "OK" | "FAILED" | "TIMEOUT" | "CLONE_FAILED";
  markdown: string;
  score: string;
  severity: string;
  sarif: object | null;
}

// --- Extract individual skill entries from manifests ---

function extractSkillEntries(): SkillEntry[] {
  const entries: SkillEntry[] = [];
  const seen = new Set<string>();

  for (const manifest of MANIFEST_FILES) {
    const filepath = join(REPO_ROOT, manifest);
    if (!existsSync(filepath)) {
      console.warn(`[WARN] Manifest not found: ${filepath}`);
      continue;
    }
    const content = readFileSync(filepath, "utf-8");

    // Match skill table rows: | [name](url) | description | assets |
    const rowPattern = /\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^)]+))\)/g;
    for (const m of content.matchAll(rowPattern)) {
      const name = m[1];
      const url = m[2];
      const repo = m[3];
      const refAndPath = m[4]; // e.g. "main/skills/my-skill"

      // Skip duplicates
      if (seen.has(url)) continue;
      seen.add(url);

      // Split ref (first segment) from path (rest)
      const slashIdx = refAndPath.indexOf("/");
      const ref = slashIdx >= 0 ? refAndPath.slice(0, slashIdx) : refAndPath;
      const skillPath = slashIdx >= 0 ? refAndPath.slice(slashIdx + 1) : "";

      entries.push({ name, url, repo, ref, skillPath });
    }
  }

  return entries;
}

// --- Clone a repository (with submodules) ---

async function cloneRepo(
  repoSlug: string,
  ref: string,
  destDir: string,
  timeoutMs: number,
): Promise<{ success: boolean; timedOut: boolean }> {
  const repoUrl = `https://github.com/${repoSlug}.git`;

  // Clone with depth=1 for speed, then init submodules
  const cloneArgs = [
    "clone", "--depth=1", "--branch", ref,
    "--recurse-submodules", "--shallow-submodules",
    repoUrl, destDir,
  ];

  const ac = new AbortController();
  const timeoutPromise = Fibers.delay(timeoutMs, ac);

  const proc = spawn(["git", ...cloneArgs], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitPromise = proc.exited.then((code) => ({ kind: "done" as const, code }));
  const timeoutDone = timeoutPromise.then(() => ({ kind: "timeout" as const, code: -1 }));

  const race = await Promise.race([exitPromise, timeoutDone]);

  if (race.kind === "timeout") {
    proc.kill(9);
    return { success: false, timedOut: true };
  }

  ac.abort();
  return { success: race.code === 0, timedOut: false };
}

// --- Resolve skill directory (follows symlinks) ---

function resolveSkillDir(cloneDir: string, skillPath: string): string | null {
  const target = join(cloneDir, skillPath);

  if (!existsSync(target)) return null;

  // Resolve symlinks to get the real path
  const resolved = realpathSync(target);

  // Verify resolved path is still within the clone (security check)
  const realClone = realpathSync(cloneDir);
  if (!resolved.startsWith(realClone)) {
    console.warn(`  [WARN] Symlink escapes clone: ${target} -> ${resolved}`);
    return null;
  }

  return resolved;
}

// --- Run skillspector scan on a local directory ---

async function runScan(
  dir: string,
  format: "markdown" | "sarif",
  timeoutMs: number,
): Promise<{ output: string; timedOut: boolean; exitCode: number }> {
  const cmdArgs = ["scan", dir, "--format", format];
  if (NO_LLM) cmdArgs.push("--no-llm");

  const ac = new AbortController();

  const timeoutPromise = Fibers.delay(timeoutMs, ac);

  const proc = spawn(["skillspector", ...cmdArgs], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutPromise = new Response(proc.stdout).text()
    .then((text) => ({ kind: "done" as const, text }));
  const timeoutDone = timeoutPromise
    .then(() => ({ kind: "timeout" as const, text: "" }));

  const race = await Promise.race([stdoutPromise, timeoutDone]);

  if (race.kind === "timeout") {
    proc.kill(9);
    return { output: "", timedOut: true, exitCode: -1 };
  }

  ac.abort();
  return { output: race.text, timedOut: false, exitCode: proc.exitCode ?? 0 };
}

// --- Parse score/severity from markdown output ---

function parseScore(md: string): string {
  const m = md.match(/Score \| (\d+\/100)/);
  return m?.[1] ?? "-";
}

function parseSeverity(md: string): string {
  const m = md.match(/Severity \| (\w+)/);
  return m?.[1] ?? "-";
}

/** Strip ## Components and ## Issues sections from skillspector markdown. */
function stripDetailSections(md: string): string {
  return md
    .replace(/\n## (?:Components|Issues)\b[^\n]*\n[\s\S]*?(?=\n#{1,2} (?!#)|\n*$)/g, "")
    .trimEnd();
}

// --- Main ---

async function main() {
  const skills = extractSkillEntries();
  const total = skills.length;

  if (total === 0) {
    console.warn("[WARN] No skills found in manifests.");
    process.exit(0);
  }

  console.log(`[INFO] Found ${total} individual skills to scan`);
  console.log(`[INFO] Concurrency: ${CONCURRENCY}, Timeout: ${TIMEOUT_MS / 1000}s per scan`);

  // --- Phase 1: Clone unique repos ---

  const tmpBase = join(REPO_ROOT, ".skillspector-tmp");
  rmSync(tmpBase, { recursive: true, force: true });
  mkdirSync(tmpBase, { recursive: true });

  // Group skills by repo+ref to avoid redundant clones
  const repoGroups = new Map<string, { repo: string; ref: string; skills: { skill: SkillEntry; index: number }[] }>();
  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i]!;
    const key = `${skill.repo}@${skill.ref}`;
    if (!repoGroups.has(key)) {
      repoGroups.set(key, { repo: skill.repo, ref: skill.ref, skills: [] });
    }
    repoGroups.get(key)!.skills.push({ skill, index: i });
  }

  console.log(`[INFO] Cloning ${repoGroups.size} unique repositories...`);

  // Clone repos concurrently
  const cloneResults = new Map<string, string | null>(); // key -> cloneDir or null on failure

  const cloneFibers = Fibers.forEach(
    CONCURRENCY,
    [...repoGroups.entries()].map(([key, group]) => ({ key, group })),
    async ({ key, group }) => {
      const cloneDir = join(tmpBase, "repos", key.replace(/[/@]/g, "_"));
      mkdirSync(cloneDir, { recursive: true });

      console.log(`  [CLONE] ${group.repo}@${group.ref}`);
      const result = await cloneRepo(group.repo, group.ref, cloneDir, TIMEOUT_MS);

      if (result.timedOut) {
        console.error(`  [TIMEOUT] Clone killed: ${group.repo}@${group.ref}`);
        cloneResults.set(key, null);
      } else if (!result.success) {
        console.error(`  [FAILED] Clone failed: ${group.repo}@${group.ref}`);
        cloneResults.set(key, null);
      } else {
        cloneResults.set(key, cloneDir);
      }

      return { key };
    },
  );

  cloneFibers.setErrorHandler((e) => {
    console.error(`  [CLONE ERROR] ${e?.message ?? e}`);
    return "skip";
  });

  for await (const _ of cloneFibers) { /* drain */ }

  // --- Phase 2: Scan each skill directory ---

  console.log(`[INFO] Scanning ${total} skills...`);

  const results: ScanResult[] = new Array(total);

  const scanFibers = Fibers.forEach(
    CONCURRENCY,
    skills.map((skill, i) => ({ skill, index: i })),
    async (item) => {
      const { skill, index } = item;
      const num = index + 1;
      console.log(`[${num}/${total}] ${skill.repo} :: ${skill.name}`);

      let status: ScanResult["status"] = "OK";
      let markdown = "";
      let score = "-";
      let severity = "-";
      let sarif: object | null = null;

      const repoKey = `${skill.repo}@${skill.ref}`;
      const cloneDir = cloneResults.get(repoKey);

      if (!cloneDir) {
        status = "CLONE_FAILED";
        console.error(`  [CLONE_FAILED] Repo not available: ${skill.repo}`);
      }

      // Resolve the skill directory (symlink-aware)
      let scanDir: string | null = null;
      if (status === "OK" && cloneDir) {
        scanDir = resolveSkillDir(cloneDir, skill.skillPath);
        if (!scanDir) {
          status = "FAILED";
          console.error(`  [FAILED] Skill path not found: ${skill.skillPath} in ${skill.repo}`);
        }
      }

      // Run markdown scan
      if (status === "OK" && scanDir) {
        const mdResult = await runScan(scanDir, "markdown", TIMEOUT_MS);

        if (mdResult.timedOut) {
          status = "TIMEOUT";
          console.error(`  [TIMEOUT] Scan killed after ${TIMEOUT_MS / 1000}s: ${skill.url}`);
        } else if (mdResult.output) {
          markdown = mdResult.output;
          score = parseScore(markdown);
          severity = parseSeverity(markdown);
        } else {
          status = "FAILED";
          console.error(`  [FAILED] Scan returned no output: ${skill.url}`);
        }
      }

      // Run SARIF scan only if not already failed/timed out
      if (status === "OK" && scanDir) {
        const sarifResult = await runScan(scanDir, "sarif", TIMEOUT_MS);
        if (sarifResult.timedOut) {
          status = "TIMEOUT";
          console.error(`  [TIMEOUT] SARIF scan killed after ${TIMEOUT_MS / 1000}s: ${skill.url}`);
        } else if (sarifResult.output) {
          try {
            sarif = JSON.parse(sarifResult.output);
          } catch {
            // ignore parse errors
          }
        }
      }

      const result: ScanResult = { index, skill, status, markdown, score, severity, sarif };
      results[index] = result;
      return result;
    },
  );

  scanFibers.setErrorHandler((e) => {
    console.error(`  [ERROR] ${e?.message ?? e}`);
    return "skip";
  });

  for await (const _ of scanFibers) { /* drain */ }

  // --- Cleanup ---

  rmSync(tmpBase, { recursive: true, force: true });

  // --- Assemble markdown report ---

  const timedOutSkills = results.filter((r) => r?.status === "TIMEOUT");
  const failedSkills = results.filter((r) => r?.status === "FAILED");
  const cloneFailedSkills = results.filter((r) => r?.status === "CLONE_FAILED");
  const okSkills = results.filter((r) => r?.status === "OK");

  const lines: string[] = [];
  lines.push("## SkillSpector Scan Results");
  lines.push("");
  lines.push("| # | Repository | Skill | Score | Severity | Status |");
  lines.push("|---|-----------|-------|-------|----------|--------|");

  for (const r of results) {
    if (!r) continue;
    lines.push(`| ${r.index + 1} | ${r.skill.repo} | ${r.skill.name} | ${r.score} | ${r.severity} | ${r.status} |`);
  }

  // Details for successful scans
  for (const r of results) {
    if (!r || !r.markdown) continue;
    lines.push("");
    lines.push(`<details><summary><code>${r.skill.repo} :: ${r.skill.name}</code> — ${r.severity} (${r.score})</summary>`);
    lines.push("");
    lines.push(stripDetailSections(r.markdown));
    lines.push("");
    lines.push("</details>");
  }

  // Timeout report section
  if (timedOutSkills.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("### Timed Out Skills");
    lines.push("");
    lines.push(`The following ${timedOutSkills.length} skill${timedOutSkills.length === 1 ? "" : "s"} exceeded the ${TIMEOUT_MS / 1000}s timeout:`);
    lines.push("");
    for (const r of timedOutSkills) {
      lines.push(`- ${r.skill.repo} :: ${r.skill.name}`);
    }
  }

  // Clone failures section
  if (cloneFailedSkills.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("### Clone Failures");
    lines.push("");
    lines.push(`The following ${cloneFailedSkills.length} skill${cloneFailedSkills.length === 1 ? "" : "s"} could not be scanned because their repo failed to clone:`);
    lines.push("");
    for (const r of cloneFailedSkills) {
      lines.push(`- ${r.skill.repo} :: ${r.skill.name} — ${r.skill.url}`);
    }
  }

  // Summary
  lines.push("");
  lines.push("---");
  lines.push(`**Scanned: ${results.filter((r) => r).length} | OK: ${okSkills.length} | Failed: ${failedSkills.length} | Clone failed: ${cloneFailedSkills.length} | Timed out: ${timedOutSkills.length}**`);

  writeFileSync(MARKDOWN_OUTPUT, lines.join("\n") + "\n");

  // --- Merge SARIF ---

  const allSarifResults: any[] = [];
  const allRules: any[] = [];
  const ruleIdsSeen = new Set<string>();

  for (const r of results) {
    if (!r?.sarif) continue;
    const sarif = r.sarif as any;
    for (const run of sarif.runs ?? []) {
      allSarifResults.push(...(run.results ?? []));
      for (const rule of run.tool?.driver?.rules ?? []) {
        if (!ruleIdsSeen.has(rule.id)) {
          ruleIdsSeen.add(rule.id);
          allRules.push(rule);
        }
      }
    }
  }

  const merged = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "SkillSpector",
            informationUri: "https://github.com/NVIDIA/skillspector",
            rules: allRules,
          },
        },
        results: allSarifResults,
      },
    ],
  };

  writeFileSync(SARIF_OUTPUT, JSON.stringify(merged, null, 2) + "\n");

  // --- Summary ---

  console.log("");
  console.log(`[INFO] Done. OK: ${okSkills.length}, Failed: ${failedSkills.length}, Clone failed: ${cloneFailedSkills.length}, Timed out: ${timedOutSkills.length}`);
  console.log(`[INFO] SARIF:    ${SARIF_OUTPUT}`);
  console.log(`[INFO] Markdown: ${MARKDOWN_OUTPUT}`);

  if (timedOutSkills.length > 0) {
    console.log("");
    console.log(`[WARN] ${timedOutSkills.length} scan(s) were killed due to timeout:`);
    for (const r of timedOutSkills) {
      console.log(`       - ${r.skill.repo} :: ${r.skill.name}`);
    }
  }

  if (cloneFailedSkills.length > 0) {
    console.log("");
    console.log(`[WARN] ${cloneFailedSkills.length} skill(s) failed due to clone errors:`);
    for (const r of cloneFailedSkills) {
      console.log(`       - ${r.skill.repo} :: ${r.skill.name}`);
    }
  }
}

main();
