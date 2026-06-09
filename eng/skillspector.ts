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
 *                           [--target <glob>]...
 *
 * --target replaces the default manifest list; pass multiple --target
 * flags to scan several paths or glob patterns.
 */

import { Fibers } from "ts-fibers";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { isAbsolute, join, relative, resolve } from "path";
import { Glob, spawn } from "bun";
import { parseArgs } from "util";
import { availableParallelism } from "node:os";

// --- CLI ---

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    sarif: { type: "string", default: "skillspector.sarif" },
    markdown: { type: "string", default: "skillspector-report.md" },
    "no-llm": { type: "boolean", default: false },
    timeout: { type: "string" },
    jobs: { type: "string" },
    target: { type: "string", multiple: true },
  },
  strict: true,
});

const SARIF_OUTPUT = resolve(args.sarif!);
const MARKDOWN_OUTPUT = resolve(args.markdown!);
const NO_LLM = args["no-llm"]!;

const DEFAULT_TIMEOUT_SEC = 180 as const;
const DEFAULT_CONCURRENCY = Math.max(1, availableParallelism());

const TIMEOUT_MS = Number(args.timeout ?? DEFAULT_TIMEOUT_SEC) * 1000;
const CONCURRENCY = Number(args.jobs ?? DEFAULT_CONCURRENCY);

const REPO_ROOT = resolve(import.meta.dir, "..");
const DEFAULT_MANIFEST_TARGETS = [
  "official/skills/ALL.md",
  "community/skills/ALL.md",
];

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

interface ScanResult {
  index: number;
  skill: SkillEntry;
  status: "OK" | "FAILED" | "TIMEOUT" | "CLONE_FAILED";
  markdown: string;
  score: string;
  severity: string;
  sarif: object | null;
}

// --- Helpers ---

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader();
  try {
    while (!(await reader.read()).done) {
      // discard
    }
  } finally {
    reader.releaseLock();
  }
}

async function runCmd(
  cmd: string[],
  timeoutMs: number,
): Promise<{ stdout: string; timedOut: boolean; exitCode: number }> {
  const ac = new AbortController();
  const timeoutPromise = Fibers.delay(timeoutMs, ac);

  const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe" });

  const stdoutPromise = new Response(proc.stdout).text();
  // Consume stderr even when unused to avoid pipe deadlock, but do not
  // buffer it or block successful completion on it.
  const stderrPromise = drainStream(proc.stderr);

  const resultPromise = Promise.all([
    proc.exited,
    stdoutPromise,
  ]).then(([exitCode, stdout]) => ({
    kind: "done" as const,
    exitCode,
    stdout,
  })).catch(() => ({
    kind: "error" as const,
  }));

  const race = await Promise.race([
    resultPromise,
    timeoutPromise.then(() => ({ kind: "timeout" as const })),
  ]);

  if (race.kind === "timeout") {
    proc.kill(9);
    ac.abort();
    void Promise.allSettled([stderrPromise]);
    return { stdout: "", timedOut: true, exitCode: -1 };
  }

  ac.abort();
  void Promise.allSettled([stderrPromise]);

  if (race.kind === "error") {
    return { stdout: "", timedOut: false, exitCode: -1 };
  }

  return { stdout: race.stdout, timedOut: false, exitCode: race.exitCode };
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

function hasGlobChars(pattern: string): boolean {
  return /[*?[\]{}]/.test(pattern);
}

const SKILL_ROW_PATTERN = /\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^)]+))\)/g;

/** Return a repo-relative path when filepath is inside REPO_ROOT. */
function toRepoRelativePath(filepath: string): string | null {
  const resolved = resolve(filepath);
  const rel = relative(REPO_ROOT, resolved);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    return null;
  }
  return rel;
}

/** Expand CLI target patterns (literal paths or globs) to repo-relative manifest files. */
export function resolveManifestTargets(patterns: readonly string[]): string[] {
  const paths = new Set<string>();

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;

    if (hasGlobChars(trimmed)) {
      const glob = new Glob(trimmed);
      const matches = [...glob.scanSync({ cwd: REPO_ROOT, absolute: true })];
      if (matches.length === 0) {
        console.warn(`[WARN] No files matched pattern: ${trimmed}`);
      }
      for (const match of matches) {
        const rel = toRepoRelativePath(match);
        if (rel) {
          paths.add(rel);
        }
      }
      continue;
    }

    const filepath = resolve(REPO_ROOT, trimmed);
    const rel = toRepoRelativePath(filepath);
    if (!rel) {
      console.warn(`[WARN] Target must be inside repository root: ${trimmed}`);
      continue;
    }
    if (existsSync(filepath)) {
      paths.add(rel);
    } else {
      console.warn(`[WARN] Manifest not found: ${filepath}`);
    }
  }

  return [...paths].sort();
}

/** Parse skill rows from a single manifest file. */
export function parseSkillsFromManifest(content: string, manifest: string): SkillEntry[] {
  const skills: SkillEntry[] = [];

  for (const m of content.matchAll(SKILL_ROW_PATTERN)) {
    const name = m[1];
    const url = m[2];
    const repo = m[3];
    const refAndPath = m[4];

    if (!name || !url || !repo || !refAndPath) continue;

    const slashIdx = refAndPath.indexOf("/");
    const ref = slashIdx >= 0 ? refAndPath.slice(0, slashIdx) : refAndPath;
    const skillPath = slashIdx >= 0 ? refAndPath.slice(slashIdx + 1) : "";

    skills.push({ name, url, repo, ref, skillPath, manifest });
  }

  return skills;
}

// ============================================================
// Step 1: Build lists
// ============================================================

function buildLists(tmpBase: string, manifestFiles: readonly string[]) {
  if (manifestFiles.length === 0) {
    console.warn("[WARN] No manifest files to scan");
    return { skills: [], cloneTargets: [] };
  }

  const skills: SkillEntry[] = [];
  const seen = new Set<string>();

  for (const manifest of manifestFiles) {
    const filepath = join(REPO_ROOT, manifest);
    if (!existsSync(filepath)) {
      console.warn(`[WARN] Manifest not found: ${filepath}`);
      continue;
    }

    const content = readFileSync(filepath, "utf-8");
    for (const skill of parseSkillsFromManifest(content, manifest)) {
      if (seen.has(skill.url)) continue;
      seen.add(skill.url);
      skills.push(skill);
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

  for await (const result of fibers) {
    console.log(`  [CLONE] ${result.repo}@${result.ref}`);
  }

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
  const results: ScanResult[] = Array.from({ length: total });

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

  for await (const result of fibers) {
    const num = result.index + 1;
    console.log(`[${num}/${total}] ${result.skill.repo} :: ${result.skill.name}`);
  }

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

const SECURITY_RISK_HEADER = "Security Risk";
const TABLE_SEPARATOR_4COL = "| -----|-------------|----------------|---|";

function trimLineEnd(line: string): string {
  return line.replace(/\s*$/, "");
}

/** Append a new table cell before the closing pipe. */
export function appendTableCell(line: string, cell: string): string {
  const trimmed = trimLineEnd(line);
  if (trimmed.endsWith("|")) {
    return `${trimmed} ${cell} |`;
  }
  return `${trimmed} | ${cell} |`;
}

/** Normalize or append the Security Risk separator cell (literal `---|` suffix). */
export function appendSeparatorCell(line: string): string {
  const trimmed = trimLineEnd(line);
  if (/^\|\s*-----\|-------------\|----------------/.test(trimmed)) {
    return TABLE_SEPARATOR_4COL;
  }
  if (trimmed.endsWith("|")) {
    return `${trimmed}---|`;
  }
  return `${trimmed}|---|`;
}

function replaceLastTableCell(line: string, cell: string): string {
  return trimLineEnd(line).replace(/\|[^|]*\|\s*$/, `| ${cell} |`);
}

function tableColumnCount(line: string): number {
  return line.split("|").map((part) => part.trim()).filter((part) => part.length > 0).length;
}

export function manifestHasSecurityRisk(headerLine: string): boolean {
  return /^\|\s*Name\s*\|.*Security Risk\s*\|/.test(headerLine);
}

function updateManifests(results: ScanResult[], manifestFiles: readonly string[]) {
  // Build a lookup: skill URL -> result
  const resultByUrl = new Map<string, ScanResult>();
  for (const r of results) {
    if (!r) continue;
    resultByUrl.set(r.skill.url, r);
  }

  for (const manifest of manifestFiles) {
    const filepath = join(REPO_ROOT, manifest);
    if (!existsSync(filepath)) continue;

    const content = readFileSync(filepath, "utf-8");
    const lines = content.split("\n");
    const outLines: string[] = [];
    let inSkillsTable = false;

    for (const line of lines) {
      // Detect header row: | Name | Description | Bundled Assets |
      if (/^\|\s*Name\s*\|/.test(line)) {
        inSkillsTable = true;
        if (manifestHasSecurityRisk(line)) {
          outLines.push(line);
        } else {
          outLines.push(appendTableCell(line, SECURITY_RISK_HEADER));
        }
        continue;
      }

      // Detect separator row: | ----|-------------|----------------|
      if (inSkillsTable && /^\|\s*-+/.test(line) && !/^\|\s*\[/.test(line)) {
        outLines.push(appendSeparatorCell(line));
        continue;
      }

      // Detect skill data row: | [name](url) | ... |
      const urlMatch = inSkillsTable
        ? line.match(/\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/[^)]+)\)/)
        : null;
      if (urlMatch) {
        const url = urlMatch[2];
        if (!url) {
          outLines.push(line);
          continue;
        }
        const value = riskCellValue(resultByUrl.get(url));
        if (tableColumnCount(line) >= 4) {
          outLines.push(replaceLastTableCell(line, value));
        } else {
          outLines.push(appendTableCell(line, value));
        }
        continue;
      }

      if (inSkillsTable && !line.startsWith("|")) {
        inSkillsTable = false;
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

function scanLabel(result: ScanResult): string {
  if (result.status === "CLONE_FAILED") return "Clone failed";
  if (result.status === "FAILED") return "Failed";
  if (result.status === "TIMEOUT") return "Timed out";
  if (scoreNumber(result.score) === "0") return "no problem";
  return "Succeeded";
}

/** Lower sorts earlier; "no problem" is last among scan outcomes. */
function scanSortOrder(result: ScanResult): number {
  if (result.status === "CLONE_FAILED") return 0;
  if (result.status === "FAILED") return 1;
  if (result.status === "TIMEOUT") return 2;
  if (scoreNumber(result.score) === "0") return 4;
  return 3;
}

function riskDisplay(result: ScanResult): string {
  if (result.status === "TIMEOUT") return "timeout";
  if (result.status === "CLONE_FAILED" || result.status === "FAILED") return "n/a";
  return scoreNumber(result.score) || "n/a";
}

export function riskEmojiPrefix(risk: string): string {
  if (risk === "n/a" || risk === "timeout" || !risk) return "";
  const n = Number(risk);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 90) return "☠️ ";
  if (n >= 60) return "🔥 ";
  if (n >= 30) return "🟠 ";
  return "🟡 ";
}

function formatRiskCell(result: ScanResult): string {
  const risk = riskDisplay(result);
  return `${riskEmojiPrefix(risk)}${risk}`;
}

function riskSortValue(result: ScanResult): number {
  const risk = riskDisplay(result);
  if (risk === "n/a" || risk === "timeout") return -1;
  const n = Number(risk);
  return Number.isFinite(n) ? n : -1;
}

export function formatStats(results: ScanResult[]): string {
  let timedOut = 0;
  let failed = 0;
  let cloneFailed = 0;
  let succeeded = 0;
  let riskySkills = 0;

  for (const r of results) {
    switch (r?.status) {
      case "TIMEOUT":
        timedOut++;
        break;
      case "FAILED":
        failed++;
        break;
      case "CLONE_FAILED":
        cloneFailed++;
        break;
      case "OK":
        succeeded++;
        {
          const n = Number(scoreNumber(r.score ?? ""));
          if (Number.isFinite(n) && n > 0) {
            riskySkills++;
          }
        }
        break;
    }
  }

  return `📊 Scanned: **${results.length}** | Succeeded: **${succeeded}** | Risky Skills: **${riskySkills}** | Failed: **${failed}** | Clone failed: **${cloneFailed}** | Timed out: **${timedOut}**`;
}

function sortReportResults(results: ScanResult[]): ScanResult[] {
  return [...results].sort((a, b) => {
    const byScan = scanSortOrder(a) - scanSortOrder(b);
    if (byScan !== 0) return byScan;
    return riskSortValue(b) - riskSortValue(a);
  });
}

function isReportable(result: ScanResult): boolean {
  return scanLabel(result) !== "no problem";
}

function writeReport(results: ScanResult[]) {
  const valid = results.filter((r): r is ScanResult => !!r);
  const timedOut = valid.filter((r) => r.status === "TIMEOUT");
  const failed = valid.filter((r) => r.status === "FAILED");
  const cloneFailed = valid.filter((r) => r.status === "CLONE_FAILED");
  const succeeded = valid.filter((r) => r.status === "OK");

  const lines: string[] = [];

  // Total statistics at start (no heading)
  lines.push(formatStats(valid));
  lines.push("");

  // Per-repo sections (only repos with reportable findings)
  const byRepo = new Map<string, { display: string; results: ScanResult[] }>();
  for (const r of valid) {
    const key = r.skill.repo.toLowerCase();
    if (!byRepo.has(key)) {
      byRepo.set(key, { display: r.skill.repo, results: [] });
    }
    byRepo.get(key)!.results.push(r);
  }

  for (const key of [...byRepo.keys()].sort()) {
    const { display: repo, results: repoResults } = byRepo.get(key)!;
    const reportable = sortReportResults(repoResults.filter(isReportable));
    if (reportable.length === 0) continue;

    lines.push(`# ${repo}`);
    lines.push("");
    lines.push(formatStats(repoResults));
    lines.push("");
    lines.push("| Risk | Skill | Scan |");
    lines.push("|------|-------|------|");

    for (const r of reportable) {
      lines.push(`| ${formatRiskCell(r)} | ${r.skill.name} | ${scanLabel(r)} |`);
    }

    lines.push("");
  }

  writeFileSync(MARKDOWN_OUTPUT, lines.join("\n") + "\n");

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
  const manifestFiles = resolveManifestTargets(
    args.target?.length ? args.target : DEFAULT_MANIFEST_TARGETS,
  );
  console.log(`[INFO] Manifest targets (${manifestFiles.length}): ${manifestFiles.join(", ")}`);

  const tmpBase = join(REPO_ROOT, ".skillspector-tmp");
  rmSync(tmpBase, { recursive: true, force: true });
  mkdirSync(tmpBase, { recursive: true });

  // 1. Build lists
  const { skills, cloneTargets } = buildLists(tmpBase, manifestFiles);
  console.log(`[INFO] ${skills.length} skills, ${cloneTargets.length} repos, concurrency: ${CONCURRENCY}`);

  // 2. Clone
  const failedClones = await cloneRepos(cloneTargets);

  // 3. Scan
  const results = await scanSkills(skills, cloneTargets, failedClones);

  // 4. Update ALL.md files with Security Risk column
  updateManifests(results, manifestFiles);

  // 5. Report
  writeReport(results);

  // Cleanup
  rmSync(tmpBase, { recursive: true, force: true });
}

if (import.meta.main) {
  main();
}
