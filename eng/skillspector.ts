/**
 * eng/skillspector.ts
 *
 * Scans repositories listed in ALL.md manifests using NVIDIA SkillSpector.
 * Uses ts-fibers for concurrent scanning with per-scan timeout (AbortController + process kill).
 *
 * Usage:
 *   bun eng/skillspector.ts [--sarif <path>] [--markdown <path>] [--no-llm]
 *                           [--timeout <seconds>] [--jobs <n>]
 */

import { Fibers } from "ts-fibers";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
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

const SARIF_OUTPUT  = resolve(args.sarif!);
const MARKDOWN_OUTPUT = resolve(args.markdown!);
const NO_LLM       = args["no-llm"]!;
const TIMEOUT_MS   = Number(args.timeout ?? 180) * 1000;
const CONCURRENCY  = Number(args.jobs ?? 3);

const REPO_ROOT = resolve(import.meta.dir, "..");
const MANIFEST_FILES = ["official/skills/ALL.md", "community/skills/ALL.md"];

// --- Types ---

interface ScanResult {
  index: number;
  url: string;
  status: "OK" | "FAILED" | "TIMEOUT";
  markdown: string;
  score: string;
  severity: string;
  sarif: object | null;
}

// --- Extract repo URLs from manifests ---

function extractRepoUrls(): string[] {
  const urls = new Set<string>();
  for (const manifest of MANIFEST_FILES) {
    const filepath = join(REPO_ROOT, manifest);
    if (!existsSync(filepath)) {
      console.warn(`[WARN] Manifest not found: ${filepath}`);
      continue;
    }
    const content = readFileSync(filepath, "utf-8");
    const matches = content.matchAll(/\(https:\/\/github\.com\/([^)]+)\)/g);
    for (const m of matches) {
      // Normalize to repo root: owner/repo
      const parts = m[1].split("/");
      if (parts.length >= 2) {
        urls.add(`https://github.com/${parts[0]}/${parts[1]}`);
      }
    }
  }
  return [...urls].sort();
}

// --- Run a single scan with timeout ---

async function runScan(
  url: string,
  format: "markdown" | "sarif",
  timeoutMs: number,
): Promise<{ output: string; timedOut: boolean; exitCode: number }> {
  const cmdArgs = ["scan", url, "--format", format];
  if (NO_LLM) cmdArgs.push("--no-llm");

  const ac = new AbortController();
  let timedOut = false;
  let proc: Subprocess | undefined;

  // Start timeout race
  const timeoutPromise = Fibers.delay(timeoutMs, ac);

  proc = spawn(["skillspector", ...cmdArgs], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Race: process completion vs timeout
  const procDone = proc.exited.then((code) => ({ kind: "done" as const, code }));
  const timeoutDone = timeoutPromise.then(() => ({ kind: "timeout" as const, code: -1 }));

  const race = await Promise.race([procDone, timeoutDone]);

  if (race.kind === "timeout") {
    timedOut = true;
    // Kill the process tree
    proc.kill(9); // SIGKILL — forcefully stop
    return { output: "", timedOut: true, exitCode: -1 };
  }

  // Process finished before timeout — cancel the timer
  ac.abort();

  const stdout = await new Response(proc.stdout).text();
  return { output: stdout, timedOut: false, exitCode: race.code };
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

// --- Main ---

async function main() {
  const urls = extractRepoUrls();
  const total = urls.length;

  if (total === 0) {
    console.warn("[WARN] No repositories found.");
    process.exit(0);
  }

  console.log(`[INFO] Found ${total} unique repositories to scan`);
  console.log(`[INFO] Concurrency: ${CONCURRENCY}, Timeout: ${TIMEOUT_MS / 1000}s per scan`);

  const results: ScanResult[] = new Array(total);

  const fibers = Fibers.forEach(
    CONCURRENCY,
    urls.map((url, i) => ({ url, index: i })),
    async (item) => {
      const { url, index } = item;
      const num = index + 1;
      console.log(`[${num}/${total}] ${url}`);

      let status: ScanResult["status"] = "OK";
      let markdown = "";
      let score = "-";
      let severity = "-";
      let sarif: object | null = null;

      // Run markdown scan
      const mdResult = await runScan(url, "markdown", TIMEOUT_MS);

      if (mdResult.timedOut) {
        status = "TIMEOUT";
        console.error(`  [TIMEOUT] Killed after ${TIMEOUT_MS / 1000}s: ${url}`);
      } else if (mdResult.output) {
        markdown = mdResult.output;
        score = parseScore(markdown);
        severity = parseSeverity(markdown);
      } else {
        status = "FAILED";
        console.error(`  [FAILED] ${url}`);
      }

      // Run SARIF scan only if not timed out
      if (status !== "TIMEOUT") {
        const sarifResult = await runScan(url, "sarif", TIMEOUT_MS);
        if (sarifResult.timedOut) {
          status = "TIMEOUT";
          console.error(`  [TIMEOUT] SARIF scan killed after ${TIMEOUT_MS / 1000}s: ${url}`);
        } else if (sarifResult.output) {
          try {
            sarif = JSON.parse(sarifResult.output);
          } catch {
            // ignore parse errors
          }
        }
      }

      const result: ScanResult = { index, url, status, markdown, score, severity, sarif };
      results[index] = result;
      return result;
    },
  );

  fibers.setErrorHandler((e, _fibers, _reason) => {
    console.error(`  [ERROR] ${e?.message ?? e}`);
    return "skip";
  });

  // Consume all results
  for await (const _result of fibers) {
    // results are stored in the array by index inside the factory
  }

  // --- Assemble markdown report ---

  const timedOutRepos = results.filter((r) => r?.status === "TIMEOUT");
  const failedRepos = results.filter((r) => r?.status === "FAILED");
  const okRepos = results.filter((r) => r?.status === "OK");

  const lines: string[] = [];
  lines.push("## SkillSpector Scan Results");
  lines.push("");
  lines.push("| # | Repository | Score | Severity | Status |");
  lines.push("|---|-----------|-------|----------|--------|");

  for (const r of results) {
    if (!r) continue;
    lines.push(`| ${r.index + 1} | ${r.url} | ${r.score} | ${r.severity} | ${r.status} |`);
  }

  // Details for successful scans
  for (const r of results) {
    if (!r || !r.markdown) continue;
    lines.push("");
    lines.push(`<details><summary><code>${r.url}</code> — ${r.severity} (${r.score})</summary>`);
    lines.push("");
    lines.push(r.markdown);
    lines.push("");
    lines.push("</details>");
  }

  // Timeout report section
  if (timedOutRepos.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("### Timed Out Repositories");
    lines.push("");
    lines.push(`The following ${timedOutRepos.length} repositor${timedOutRepos.length === 1 ? "y" : "ies"} exceeded the ${TIMEOUT_MS / 1000}s timeout and ${timedOutRepos.length === 1 ? "was" : "were"} killed:`);
    lines.push("");
    for (const r of timedOutRepos) {
      lines.push(`- ${r.url}`);
    }
  }

  // Summary
  lines.push("");
  lines.push("---");
  lines.push(`**Scanned: ${results.filter((r) => r).length} | OK: ${okRepos.length} | Failed: ${failedRepos.length} | Timed out: ${timedOutRepos.length}**`);

  writeFileSync(MARKDOWN_OUTPUT, lines.join("\n") + "\n");

  // --- Merge SARIF ---

  const allResults: any[] = [];
  const allRules: any[] = [];
  const ruleIdsSeen = new Set<string>();

  for (const r of results) {
    if (!r?.sarif) continue;
    const sarif = r.sarif as any;
    for (const run of sarif.runs ?? []) {
      allResults.push(...(run.results ?? []));
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
        results: allResults,
      },
    ],
  };

  writeFileSync(SARIF_OUTPUT, JSON.stringify(merged, null, 2) + "\n");

  // --- Summary ---

  console.log("");
  console.log(`[INFO] Done. OK: ${okRepos.length}, Failed: ${failedRepos.length}, Timed out: ${timedOutRepos.length}`);
  console.log(`[INFO] SARIF:    ${SARIF_OUTPUT}`);
  console.log(`[INFO] Markdown: ${MARKDOWN_OUTPUT}`);

  if (timedOutRepos.length > 0) {
    console.log("");
    console.log(`[WARN] ${timedOutRepos.length} scan(s) were killed due to timeout:`);
    for (const r of timedOutRepos) {
      console.log(`       - ${r.url}`);
    }
  }
}

main();
