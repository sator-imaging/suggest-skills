import { describe, expect, test } from "bun:test";
import {
  appendSeparatorCell,
  appendTableCell,
  formatStats,
  manifestHasSecurityRisk,
  parseScanJson,
  parseSkillsFromManifest,
  resolveManifestTargets,
  riskCellValue,
  riskEmojiPrefix,
} from "../eng/skillspector";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

type ScanResultArg = NonNullable<Parameters<typeof riskCellValue>[0]>;

function makeScanResult(
  overrides: Omit<Partial<ScanResultArg>, "skill"> & {
    skill?: Partial<ScanResultArg["skill"]>;
  } & Pick<ScanResultArg, "status">,
): ScanResultArg {
  return {
    index: 0,
    score: "-",
    severity: "-",
    recommendation: "-",
    sarif: null,
    ...overrides,
    skill: {
      name: "test-skill",
      url: "https://github.com/o/r/tree/main/skills/test",
      repo: "o/r",
      ref: "main",
      skillPath: "skills/test",
      manifest: "test.skills.md",
      ...overrides.skill,
    },
  };
}

describe("skillspector manifest table helpers", () => {
  test("appendSeparatorCell appends ---| after trailing pipe", () => {
    const line = "| -----|-------------|----------------|";
    expect(appendSeparatorCell(line)).toBe("| -----|-------------|----------------|---|");
  });

  test("appendSeparatorCell fixes the broken insert-before-pipe pattern", () => {
    const broken = "| -----|-------------|-------------------|";
    const fixed = "| -----|-------------|----------------|---|";
    expect(appendSeparatorCell("| -----|-------------|----------------|")).toBe(fixed);
    expect(appendSeparatorCell(broken)).toBe(fixed);
  });

  test("appendTableCell appends a data column", () => {
    const line = "| [skill](https://github.com/o/r/tree/main/s) | desc | None |";
    expect(appendTableCell(line, "42")).toBe(
      "| [skill](https://github.com/o/r/tree/main/s) | desc | None | 42 |",
    );
  });

  test("manifestHasSecurityRisk detects an existing column on the header row", () => {
    expect(manifestHasSecurityRisk("| Name | Description | Bundled Assets | Security Risk |")).toBe(true);
    expect(manifestHasSecurityRisk("| Name | Description | Bundled Assets |")).toBe(false);
  });
});

describe("skillspector scan json parsing", () => {
  const sampleJson = JSON.stringify({
    risk_assessment: {
      score: 26,
      severity: "MEDIUM",
      recommendation: "CAUTION",
    },
  });

  test("parseScanJson reads risk fields from JSON output", () => {
    expect(parseScanJson(sampleJson)).toEqual({
      score: "26/100",
      severity: "MEDIUM",
      recommendation: "CAUTION",
    });
    expect(parseScanJson(JSON.stringify({
      risk_assessment: { score: 100, severity: "CRITICAL", recommendation: "DO_NOT_INSTALL" },
    }))).toEqual({
      score: "100/100",
      severity: "CRITICAL",
      recommendation: "DO NOT INSTALL",
    });
    expect(parseScanJson(JSON.stringify({
      risk_assessment: { score: 0, severity: "LOW", recommendation: "SAFE" },
    }))).toEqual({
      score: "0/100",
      severity: "LOW",
      recommendation: "SAFE",
    });
    expect(parseScanJson("not json")).toEqual({
      score: "-",
      severity: "-",
      recommendation: "-",
    });
  });

  test("riskCellValue includes score and recommendation", () => {
    const ok = makeScanResult({
      status: "OK",
      score: "26/100",
      recommendation: "CAUTION",
    });

    expect(riskCellValue(ok)).toBe("26 (CAUTION)");
    expect(riskCellValue({ ...ok, score: "100/100", severity: "CRITICAL", recommendation: "DO NOT INSTALL" })).toBe(
      "100 CRITICAL (DO NOT INSTALL)",
    );
    expect(riskCellValue({ ...ok, severity: "MEDIUM", recommendation: "-" })).toBe("26 MEDIUM");
    expect(riskCellValue(makeScanResult({ status: "OK", score: "26/100" }))).toBe("26");
    expect(riskCellValue(makeScanResult({ status: "TIMEOUT", score: "26/100", recommendation: "CAUTION" }))).toBe(
      "timeout",
    );
    expect(riskCellValue(undefined)).toBe("n/a");
  });
});

describe("skillspector report formatting", () => {
  test("riskEmojiPrefix maps score ranges to emojis", () => {
    expect(riskEmojiPrefix("0")).toBe("");
    expect(riskEmojiPrefix("1")).toBe("🟡 ");
    expect(riskEmojiPrefix("20")).toBe("🟡 ");
    expect(riskEmojiPrefix("21")).toBe("🟠 ");
    expect(riskEmojiPrefix("50")).toBe("🟠 ");
    expect(riskEmojiPrefix("51")).toBe("🔥 ");
    expect(riskEmojiPrefix("80")).toBe("🔥 ");
    expect(riskEmojiPrefix("81")).toBe("☠️ ");
    expect(riskEmojiPrefix("100")).toBe("☠️ ");
    expect(riskEmojiPrefix("1000")).toBe("☠️ ");
    expect(riskEmojiPrefix("n/a")).toBe("");
    expect(riskEmojiPrefix("timeout")).toBe("");
  });

  test("formatStats renders advisory and dangerous skill percentages", () => {
    const results = [
      makeScanResult({ status: "OK", score: "0/100" }),
      makeScanResult({ status: "OK", score: "10/100" }),
      makeScanResult({ status: "OK", score: "42/100" }),
      makeScanResult({ status: "FAILED" }),
      makeScanResult({ status: "CLONE_FAILED" }),
      makeScanResult({ status: "TIMEOUT" }),
    ];

    expect(formatStats(results)).toBe(
      [
        "📊 Scanned: 6",
        "- Succeeded: 3",
        "- Failed: 1",
        "- Clone failed: 1",
        "- Timed out: 1",
        "- Advisory Skills: 1 (17%)",
        "- Dangerous Skills: 1 (17%)",
      ].join("\n"),
    );
  });
});

describe("skillspector manifest targets", () => {
  const officialManifest = "official/skills/anthropics.skills.md";
  const communityManifest = "community/skills/mattpocock.skills.md";

  test("resolveManifestTargets expands globs and accepts literal paths", () => {
    const files = resolveManifestTargets([officialManifest, communityManifest]);

    expect(files).toEqual([communityManifest, officialManifest]);
  });

  test("resolveManifestTargets matches glob patterns", () => {
    const files = resolveManifestTargets(["**/skills/*.skills.md"]);

    expect(files).toContain(officialManifest);
    expect(files).toContain(communityManifest);
  });

  test("parseSkillsFromManifest reads skills from a single manifest file", () => {
    const content = readFileSync(join(import.meta.dir, "..", officialManifest), "utf-8");
    const skills = parseSkillsFromManifest(content, officialManifest);

    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((skill) => skill.manifest === officialManifest)).toBe(true);
  });

  test("parseSkillsFromManifest preserves distinct manifest attribution across files", () => {
    const files = resolveManifestTargets([officialManifest, communityManifest]);

    for (const manifest of files) {
      const content = readFileSync(join(import.meta.dir, "..", manifest), "utf-8");
      const skills = parseSkillsFromManifest(content, manifest);

      expect(skills.length).toBeGreaterThan(0);
      expect(skills.every((skill) => skill.manifest === manifest)).toBe(true);
    }
  });

  test("resolveManifestTargets rejects paths outside repository root", () => {
    expect(resolveManifestTargets(["../../../package.json"])).toEqual([]);
  });

  test("resolveManifestTargets rejects directories", () => {
    expect(resolveManifestTargets(["official/skills"])).toEqual([]);
  });

  test("resolveManifestTargets ignores node_modules paths", () => {
    const fakeManifest = join("node_modules", ".skillspector-test", "ALL.md");
    const abs = join(import.meta.dir, "..", fakeManifest);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "| Name | Description |\n");

    try {
      expect(resolveManifestTargets([fakeManifest])).toEqual([]);
      expect(resolveManifestTargets(["**/.skillspector-test/ALL.md"])).toEqual([]);
    } finally {
      rmSync(dirname(abs), { recursive: true, force: true });
    }
  });

  test("resolveManifestTargets continues after unmatched glob patterns", () => {
    const files = resolveManifestTargets(["no-match-{a,b}.md", officialManifest]);

    expect(files).toEqual([officialManifest]);
  });

  test("resolveManifestTargets resolves globs from any working directory", () => {
    const cwd = process.cwd();
    try {
      process.chdir(join(import.meta.dir, "..", "eng"));
      const files = resolveManifestTargets(["**/skills/*.skills.md"]);
      expect(files).toContain(officialManifest);
      expect(files).toContain(communityManifest);
    } finally {
      process.chdir(cwd);
    }
  });
});
