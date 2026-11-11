import { describe, expect, test } from "bun:test";
import {
  parseSkillsFromContent,
  formatSkillDiffReport,
  type SkillDiffResult,
} from "../eng/diff-skills";

describe("diff-skills", () => {
  test("parseSkillsFromContent parses skills correctly", () => {
    const sampleManifest = `
| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [skill-a](https://github.com/octo/skills/tree/commit1/path/to/skill-a) | Description for skill A | None | 0 (SAFE) |
| [skill-b](https://github.com/octo/skills/tree/commit1/path/to/skill-b) | Description for skill B | None | **20 LOW** |
`;

    const parsed = parseSkillsFromContent(sampleManifest, "community/skills/octo.skills.md");
    expect(parsed.size).toBe(2);

    const skillA = parsed.get("octo/skills/path/to/skill-a");
    expect(skillA).toBeDefined();
    expect(skillA?.name).toBe("skill-a");
    expect(skillA?.repo).toBe("octo/skills");
    expect(skillA?.ref).toBe("commit1");
    expect(skillA?.skillPath).toBe("path/to/skill-a");
    expect(skillA?.description).toBe("Description for skill A");

    const skillB = parsed.get("octo/skills/path/to/skill-b");
    expect(skillB).toBeDefined();
    expect(skillB?.name).toBe("skill-b");
  });

  test("formatSkillDiffReport formats added and removed skills in <details> blocks", () => {
    const diff: SkillDiffResult = {
      added: [
        {
          name: "new-skill",
          url: "https://github.com/example/repo/tree/main/new-skill",
          repo: "example/repo",
          ref: "main",
          skillPath: "new-skill",
          description: "New skill description",
          manifest: "community/skills/example.skills.md",
        },
      ],
      removed: [
        {
          name: "old-skill",
          url: "https://github.com/example/repo/tree/main/old-skill",
          repo: "example/repo",
          ref: "main",
          skillPath: "old-skill",
          description: "Old skill description",
          manifest: "community/skills/example.skills.md",
        },
      ],
    };

    const report = formatSkillDiffReport(diff);

    expect(report).toContain("### Skills Changes Summary");
    expect(report).toContain("- **Added skills**: 1");
    expect(report).toContain("- **Removed skills**: 1");
    expect(report).toContain("<details><summary><b>Added Skills (1)</b></summary>");
    expect(report).toContain("[new-skill](https://github.com/example/repo/tree/main/new-skill)");
    expect(report).toContain("<details><summary><b>Removed Skills (1)</b></summary>");
    expect(report).toContain("[old-skill](https://github.com/example/repo/tree/main/old-skill)");
  });

  test("formatSkillDiffReport renders _None_ when list is empty", () => {
    const diff: SkillDiffResult = {
      added: [],
      removed: [],
    };

    const report = formatSkillDiffReport(diff);

    expect(report).toContain("- **Added skills**: 0");
    expect(report).toContain("- **Removed skills**: 0");
    expect(report).toContain("<details><summary><b>Added Skills (0)</b></summary>\n\n_None_\n\n</details>");
    expect(report).toContain("<details><summary><b>Removed Skills (0)</b></summary>\n\n_None_\n\n</details>");
  });
});
