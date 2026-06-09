import { describe, expect, test } from "bun:test";
import {
  appendSeparatorCell,
  appendTableCell,
  formatStats,
  manifestHasSecurityRisk,
  parseSkillsFromManifest,
  resolveManifestTargets,
  riskEmojiPrefix,
} from "../eng/skillspector";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

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

describe("skillspector report formatting", () => {
  test("riskEmojiPrefix maps score ranges to emojis", () => {
    expect(riskEmojiPrefix("0")).toBe("");
    expect(riskEmojiPrefix("1")).toBe("🟡 ");
    expect(riskEmojiPrefix("29")).toBe("🟡 ");
    expect(riskEmojiPrefix("30")).toBe("🟠 ");
    expect(riskEmojiPrefix("59")).toBe("🟠 ");
    expect(riskEmojiPrefix("60")).toBe("🔥 ");
    expect(riskEmojiPrefix("89")).toBe("🔥 ");
    expect(riskEmojiPrefix("90")).toBe("☠️ ");
    expect(riskEmojiPrefix("100")).toBe("☠️ ");
    expect(riskEmojiPrefix("1000")).toBe("☠️ ");
    expect(riskEmojiPrefix("n/a")).toBe("");
    expect(riskEmojiPrefix("timeout")).toBe("");
  });

  test("formatStats renders a bullet list with risky-skill percentage", () => {
    const results = [
      { status: "OK", score: "0/100" },
      { status: "OK", score: "42/100" },
      { status: "FAILED" },
      { status: "CLONE_FAILED" },
      { status: "TIMEOUT" },
    ] as Parameters<typeof formatStats>[0];

    expect(formatStats(results)).toBe(
      [
        "📊 Scanned: 5",
        "- Succeeded: 2",
        "- Failed: 1",
        "- Clone failed: 1",
        "- Timed out: 1",
        "- Risky Skills: 1 (20%)",
      ].join("\n"),
    );
  });
});

describe("skillspector manifest targets", () => {
  test("resolveManifestTargets expands globs and accepts literal paths", () => {
    const files = resolveManifestTargets([
      "official/skills/ALL.md",
      "community/skills/ALL.md",
    ]);

    expect(files).toEqual(["community/skills/ALL.md", "official/skills/ALL.md"]);
  });

  test("resolveManifestTargets matches glob patterns", () => {
    const files = resolveManifestTargets(["**/skills/ALL.md"]);

    expect(files).toContain("official/skills/ALL.md");
    expect(files).toContain("community/skills/ALL.md");
  });

  test("parseSkillsFromManifest reads skills from a single manifest file", () => {
    const manifest = "official/skills/ALL.md";
    const content = readFileSync(join(import.meta.dir, "..", manifest), "utf-8");
    const skills = parseSkillsFromManifest(content, manifest);

    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((skill) => skill.manifest === manifest)).toBe(true);
  });

  test("parseSkillsFromManifest preserves distinct manifest attribution for ALL.md basenames", () => {
    const files = resolveManifestTargets([
      "official/skills/ALL.md",
      "community/skills/ALL.md",
    ]);

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
    const files = resolveManifestTargets([
      "no-match-{a,b}.md",
      "official/skills/ALL.md",
    ]);

    expect(files).toEqual(["official/skills/ALL.md"]);
  });

  test("resolveManifestTargets resolves globs from any working directory", () => {
    const cwd = process.cwd();
    try {
      process.chdir(join(import.meta.dir, "..", "eng"));
      const files = resolveManifestTargets(["**/skills/ALL.md"]);
      expect(files).toContain("official/skills/ALL.md");
      expect(files).toContain("community/skills/ALL.md");
    } finally {
      process.chdir(cwd);
    }
  });
});
