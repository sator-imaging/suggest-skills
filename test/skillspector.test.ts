import { describe, expect, test } from "bun:test";
import {
  appendSeparatorCell,
  appendTableCell,
  buildVirtualManifest,
  formatStats,
  manifestHasSecurityRisk,
  resolveManifestTargets,
  riskEmojiPrefix,
} from "../eng/skillspector";

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

  test("formatStats bolds numbers and adds a chart emoji prefix", () => {
    const results = [
      { status: "OK", score: "0/100" },
      { status: "OK", score: "42/100" },
      { status: "FAILED" },
      { status: "CLONE_FAILED" },
      { status: "TIMEOUT" },
    ] as Parameters<typeof formatStats>[0];

    expect(formatStats(results)).toBe(
      "📊 Scanned: **5** | Succeeded: **2** | Risky Skills: **1** | Failed: **1** | Clone failed: **1** | Timed out: **1**",
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

  test("buildVirtualManifest concatenates files with section headers", () => {
    const files = resolveManifestTargets(["official/skills/ALL.md"]);
    const virtual = buildVirtualManifest(files);

    expect(virtual.startsWith("# ALL\n\n")).toBe(true);
    expect(virtual).toContain("| Name | Description |");
  });
});
