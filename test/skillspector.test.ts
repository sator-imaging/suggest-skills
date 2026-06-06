import { describe, expect, test } from "bun:test";
import {
  compareScanResults,
  formatReportMarkdown,
  riskDisplay,
  scanLabel,
  type ScanResult,
} from "../eng/skillspector";

function makeResult(overrides: Partial<ScanResult> & Pick<ScanResult, "index" | "skill">): ScanResult {
  return {
    status: "OK",
    markdown: "",
    score: "0/100",
    severity: "LOW",
    sarif: null,
    ...overrides,
  };
}

describe("skillspector manifest table columns", () => {
  test("appends a separator cell at the end of the header divider row", () => {
    const line = "| -----|-------------|----------------|";
    expect(line.replace(/\|\s*$/, "|---|")).toBe("| -----|-------------|----------------|---|");
  });
});

describe("skillspector report", () => {
  test("uses Succeeded instead of OK and no problem for zero-risk scans", () => {
    const results = [
      makeResult({
        index: 0,
        skill: {
          name: "safe",
          url: "https://github.com/octo/demo/tree/main/skills/safe",
          repo: "octo/demo",
          ref: "main",
          skillPath: "skills/safe",
          manifest: "official/skills/ALL.md",
        },
        score: "0/100",
      }),
      makeResult({
        index: 1,
        skill: {
          name: "risky",
          url: "https://github.com/octo/demo/tree/main/skills/risky",
          repo: "octo/demo",
          ref: "main",
          skillPath: "skills/risky",
          manifest: "official/skills/ALL.md",
        },
        score: "42/100",
      }),
    ];

    expect(scanLabel(results[0]!)).toBe("no problem");
    expect(scanLabel(results[1]!)).toBe("Succeeded");
  });

  test("sorts by scan status with no problem last, then risk descending", () => {
    const results = [
      makeResult({
        index: 0,
        skill: {
          name: "safe",
          url: "https://github.com/octo/demo/tree/main/skills/safe",
          repo: "octo/demo",
          ref: "main",
          skillPath: "skills/safe",
          manifest: "official/skills/ALL.md",
        },
        score: "0/100",
      }),
      makeResult({
        index: 1,
        status: "FAILED",
        skill: {
          name: "broken",
          url: "https://github.com/octo/demo/tree/main/skills/broken",
          repo: "octo/demo",
          ref: "main",
          skillPath: "skills/broken",
          manifest: "official/skills/ALL.md",
        },
      }),
      makeResult({
        index: 2,
        skill: {
          name: "high",
          url: "https://github.com/octo/demo/tree/main/skills/high",
          repo: "octo/demo",
          ref: "main",
          skillPath: "skills/high",
          manifest: "official/skills/ALL.md",
        },
        score: "80/100",
      }),
      makeResult({
        index: 3,
        skill: {
          name: "medium",
          url: "https://github.com/octo/demo/tree/main/skills/medium",
          repo: "octo/demo",
          ref: "main",
          skillPath: "skills/medium",
          manifest: "official/skills/ALL.md",
        },
        score: "25/100",
      }),
    ];

    const sorted = [...results].sort(compareScanResults).map((r) => r.skill.name);
    expect(sorted).toEqual(["broken", "high", "medium", "safe"]);
  });

  test("groups markdown report by repo with total stats first", () => {
    const results = [
      makeResult({
        index: 0,
        skill: {
          name: "alpha",
          url: "https://github.com/octo/demo/tree/main/skills/alpha",
          repo: "octo/demo",
          ref: "main",
          skillPath: "skills/alpha",
          manifest: "official/skills/ALL.md",
        },
        score: "10/100",
      }),
      makeResult({
        index: 1,
        skill: {
          name: "beta",
          url: "https://github.com/acme/tools/tree/main/skills/beta",
          repo: "acme/tools",
          ref: "main",
          skillPath: "skills/beta",
          manifest: "community/skills/ALL.md",
        },
        score: "0/100",
      }),
    ];

    const report = formatReportMarkdown(results);

    expect(report.startsWith("**Scanned: 2 | Succeeded: 2 | Failed: 0 | Clone failed: 0 | Timed out: 0**")).toBe(true);
    expect(report).toContain("## acme/tools");
    expect(report).toContain("## octo/demo");
    expect(report.indexOf("## acme/tools")).toBeLessThan(report.indexOf("## octo/demo"));
    expect(report).toContain("| Scan | Risk | Skill |");
    expect(report).toContain("| Succeeded | 10 | alpha |");
    expect(report).toContain("| no problem | 0 | beta |");
    expect(report).not.toContain("| # |");
    expect(report).not.toContain("| OK |");
    expect(riskDisplay(results[0]!)).toBe("10");
  });
});
