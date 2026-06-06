/**
 * eng/skillspector.ts
 *
 * Scans individual skills listed in ALL.md manifests using NVIDIA SkillSpector.
 * 1. Build a list of skills and unique repos to clone.
 * 2. Clone repos (with submodules).
 * 3. Scan each skill directory.
 * 4. Write "Security Risk" column back into each ALL.md (one write per file).
 *
 * Uses ts-fibers for concurrency with per-operation timeout.
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
  name: string;
  url: string;
  repo: string;
  ref: string;
  skillPath: string;
  /** Which manifest file this skill came from */
  manifest: string;
}

interface CloneTarget {
  repo: string;
  ref: string;
  dir: string;
}

export interface ScanResult {
  index: number;
  skill: SkillEntry;
  status: "OK" | "FAILED" | "TIMEOUT" | "CLONE_FAILED";
  markdown: string;
  score: string;
  severity: string;
  sarif: object | null;
}

// --- Helpers ---

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

function parseScore(md: string): string {
  const m = md.match(/Score \| (\d+\/100)/);
  return m?.[1] ?? "-";
}

/** Extract just the number from "XX/100" */
function scoreNumber(score: string): string {
  const m = score.match(/^(\d+)/);
  return m?.[1] ?? "";
}

function parseSeverity(md: string): string {
  const m = md.match(/Severity \| (\w+)/);
  return m?.[1] ?? "-";
}

// ============================================================
// Step 1: Build lists
// ============================================================

function buildLists(tmpBase: string) {
  const skills: SkillEntry[] = [];
  const seen = new Set<string>();

  for (const manifest of MANIFEST_FILES) {
    const filepath = join(REPO_ROOT, manifest);
    if (!existsSync(filepath)) {
      console.warn(`[WARN] Manifest not found: ${filepath}`);
      continue;
    }
    const content = readFileSync(filepath, "utf-8");

    const rowPattern = /\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^)]+))\)/g;
    for (const m of content.matchAll(rowPattern)) {
      const name = m[1];
      const url = m[2];
      const repo = m[3];
      const refAndPath = m[4];

      if (seen.has(url)) continue;
      seen.add(url);

      const slashIdx = refAndPath.indexOf("/");
      const ref = slashIdx >= 0 ? refAndPath.slice(0, slashIdx) : refAndPath;
      const skillPath = slashIdx >= 0 ? refAndPath.slice(slashIdx + 1) : "";

      skills.push({ name, url, repo, ref, skillPath, manifest });
    }
  }

  // Deduplicate repos to clone
  const cloneMap = new Map<string, CloneTarget>();
  for (const s of skills) {
    const key = `${s.repo}@${s.ref}`;
    if (!cloneMap.has(key)) {
      const dir = join(tmpBase, key.replace(/[/@]/g, "_"));
      cloneMap.set(key, { repo: s.repo, ref: s.ref, dir });
    }
  }

  return { skills, cloneTargets: [...cloneMap.values()] };
}

// ============================================================
// Step 2: Clone repos
// ============================================================

async function cloneRepos(targets: CloneTarget[]): Promise<Set<string>> {
  const failed = new Set<string>();

  console.log(`[INFO] Cloning ${targets.length} repos...`);

  const fibers = Fibers.forEach(
    CONCURRENCY,
    targets,
    async (t) => {
      console.log(`  [CLONE] ${t.repo}@${t.ref}`);
      mkdirSync(t.dir, { recursive: true });

      const result = await runCmd([
        "git", "clone", "--depth=1", "--branch", t.ref,
        "--recurse-submodules", "--shallow-submodules",
        `https://github.com/${t.repo}.git`, t.dir,
      ], TIMEOUT_MS);

      if (result.timedOut || result.exitCode !== 0) {
        console.error(`  [FAILED] ${t.repo}@${t.ref}`);
        failed.add(`${t.repo}@${t.ref}`);
      }

      return t;
    },
  );

  fibers.setErrorHandler((e) => {
    console.error(`  [CLONE ERROR] ${e?.message ?? e}`);
    return "skip";
  });

  for await (const _ of fibers) { /* drain */ }

  return failed;
}

// ============================================================
// Step 3: Scan skills
// ============================================================

async function scanSkills(
  skills: SkillEntry[],
  cloneTargets: CloneTarget[],
  failedClones: Set<string>,
): Promise<ScanResult[]> {
  const total = skills.length;
  const results: ScanResult[] = new Array(total);

  // Build a lookup: repo@ref -> dir
  const dirMap = new Map<string, string>();
  for (const t of cloneTargets) {
    dirMap.set(`${t.repo}@${t.ref}`, t.dir);
  }

  console.log(`[INFO] Scanning ${total} skills...`);

  const fibers = Fibers.forEach(
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

      const key = `${skill.repo}@${skill.ref}`;

      if (failedClones.has(key)) {
        status = "CLONE_FAILED";
      } else {
        const scanDir = join(dirMap.get(key)!, skill.skillPath);

        if (!existsSync(scanDir)) {
          status = "FAILED";
          console.error(`  [FAILED] Path not found: ${skill.skillPath}`);
        }

        // Markdown scan
        if (status === "OK") {
          const cmd = ["skillspector", "scan", scanDir, "--format", "markdown"];
          if (NO_LLM) cmd.push("--no-llm");

          const r = await runCmd(cmd, TIMEOUT_MS);
          if (r.timedOut) {
            status = "TIMEOUT";
          } else if (r.stdout) {
            markdown = r.stdout;
            score = parseScore(markdown);
            severity = parseSeverity(markdown);
          } else {
            status = "FAILED";
          }
        }

        // SARIF scan
        if (status === "OK") {
          const cmd = ["skillspector", "scan", scanDir, "--format", "sarif"];
          if (NO_LLM) cmd.push("--no-llm");

          const r = await runCmd(cmd, TIMEOUT_MS);
          if (r.timedOut) {
            status = "TIMEOUT";
          } else if (r.stdout) {
            try { sarif = JSON.parse(r.stdout); } catch { /* ignore */ }
          }
        }
      }

      const result: ScanResult = { index, skill, status, markdown, score, severity, sarif };
      results[index] = result;
      return result;
    },
  );

  fibers.setErrorHandler((e) => {
    console.error(`  [ERROR] ${e?.message ?? e}`);
    return "skip";
  });

  for await (const _ of fibers) { /* drain */ }

  return results;
}

// ============================================================
// Step 4: Update ALL.md files with Security Risk column
// ============================================================

function riskCellValue(result: ScanResult | undefined): string {
  if (!result) return "n/a";
  if (result.status === "TIMEOUT") return "timeout";
  if (result.status === "CLONE_FAILED" || result.status === "FAILED") return "n/a";
  const num = scoreNumber(result.score);
  return num || "n/a";
}

function updateManifests(results: ScanResult[]) {
  // Build a lookup: skill URL -> result
  const resultByUrl = new Map<string, ScanResult>();
  for (const r of results) {
    if (!r) continue;
    resultByUrl.set(r.skill.url, r);
  }

  for (const manifest of MANIFEST_FILES) {
    const filepath = join(REPO_ROOT, manifest);
    if (!existsSync(filepath)) continue;

    const content = readFileSync(filepath, "utf-8");
    const lines = content.split("\n");
    const outLines: string[] = [];

    for (const line of lines) {
      // Detect header row: | Name | Description | Bundled Assets |
      if (/^\|\s*Name\s*\|/.test(line)) {
        outLines.push(line.replace(/\s*\|\s*$/, " | Security Risk |"));
        continue;
      }

      // Detect separator row: | ----|-------------|----------------|
      if (/^\|\s*-+/.test(line) && !/^\|\s*\[/.test(line)) {
        outLines.push(line.replace(/\|\s*$/, "|---|"));
        continue;
      }

      // Detect skill data row: | [name](url) | ... |
      const urlMatch = line.match(/\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/[^)]+)\)/);
      if (urlMatch) {
        const url = urlMatch[2];
        const value = riskCellValue(resultByUrl.get(url));
        outLines.push(line.replace(/\s*\|\s*$/, ` | ${value} |`));
        continue;
      }

      // Non-table lines pass through unchanged
      outLines.push(line);
    }

    // Write the entire file at once
    writeFileSync(filepath, outLines.join("\n"));
    console.log(`[INFO] Updated: ${manifest}`);
  }
}

// ============================================================
// Report
// ============================================================

const SCAN_STATUS_ORDER: Record<string, number> = {
  "Clone failed": 0,
  "Failed": 1,
  "Timed out": 2,
  "Succeeded": 3,
  "no problem": 4,
};

function scanLabel(result: ScanResult): string {
  switch (result.status) {
    case "CLONE_FAILED": return "Clone failed";
    case "FAILED": return "Failed";
    case "TIMEOUT": return "Timed out";
    case "OK": {
      const num = scoreNumber(result.score);
      return num === "0" ? "no problem" : "Succeeded";
    }
  }
}

function riskDisplay(result: ScanResult): string {
  if (result.status === "TIMEOUT") return "timeout";
  if (result.status === "CLONE_FAILED" || result.status === "FAILED") return "n/a";
  return scoreNumber(result.score) || "n/a";
}

function riskSortValue(result: ScanResult): number {
  const raw = riskDisplay(result);
  const num = Number.parseInt(raw, 10);
  return Number.isNaN(num) ? -1 : num;
}

function compareScanResults(a: ScanResult, b: ScanResult): number {
  const statusDiff =
    (SCAN_STATUS_ORDER[scanLabel(a)] ?? 99) - (SCAN_STATUS_ORDER[scanLabel(b)] ?? 99);
  if (statusDiff !== 0) return statusDiff;
  return riskSortValue(b) - riskSortValue(a);
}

function formatScanStats(results: ScanResult[]): string {
  const succeeded = results.filter((r) => r.status === "OK");
  const failed = results.filter((r) => r.status === "FAILED");
  const cloneFailed = results.filter((r) => r.status === "CLONE_FAILED");
  const timedOut = results.filter((r) => r.status === "TIMEOUT");
  return `**Scanned: ${results.length} | Succeeded: ${succeeded.length} | Failed: ${failed.length} | Clone failed: ${cloneFailed.length} | Timed out: ${timedOut.length}**`;
}

function formatReportMarkdown(results: ScanResult[]): string {
  const valid = results.filter((r): r is ScanResult => Boolean(r));
  const lines: string[] = [formatScanStats(valid), ""];

  const byRepo = new Map<string, ScanResult[]>();
  for (const r of valid) {
    const group = byRepo.get(r.skill.repo) ?? [];
    group.push(r);
    byRepo.set(r.skill.repo, group);
  }

  for (const repo of [...byRepo.keys()].sort()) {
    const repoResults = byRepo.get(repo)!;
    lines.push(`## ${repo}`);
    lines.push(formatScanStats(repoResults));
    lines.push("");
    lines.push("| Scan | Risk | Skill |");
    lines.push("|------|------|-------|");

    for (const r of [...repoResults].sort(compareScanResults)) {
      lines.push(`| ${scanLabel(r)} | ${riskDisplay(r)} | ${r.skill.name} |`);
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function writeReport(results: ScanResult[]) {
  const succeeded = results.filter((r) => r?.status === "OK");
  const failed = results.filter((r) => r?.status === "FAILED");
  const cloneFailed = results.filter((r) => r?.status === "CLONE_FAILED");
  const timedOut = results.filter((r) => r?.status === "TIMEOUT");

  writeFileSync(MARKDOWN_OUTPUT, formatReportMarkdown(results.filter((r): r is ScanResult => Boolean(r))));

  // Merge SARIF
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

  writeFileSync(SARIF_OUTPUT, JSON.stringify({
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "SkillSpector", informationUri: "https://github.com/NVIDIA/skillspector", rules: allRules } },
      results: allSarifResults,
    }],
  }, null, 2) + "\n");

  console.log("");
  console.log(`[INFO] Done. Succeeded: ${succeeded.length}, Failed: ${failed.length}, Clone failed: ${cloneFailed.length}, Timed out: ${timedOut.length}`);
  console.log(`[INFO] SARIF:    ${SARIF_OUTPUT}`);
  console.log(`[INFO] Markdown: ${MARKDOWN_OUTPUT}`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  const tmpBase = join(REPO_ROOT, ".skillspector-tmp");
  rmSync(tmpBase, { recursive: true, force: true });
  mkdirSync(tmpBase, { recursive: true });

  // 1. Build lists
  const { skills, cloneTargets } = buildLists(tmpBase);
  console.log(`[INFO] ${skills.length} skills, ${cloneTargets.length} repos, concurrency: ${CONCURRENCY}`);

  // 2. Clone
  const failedClones = await cloneRepos(cloneTargets);

  // 3. Scan
  const results = await scanSkills(skills, cloneTargets, failedClones);

  // 4. Update ALL.md files with Security Risk column
  updateManifests(results);

  // 5. Report
  writeReport(results);

  // Cleanup
  rmSync(tmpBase, { recursive: true, force: true });
}

export {
  compareScanResults,
  formatReportMarkdown,
  riskDisplay,
  scanLabel,
};

if (import.meta.main) {
  main();
}
