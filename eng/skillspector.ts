/**
 * eng/skillspector.ts
 *
 * Scans individual skills listed in ALL.md manifests using NVIDIA SkillSpector.
 * Each unique repo is cloned once (with submodules), then each skill's path
 * (derived from the manifest URL) is scanned individually.
 *
 * Uses ts-fibers for concurrent scanning with per-scan timeout (AbortController + process kill).
 *
 * Usage:
 *   bun eng/skillspector.ts [--sarif <path>] [--markdown <path>] [--no-llm]
 *                           [--timeout <seconds>] [--jobs <n>]
 */

import { Fibers } from "ts-fibers";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "bun";
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

// --- Run a command with timeout ---

async function runCmd(
  cmd: string[],
  timeoutMs: number,
): Promise<{ stdout: string; timedOut: boolean; exitCode: number }> {
  const ac = new AbortController();
  const timeoutPromise = Fibers.delay(timeoutMs, ac);

  const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe" });

  const stdoutPromise = new Response(proc.stdout).text()
    .then((text) => ({ kind: "done" as const, text }));
  const timeoutDone = timeoutPromise
    .then(() => ({ kind: "timeout" as const, text: "" }));

  const race = await Promise.race([stdoutPromise, timeoutDone]);

  if (race.kind === "timeout") {
    proc.kill(9);
    return { stdout: "", timedOut: true, exitCode: -1 };
  }

  ac.abort();
  return { stdout: race.text, timedOut: false, exitCode: proc.exitCode ?? 0 };
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

  const tmpBase = join(REPO_ROOT, ".skillspector-tmp");
  rmSync(tmpBase, { recursive: true, force: true });
  mkdirSync(tmpBase, { recursive: true });

  // --- Clone each unique repo once ---

  const repoKeys = [...new Set(skills.map((s) => `${s.repo}@${s.ref}`))];
  const cloneDirs = new Map<string, string | null>();

  console.log(`[INFO] Cloning ${repoKeys.length} unique repos...`);

  const cloneFibers = Fibers.forEach(
    CONCURRENCY,
    repoKeys,
    async (key) => {
      const [repo, ref] = key.split("@") as [string, string];
      const dir = join(tmpBase, key.replace(/[/@]/g, "_"));

      console.log(`  [CLONE] ${key}`);
      const result = await runCmd([
        "git", "clone", "--depth=1", "--branch", ref,
        "--recurse-submodules", "--shallow-submodules",
        `https://github.com/${repo}.git`, dir,
      ], TIMEOUT_MS);

      if (result.timedOut || result.exitCode !== 0) {
        console.error(`  [FAILED] ${key}`);
        cloneDirs.set(key, null);
      } else {
        cloneDirs.set(key, dir);
      }

      return key;
    },
  );

  cloneFibers.setErrorHandler((e) => {
    console.error(`  [CLONE ERROR] ${e?.message ?? e}`);
    return "skip";
  });

  for await (const _ of cloneFibers) { /* drain */ }

  // --- Scan each skill ---

  console.log(`[INFO] Scanning ${total} skills...`);

  const results: ScanResult[] = new Array(total);

  const scanFibers = Fibers.forEach(
    CONCURRENCY,
    skills.map((skill, i) => ({ skill, index: i })),
    async ({ skill, index }) => {
      const num = index + 1;
      console.log(`[${num}/${total}] ${skill.repo} :: ${skill.name}`);

      let status: ScanResult["status"] = "OK";
      let markdown = "";
      let score = "-";
      let severity = "-";
      let sarif: object | null = null;

      const cloneDir = cloneDirs.get(`${skill.repo}@${skill.ref}`);

      if (!cloneDir) {
        status = "CLONE_FAILED";
      } else {
        // Derive local path directly from the URL
        const scanDir = join(cloneDir, skill.skillPath);

        if (!existsSync(scanDir)) {
          status = "FAILED";
          console.error(`  [FAILED] Path not found: ${skill.skillPath}`);
        }

        // Markdown scan
        if (status === "OK") {
          const scanArgs = ["skillspector", "scan", scanDir, "--format", "markdown"];
          if (NO_LLM) scanArgs.push("--no-llm");

          const mdResult = await runCmd(scanArgs, TIMEOUT_MS);

          if (mdResult.timedOut) {
            status = "TIMEOUT";
            console.error(`  [TIMEOUT] ${TIMEOUT_MS / 1000}s`);
          } else if (mdResult.stdout) {
            markdown = mdResult.stdout;
            score = parseScore(markdown);
            severity = parseSeverity(markdown);
          } else {
            status = "FAILED";
            console.error(`  [FAILED] No output`);
          }
        }

        // SARIF scan
        if (status === "OK") {
          const sarifArgs = ["skillspector", "scan", scanDir, "--format", "sarif"];
          if (NO_LLM) sarifArgs.push("--no-llm");

          const sarifResult = await runCmd(sarifArgs, TIMEOUT_MS);
          if (sarifResult.timedOut) {
            status = "TIMEOUT";
          } else if (sarifResult.stdout) {
            try { sarif = JSON.parse(sarifResult.stdout); } catch { /* ignore */ }
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

  if (timedOutSkills.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("### Timed Out Skills");
    lines.push("");
    for (const r of timedOutSkills) {
      lines.push(`- ${r.skill.repo} :: ${r.skill.name}`);
    }
  }

  if (cloneFailedSkills.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("### Clone Failures");
    lines.push("");
    for (const r of cloneFailedSkills) {
      lines.push(`- ${r.skill.repo} :: ${r.skill.name} — ${r.skill.url}`);
    }
  }

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
}

main();
