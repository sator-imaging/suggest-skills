import { describe, expect, test } from "bun:test";
import {
  appendTableColumnSeparator,
  formatStatsLine,
  riskDisplay,
  scanLabel,
  sortReportResults,
  type ScanResult,
} from "../eng/skillspector.ts";

function makeResult(overrides: Partial<ScanResult> & Pick<ScanResult, "index" | "skill">): ScanResult {
  return {
    status: "OK",
    markdown: "",
    score: "0/100",
    severity: "-",
    sarif: null,
    ...overrides,
  };
}

describe("appendTableColumnSeparator", () => {
  test("appends ---| at line end instead of inserting before the trailing pipe", () => {
    const line = "| -----|-------------|----------------|";
    expect(appendTableColumnSeparator(line)).toBe("| -----|-------------|----------------|---|");
  });
});

describe("scanLabel", () => {
  test("maps OK with zero risk to no problem and other OK results to Completed", () => {
    const base = makeResult({
      index: 0,
      skill: {
        name: "alpha",
        url: "https://github.com/octo/demo/tree/main/skills/alpha",
        repo: "octo/demo",
        ref: "main",
        skillPath: "skills/alpha",
        manifest: "official/skills/ALL.md",
      },
    });

    expect(scanLabel({ ...base, score: "0/100" })).toBe("no problem");
    expect(scanLabel({ ...base, score: "42/100" })).toBe("Completed");
    expect(scanLabel({ ...base, status: "FAILED" })).toBe("Failed");
    expect(scanLabel({ ...base, status: "TIMEOUT" })).toBe("Timed out");
    expect(scanLabel({ ...base, status: "CLONE_FAILED" })).toBe("Clone failed");
  });
});

describe("sortReportResults", () => {
  test("orders by scan status with no problem last, then risk descending", () => {
    const skill = {
      name: "skill",
      url: "https://github.com/octo/demo/tree/main/skills/skill",
      repo: "octo/demo",
      ref: "main",
      skillPath: "skills/skill",
      manifest: "official/skills/ALL.md",
    };

    const results = sortReportResults([
      makeResult({ index: 0, skill, score: "0/100" }),
      makeResult({ index: 1, skill, score: "10/100" }),
      makeResult({ index: 2, skill, score: "50/100" }),
      makeResult({ index: 3, skill, status: "FAILED" }),
      makeResult({ index: 4, skill, status: "TIMEOUT" }),
    ]);

    expect(results.map((r) => scanLabel(r))).toEqual([
      "Failed",
      "Timed out",
      "Completed",
      "Completed",
      "no problem",
    ]);
    const completed = results.filter((r) => scanLabel(r) === "Completed");
    expect(completed.map((r) => riskDisplay(r))).toEqual(["50", "10"]);
  });
});

describe("formatStatsLine", () => {
  test("uses Completed instead of OK in summary stats", () => {
    const skill = {
      name: "skill",
      url: "https://github.com/octo/demo/tree/main/skills/skill",
      repo: "octo/demo",
      ref: "main",
      skillPath: "skills/skill",
      manifest: "official/skills/ALL.md",
    };

    const line = formatStatsLine([
      makeResult({ index: 0, skill, score: "12/100" }),
      makeResult({ index: 1, skill, score: "0/100" }),
      makeResult({ index: 2, skill, status: "FAILED" }),
    ]);

    expect(line).toContain("Completed: 1");
    expect(line).toContain("No problem: 1");
    expect(line).not.toContain("OK:");
  });
});
