import { describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import {
  generateOutputs,
  generateSkillsManifest,
  writeGeneratedManifest,
  type GeneratedDocument,
} from "../src/cmd_generate.js";

describe("generateSkillsManifest", () => {
  test("builds a manifest from a GitHub skills directory", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const manifest = await generateSkillsManifest(
        "https://github.com/octo/demo/tree/main/skills",
      );

      expect(manifest.outputFileName).toBe("octo.demo.skills.skills.md");
      expect(manifest.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha](https://github.com/octo/demo/tree/main/skills/alpha) | Alpha skill | \`examples.md\`, \`frameworks.md\`, \`refinement-criteria.md\`, \`.config/settings.json\`, \`assets/example.txt\`, \`assets/templates/config.json\`, \`refs\` (2 files), \`refs/sub/details.md\`, \`scripts/deploy.sh\` |
| [beta](https://github.com/octo/demo/tree/main/skills/beta) | Beta skill | \`notes.txt\` |
| [nameless](https://github.com/octo/demo/tree/main/skills/nameless) | Missing skill name | None |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("accepts a plain GitHub repository URL by assuming tree/main", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const manifest = await generateSkillsManifest("https://github.com/octo/demo");

      expect(manifest.outputFileName).toBe("octo.demo.skills.md");
      expect(manifest.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha](https://github.com/octo/demo/tree/main/alpha) | Alpha root skill | \`assets/example.txt\`, \`docs/usage.md\` |
| [beta](https://github.com/octo/demo/tree/main/beta) | Beta root skill | None |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("accepts a GitHub repository tree URL without a path", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const manifest = await generateSkillsManifest("https://github.com/octo/demo/tree/master");

      expect(manifest.outputFileName).toBe("octo.demo.skills.md");
      expect(manifest.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha](https://github.com/octo/demo/tree/master/alpha) | Alpha master skill | \`assets/example.txt\`, \`docs/usage.md\` |
| [beta](https://github.com/octo/demo/tree/master/beta) | Beta master skill | None |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("accepts a GitHub directory URL whose branch name contains slashes", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const manifest = await generateSkillsManifest(
        "https://github.com/octo/demo/tree/feature/skills/skills",
      );

      expect(manifest.outputFileName).toBe("octo.demo.skills.skills.md");
      expect(manifest.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [branch-alpha](https://github.com/octo/demo/tree/feature/skills/skills/branch-alpha) | Branch alpha skill | \`notes.md\` |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("preserves hidden-directory dots in output file names", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/.github/agents");

      expect(outputs.agents.outputFileName).toBe("octo.demo..github.agents.agents.md");
      expect(outputs.manifest.outputFileName).toBe("octo.demo..github.agents.skills.md");
      expect(outputs.design.outputFileName).toBe("octo.demo..github.agents.designs.md");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("preserves hidden-directory dots after a visible path segment", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/skills/.curated");

      expect(outputs.agents.outputFileName).toBe("octo.demo.skills..curated.agents.md");
      expect(outputs.manifest.outputFileName).toBe("octo.demo.skills..curated.skills.md");
      expect(outputs.design.outputFileName).toBe("octo.demo.skills..curated.designs.md");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("generateOutputs", () => {
  test("builds an agents markdown file from flat markdown files", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/skills");

      expect(outputs.agents.outputFileName).toBe("octo.demo.skills.agents.md");
      expect(outputs.agents.markdown).toBe(`| Name | Description |
| -----|-------------|
| [fold-clip-agent](https://github.com/octo/demo/blob/main/skills/fold-clip-agent.md) | Fold clip first line. Fold clip second line. |
| [fold-keep-agent](https://github.com/octo/demo/blob/main/skills/fold-keep-agent.md) | Fold keep first line. Fold keep second line. |
| [fold-strip-agent](https://github.com/octo/demo/blob/main/skills/fold-strip-agent.md) | Fold strip first line. Fold strip second line. |
| [literal-clip-agent](https://github.com/octo/demo/blob/main/skills/literal-clip-agent.md) | Literal clip first line. Literal clip second line. |
| [literal-keep-agent](https://github.com/octo/demo/blob/main/skills/literal-keep-agent.md) | Literal keep first line. Literal keep second line. |
| [literal-strip-agent](https://github.com/octo/demo/blob/main/skills/literal-strip-agent.md) | Literal strip first line. Literal strip second line. |
| [release-agent](https://github.com/octo/demo/blob/main/skills/release-agent.md) | Release workflows with multiline description. Use when: publishing releases, preparing notes. |
| [root-skill-agent](https://github.com/octo/demo/blob/main/skills/SKILL.md) | Root skill as agent |
| [unnamed-agent](https://github.com/octo/demo/blob/main/skills/unnamed-agent.md) | Missing required name |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("skips entries that do not define front matter name and emits warnings", async () => {
    const originalFetch = globalThis.fetch;
    const originalWrite = process.stdout.write;
    const writes: string[] = [];
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;
    process.stdout.write = mock((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/skills");

      expect(outputs.agents.markdown).toContain(
        "| [unnamed-agent](https://github.com/octo/demo/blob/main/skills/unnamed-agent.md) | Missing required name |",
      );
      expect(outputs.manifest.markdown).toContain(
        "| [nameless](https://github.com/octo/demo/tree/main/skills/nameless) | Missing skill name | None |",
      );
      expect(outputs.design.markdown).not.toContain(
        "| [nameless](https://github.com/octo/demo/tree/main/skills/nameless) | None | None |",
      );
      expect(writes.join("")).toContain("Skipped design: skills/nameless");
      expect(writes.join("")).toContain(
        '[WARN] Filled missing "name" in agent "skills/unnamed-agent.md" with "unnamed-agent".',
      );
      expect(writes.join("")).toContain(
        '[WARN] Filled missing "name" in skill "skills/nameless/SKILL.md" with "nameless".',
      );
      expect(writes.join("")).not.toContain('[WARN] corrected mismatched "name"');
      expect(writes.join("")).not.toContain('skills/nameless/DESIGN.md');
    } finally {
      globalThis.fetch = originalFetch;
      process.stdout.write = originalWrite;
    }
  });

  test("builds a design markdown file from DESIGN.md front matter", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/skills");

      expect(outputs.design.outputFileName).toBe("octo.demo.skills.designs.md");
      expect(outputs.design.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha-design](https://github.com/octo/demo/tree/main/skills/alpha) | Alpha design | [examples.md](https://github.com/octo/demo/blob/main/skills/alpha/examples.md), [frameworks.md](https://github.com/octo/demo/blob/main/skills/alpha/frameworks.md), [refinement-criteria.md](https://github.com/octo/demo/blob/main/skills/alpha/refinement-criteria.md), [.config/settings.json](https://github.com/octo/demo/blob/main/skills/alpha/.config/settings.json), [assets/example.txt](https://github.com/octo/demo/blob/main/skills/alpha/assets/example.txt), [assets/templates/config.json](https://github.com/octo/demo/blob/main/skills/alpha/assets/templates/config.json), [refs](https://github.com/octo/demo/tree/main/skills/alpha/refs) (2 files), [refs/sub/details.md](https://github.com/octo/demo/blob/main/skills/alpha/refs/sub/details.md), [scripts/deploy.sh](https://github.com/octo/demo/blob/main/skills/alpha/scripts/deploy.sh) |
| [beta-design](https://github.com/octo/demo/tree/main/skills/beta) | None | [notes.txt](https://github.com/octo/demo/blob/main/skills/beta/notes.txt) |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("supports recursive generate for nested skill and design directories", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/catalog", {
        recursive: true,
      });

      expect(outputs.agents.outputFileName).toBe("octo.demo.catalog.agents.md");
      expect(outputs.agents.markdown).toBe(`| Name | Description |
| -----|-------------|
| [root-agent](https://github.com/octo/demo/blob/main/catalog/root-agent.md) | Root recursive agent |
`);
      expect(outputs.manifest.outputFileName).toBe("octo.demo.catalog.skills.md");
      expect(outputs.manifest.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha](https://github.com/octo/demo/tree/main/catalog/group/alpha) | Alpha recursive skill | \`assets/guide.md\` |
| [beta](https://github.com/octo/demo/tree/main/catalog/group/beta) | Beta recursive skill | \`docs/overview.md\` |
`);
      expect(outputs.design.outputFileName).toBe("octo.demo.catalog.designs.md");
      expect(outputs.design.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha-design](https://github.com/octo/demo/tree/main/catalog/group/alpha) | Alpha recursive design | [assets/guide.md](https://github.com/octo/demo/blob/main/catalog/group/alpha/assets/guide.md) |
| [beta-design](https://github.com/octo/demo/tree/main/catalog/group/beta) | None | [docs/overview.md](https://github.com/octo/demo/blob/main/catalog/group/beta/docs/overview.md) |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("keeps nested skill and design subfolders as bundled assets in recursive mode", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/library", {
        recursive: true,
      });

      expect(outputs.manifest.markdown).toContain(
        "| [parent](https://github.com/octo/demo/tree/main/library/parent) | Parent skill |",
      );
      expect(outputs.manifest.markdown).toContain("`child/DESIGN.md`");
      expect(outputs.manifest.markdown).toContain("`child/SKILL.md`");
      expect(outputs.manifest.markdown).toContain("`child/guide.md`");
      expect(outputs.manifest.markdown).toContain(
        "| [child](https://github.com/octo/demo/tree/main/library/parent/child) | Child skill | `guide.md` |",
      );
      expect(outputs.design.markdown).toContain(
        "| [child-design](https://github.com/octo/demo/tree/main/library/parent/child) | Child design | [guide.md](https://github.com/octo/demo/blob/main/library/parent/child/guide.md) |",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("treats a DESIGN.md with non-YAML fenced markdown as markdown-only", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/skills", {
        recursive: true,
      });

      expect(outputs.design.markdown).not.toContain(
        "| [examples](https://github.com/octo/demo/tree/main/skills/stitch-design/examples) | None | None |",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("avoids extra contents API calls while generating from recursive tree data", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = mock((input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      return fetchMock(input);
    }) as unknown as typeof fetch;

    try {
      await generateOutputs("https://github.com/octo/demo/tree/main/catalog", {
        recursive: true,
      });

      expect(calls.slice(0, 3)).toEqual([
        "https://api.github.com/repos/octo/demo/contents/catalog?ref=main",
        "https://api.github.com/repos/octo/demo/contents?ref=main",
        "https://api.github.com/repos/octo/demo/git/trees/catalog-main-tree?recursive=1",
      ]);
      expect(calls.slice(3).sort()).toEqual([
        "https://raw.githubusercontent.com/octo/demo/main/catalog/group/alpha/DESIGN.md",
        "https://raw.githubusercontent.com/octo/demo/main/catalog/group/alpha/SKILL.md",
        "https://raw.githubusercontent.com/octo/demo/main/catalog/group/beta/DESIGN.md",
        "https://raw.githubusercontent.com/octo/demo/main/catalog/group/beta/SKILL.md",
        "https://raw.githubusercontent.com/octo/demo/main/catalog/root-agent.md",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("propagates agent download failures without leaving unhandled fiber rejections", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      // With concurrent downloads via ts-fibers, Bun test does not reliably capture this exception through `.rejects`,
      // so this assertion must pass a function to `toThrow`.
      await expect(() => generateOutputs("https://github.com/octo/demo/tree/main/broken-agents")).toThrow(
        'Agent file "broken-agents/binary-agent.md" appears to be binary and cannot be returned as text. Content-Type: image/png.',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("reads UTF-16 encoded SKILL.md files while generating outputs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/utf16/utf16-skills");

      expect(outputs.manifest.markdown).toContain(
        "| [utf16-skill](https://github.com/octo/demo/tree/utf16/utf16-skills/utf16-skill) | UTF-16 generated skill | None |",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("reads octet-stream markdown skill files by file extension", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/octet/octet-stream-skills");

      expect(outputs.manifest.markdown).toContain(
        "| [octet-stream-skill](https://github.com/octo/demo/tree/octet/octet-stream-skills/octet-stream-skill) | Octet stream generated skill | None |",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("writeGeneratedManifest", () => {
  const workingDirectory = "/tmp/work";

  test("asks before overwriting an existing file", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "octo.demo.skills.skills.md",
    };

    await expect(
      writeGeneratedManifest(manifest, "skills", {
        confirmOverwrite: async () => false,
        fileExists: async () => true,
        workingDirectory: () => workingDirectory,
        writeFile: async (path, content) => {
          writes.push({ content, path });
        },
      }),
    ).rejects.toThrow('Refusing to overwrite "octo.demo.skills.md".');

    expect(writes).toEqual([]);
  });

  test("writes the file when overwrite is confirmed", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "octo.demo.skills.skills.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, "skills", {
      confirmOverwrite: async () => true,
      fileExists: async () => true,
      workingDirectory: () => workingDirectory,
      writeFile: async (path, content) => {
        writes.push({ content, path });
      },
    });

    expect(outputPath).toBe(join(workingDirectory, "octo.demo.skills.md"));
    expect(writes).toEqual([
      {
        content: "manifest-body\n",
        path: join(workingDirectory, "octo.demo.skills.md"),
      },
    ]);
  });

  test("skips overwrite and write when the generated file is empty", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "| Name | Description |\n| -----|-------------|\n",
      outputFileName: "octo.demo.skills.agents.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, "agents", {
      confirmOverwrite: async () => {
        throw new Error("confirmOverwrite should not be called");
      },
      fileExists: async () => {
        throw new Error("fileExists should not be called");
      },
      workingDirectory: () => workingDirectory,
      writeFile: async (path, content) => {
        writes.push({ content, path });
      },
    });

    expect(outputPath).toBeUndefined();
    expect(writes).toEqual([]);
  });

  test("removes redundant type suffix in output file name", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "octo.demo.skills.skills.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, "skills", {
      confirmOverwrite: async () => true,
      fileExists: async () => false,
      workingDirectory: () => workingDirectory,
      writeFile: async (path, content) => {
        writes.push({ content, path });
      },
    });

    expect(outputPath).toBe(join(workingDirectory, "octo.demo.skills.md"));
    expect(writes).toEqual([
      {
        content: "manifest-body\n",
        path: join(workingDirectory, "octo.demo.skills.md"),
      },
    ]);
  });

  test("removes multiple redundant type suffixes in output file name", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "octo.demo.skills.skills.skills.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, "skills", {
      confirmOverwrite: async () => true,
      fileExists: async () => false,
      workingDirectory: () => workingDirectory,
      writeFile: async (path, content) => {
        writes.push({ content, path });
      },
    });

    expect(outputPath).toBe(join(workingDirectory, "octo.demo.skills.md"));
    expect(writes).toEqual([
      {
        content: "manifest-body\n",
        path: join(workingDirectory, "octo.demo.skills.md"),
      },
    ]);
  });

  test("removes redundant type suffix even if it is part of the original name", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "some-skills.skills.skills.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, "skills", {
      confirmOverwrite: async () => true,
      fileExists: async () => false,
      workingDirectory: () => workingDirectory,
      writeFile: async (path, content) => {
        writes.push({ content, path });
      },
    });

    expect(outputPath).toBe(join(workingDirectory, "some.skills.md"));
    expect(writes).toEqual([
      {
        content: "manifest-body\n",
        path: join(workingDirectory, "some.skills.md"),
      },
    ]);
  });

  test("strips suffix when preceded by major delimiters like hyphen or underscore", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "my-take-dev.inspired-mino-design-skills.skills.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, "skills", {
      confirmOverwrite: async () => true,
      fileExists: async () => false,
      workingDirectory: () => workingDirectory,
      writeFile: async (path, content) => {
        writes.push({ content, path });
      },
    });

    expect(outputPath).toBe(join(workingDirectory, "my-take-dev.inspired-mino-design.skills.md"));
    expect(writes).toEqual([
      {
        content: "manifest-body\n",
        path: join(workingDirectory, "my-take-dev.inspired-mino-design.skills.md"),
      },
    ]);
  });
});

async function fetchMock(input: string | URL | Request): Promise<Response> {
  const url = String(input);

  if (url === "https://api.github.com/repos/octo/demo/contents?ref=utf16") {
    return Response.json([
      {
        type: "dir",
        path: "utf16-skills",
        download_url: null,
        sha: "utf16-skills-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/utf16-skills?ref=utf16") {
    return Response.json([
      {
        type: "file",
        path: "utf16-skills/utf16-skill/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/utf16/utf16-skills/utf16-skill/SKILL.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/utf16-skills-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "utf16-skill", type: "tree" },
        { path: "utf16-skill/SKILL.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/contents?ref=octet") {
    return Response.json([
      {
        type: "dir",
        path: "octet-stream-skills",
        download_url: null,
        sha: "octet-stream-skills-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/octet-stream-skills?ref=octet") {
    return Response.json([
      {
        type: "file",
        path: "octet-stream-skills/octet-stream-skill/SKILL.md",
        download_url:
          "https://raw.githubusercontent.com/octo/demo/octet/octet-stream-skills/octet-stream-skill/SKILL.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/octet-stream-skills-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "octet-stream-skill", type: "tree" },
        { path: "octet-stream-skill/SKILL.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/broken-agents?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "broken-agents/binary-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/broken-agents/binary-agent.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/commits/main") {
    return Response.json({
      commit: {
        tree: {
          sha: "root-main-tree",
        },
      },
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/commits/master") {
    return Response.json({
      commit: {
        tree: {
          sha: "root-master-tree",
        },
      },
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/branch-skills-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "branch-alpha", type: "tree" },
        { path: "branch-alpha/SKILL.md", type: "blob" },
        { path: "branch-alpha/notes.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/github-agents-main-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "release-agent.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/skills-curated-main-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "alpha", type: "tree" },
        { path: "alpha/SKILL.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/library-main-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "parent", type: "tree" },
        { path: "parent/SKILL.md", type: "blob" },
        { path: "parent/child", type: "tree" },
        { path: "parent/child/SKILL.md", type: "blob" },
        { path: "parent/child/DESIGN.md", type: "blob" },
        { path: "parent/child/guide.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/root-main-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "alpha", type: "tree" },
        { path: "alpha/SKILL.md", type: "blob" },
        { path: "alpha/DESIGN.md", type: "blob" },
        { path: "alpha/assets", type: "tree" },
        { path: "alpha/assets/example.txt", type: "blob" },
        { path: "alpha/docs", type: "tree" },
        { path: "alpha/docs/usage.md", type: "blob" },
        { path: "beta", type: "tree" },
        { path: "beta/SKILL.md", type: "blob" },
        { path: "skills", type: "tree" },
        { path: "catalog", type: "tree" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/broken-agents-main-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [{ path: "binary-agent.md", type: "blob" }],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/root-master-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "alpha", type: "tree" },
        { path: "alpha/SKILL.md", type: "blob" },
        { path: "alpha/assets", type: "tree" },
        { path: "alpha/assets/example.txt", type: "blob" },
        { path: "alpha/docs", type: "tree" },
        { path: "alpha/docs/usage.md", type: "blob" },
        { path: "beta", type: "tree" },
        { path: "beta/SKILL.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/skills-main-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "fold-clip-agent.md", type: "blob" },
        { path: "fold-keep-agent.md", type: "blob" },
        { path: "fold-strip-agent.md", type: "blob" },
        { path: "literal-clip-agent.md", type: "blob" },
        { path: "literal-keep-agent.md", type: "blob" },
        { path: "literal-strip-agent.md", type: "blob" },
        { path: "SKILL.md", type: "blob" },
        { path: "release-agent.md", type: "blob" },
        { path: "unnamed-agent.md", type: "blob" },
        { path: "alpha", type: "tree" },
        { path: "alpha/SKILL.md", type: "blob" },
        { path: "alpha/DESIGN.md", type: "blob" },
        { path: "alpha/assets", type: "tree" },
        { path: "alpha/assets/example.txt", type: "blob" },
        { path: "alpha/assets/templates", type: "tree" },
        { path: "alpha/assets/templates/config.json", type: "blob" },
        { path: "alpha/scripts", type: "tree" },
        { path: "alpha/scripts/deploy.sh", type: "blob" },
        { path: "alpha/.config", type: "tree" },
        { path: "alpha/.config/settings.json", type: "blob" },
        { path: "alpha/examples.md", type: "blob" },
        { path: "alpha/frameworks.md", type: "blob" },
        { path: "alpha/refinement-criteria.md", type: "blob" },
        { path: "alpha/refs", type: "tree" },
        { path: "alpha/refs/guide.md", type: "blob" },
        { path: "alpha/refs/checklist.md", type: "blob" },
        { path: "alpha/refs/sub", type: "tree" },
        { path: "alpha/refs/sub/details.md", type: "blob" },
        { path: "alpha/.secret", type: "blob" },
        { path: "beta", type: "tree" },
        { path: "beta/SKILL.md", type: "blob" },
        { path: "beta/DESIGN.md", type: "blob" },
        { path: "beta/notes.txt", type: "blob" },
        { path: "nameless", type: "tree" },
        { path: "nameless/SKILL.md", type: "blob" },
        { path: "nameless/DESIGN.md", type: "blob" },
        { path: "stitch-design", type: "tree" },
        { path: "stitch-design/examples", type: "tree" },
        { path: "stitch-design/examples/DESIGN.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/git/trees/catalog-main-tree?recursive=1") {
    return Response.json({
      truncated: false,
      tree: [
        { path: "root-agent.md", type: "blob" },
        { path: "group", type: "tree" },
        { path: "group/alpha", type: "tree" },
        { path: "group/alpha/SKILL.md", type: "blob" },
        { path: "group/alpha/DESIGN.md", type: "blob" },
        { path: "group/alpha/assets", type: "tree" },
        { path: "group/alpha/assets/guide.md", type: "blob" },
        { path: "group/beta", type: "tree" },
        { path: "group/beta/SKILL.md", type: "blob" },
        { path: "group/beta/DESIGN.md", type: "blob" },
        { path: "group/beta/docs", type: "tree" },
        { path: "group/beta/docs/overview.md", type: "blob" },
      ],
    });
  }

  if (url === "https://api.github.com/repos/octo/demo/contents?ref=main") {
    return Response.json([
      {
        type: "dir",
        path: "alpha",
        download_url: null,
        sha: "alpha-main-tree",
      },
      {
        type: "dir",
        path: "beta",
        download_url: null,
        sha: "beta-main-tree",
      },
      {
        type: "dir",
        path: "skills",
        download_url: null,
        sha: "skills-main-tree",
      },
      {
        type: "dir",
        path: "broken-agents",
        download_url: null,
        sha: "broken-agents-main-tree",
      },
      {
        type: "dir",
        path: "catalog",
        download_url: null,
        sha: "catalog-main-tree",
      },
      {
        type: "dir",
        path: ".github",
        download_url: null,
        sha: "github-root-tree",
      },
      {
        type: "dir",
        path: "library",
        download_url: null,
        sha: "library-main-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents?ref=master") {
    return Response.json([
      {
        type: "dir",
        path: "alpha",
        download_url: null,
        sha: "alpha-master-tree",
      },
      {
        type: "dir",
        path: "beta",
        download_url: null,
        sha: "beta-master-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents?ref=feature%2Fskills") {
    return Response.json([
      {
        type: "dir",
        path: "skills",
        download_url: null,
        sha: "branch-skills-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/catalog?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "catalog/root-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/root-agent.md",
      },
      {
        type: "dir",
        path: "catalog/group",
        download_url: null,
        sha: "catalog-group-main-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/.github/agents?ref=main") {
    return Response.json([
      {
        type: "file",
        path: ".github/agents/release-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/.github/agents/release-agent.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/.github?ref=main") {
    return Response.json([
      {
        type: "dir",
        path: ".github/agents",
        download_url: null,
        sha: "github-agents-main-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/library?ref=main") {
    return Response.json([
      {
        type: "dir",
        path: "library/parent",
        download_url: null,
        sha: "library-main-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/skills?ref=feature") {
    return new Response(
      JSON.stringify({
        message: "Not Found",
      }),
      {
        status: 404,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills?ref=feature%2Fskills") {
    return Response.json([
      {
        type: "dir",
        path: "skills/branch-alpha",
        download_url: null,
        sha: "branch-skills-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/alpha?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "alpha/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/alpha/SKILL.md",
      },
      {
        type: "file",
        path: "alpha/DESIGN.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/alpha/DESIGN.md",
      },
      {
        type: "dir",
        path: "alpha/assets",
        download_url: null,
      },
      {
        type: "dir",
        path: "alpha/docs",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/alpha/assets?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "alpha/assets/example.txt",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/alpha/assets/example.txt",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/alpha/docs?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "alpha/docs/usage.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/alpha/docs/usage.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/beta?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "beta/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/beta/SKILL.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/alpha?ref=master") {
    return Response.json([
      {
        type: "file",
        path: "alpha/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/master/alpha/SKILL.md",
      },
      {
        type: "dir",
        path: "alpha/assets",
        download_url: null,
      },
      {
        type: "dir",
        path: "alpha/docs",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/alpha/assets?ref=master") {
    return Response.json([
      {
        type: "file",
        path: "alpha/assets/example.txt",
        download_url: "https://raw.githubusercontent.com/octo/demo/master/alpha/assets/example.txt",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/alpha/docs?ref=master") {
    return Response.json([
      {
        type: "file",
        path: "alpha/docs/usage.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/master/alpha/docs/usage.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/beta?ref=master") {
    return Response.json([
      {
        type: "file",
        path: "beta/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/master/beta/SKILL.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/.curated?ref=main") {
    return Response.json([
      {
        type: "dir",
        path: "skills/.curated/alpha",
        download_url: null,
        sha: "skills-curated-main-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/fold-clip-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/fold-clip-agent.md",
      },
      {
        type: "file",
        path: "skills/fold-keep-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/fold-keep-agent.md",
      },
      {
        type: "file",
        path: "skills/fold-strip-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/fold-strip-agent.md",
      },
      {
        type: "file",
        path: "skills/literal-clip-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/literal-clip-agent.md",
      },
      {
        type: "file",
        path: "skills/literal-keep-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/literal-keep-agent.md",
      },
      {
        type: "file",
        path: "skills/literal-strip-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/literal-strip-agent.md",
      },
      {
        type: "file",
        path: "skills/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/SKILL.md",
      },
      {
        type: "file",
        path: "skills/release-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/release-agent.md",
      },
      {
        type: "file",
        path: "skills/unnamed-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/unnamed-agent.md",
      },
      {
        type: "dir",
        path: "skills/alpha",
        download_url: null,
      },
      {
        type: "dir",
        path: "skills/beta",
        download_url: null,
      },
      {
        type: "dir",
        path: "skills/nameless",
        download_url: null,
      },
      {
        type: "dir",
        path: "skills/.curated",
        download_url: null,
        sha: "skills-curated-main-tree",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/catalog?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "catalog/root-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/root-agent.md",
      },
      {
        type: "dir",
        path: "catalog/group",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/catalog/group?ref=main") {
    return Response.json([
      {
        type: "dir",
        path: "catalog/group/alpha",
        download_url: null,
      },
      {
        type: "dir",
        path: "catalog/group/beta",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/catalog/group/alpha?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "catalog/group/alpha/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/group/alpha/SKILL.md",
      },
      {
        type: "file",
        path: "catalog/group/alpha/DESIGN.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/group/alpha/DESIGN.md",
      },
      {
        type: "dir",
        path: "catalog/group/alpha/assets",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/catalog/group/alpha/assets?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "catalog/group/alpha/assets/guide.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/group/alpha/assets/guide.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/catalog/group/beta?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "catalog/group/beta/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/group/beta/SKILL.md",
      },
      {
        type: "file",
        path: "catalog/group/beta/DESIGN.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/group/beta/DESIGN.md",
      },
      {
        type: "dir",
        path: "catalog/group/beta/docs",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/catalog/group/beta/docs?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "catalog/group/beta/docs/overview.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/catalog/group/beta/docs/overview.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/alpha?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/alpha/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/SKILL.md",
      },
      {
        type: "file",
        path: "skills/alpha/DESIGN.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/DESIGN.md",
      },
      {
        type: "dir",
        path: "skills/alpha/assets",
        download_url: null,
      },
      {
        type: "dir",
        path: "skills/alpha/scripts",
        download_url: null,
      },
      {
        type: "dir",
        path: "skills/alpha/.config",
        download_url: null,
      },
      {
        type: "file",
        path: "skills/alpha/examples.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/examples.md",
      },
      {
        type: "file",
        path: "skills/alpha/frameworks.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/frameworks.md",
      },
      {
        type: "file",
        path: "skills/alpha/refinement-criteria.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/refinement-criteria.md",
      },
      {
        type: "dir",
        path: "skills/alpha/refs",
        download_url: null,
      },
      {
        type: "file",
        path: "skills/alpha/.secret",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/.secret",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/alpha/assets?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/alpha/assets/example.txt",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/assets/example.txt",
      },
      {
        type: "dir",
        path: "skills/alpha/assets/templates",
        download_url: null,
      },
    ]);
  }

  if (
    url ===
    "https://api.github.com/repos/octo/demo/contents/skills/alpha/assets/templates?ref=main"
  ) {
    return Response.json([
      {
        type: "file",
        path: "skills/alpha/assets/templates/config.json",
        download_url:
          "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/assets/templates/config.json",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/alpha/scripts?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/alpha/scripts/deploy.sh",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/scripts/deploy.sh",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/alpha/.config?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/alpha/.config/settings.json",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/.config/settings.json",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/alpha/refs?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/alpha/refs/guide.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/refs/guide.md",
      },
      {
        type: "file",
        path: "skills/alpha/refs/checklist.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/refs/checklist.md",
      },
      {
        type: "dir",
        path: "skills/alpha/refs/sub",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/alpha/refs/sub?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/alpha/refs/sub/details.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/refs/sub/details.md",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/beta?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/beta/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/beta/SKILL.md",
      },
      {
        type: "file",
        path: "skills/beta/DESIGN.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/beta/DESIGN.md",
      },
      {
        type: "file",
        path: "skills/beta/notes.txt",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/beta/notes.txt",
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents/skills/nameless?ref=main") {
    return Response.json([
      {
        type: "file",
        path: "skills/nameless/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/nameless/SKILL.md",
      },
      {
        type: "file",
        path: "skills/nameless/DESIGN.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/nameless/DESIGN.md",
      },
    ]);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/SKILL.md") {
    return new Response(`---
name: alpha
description: Alpha skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/SKILL.md") {
    return new Response(`---
name: root-skill-agent
description: Root skill as agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/release-agent.md") {
    return new Response(`---
description: >-
  Release workflows with multiline description.

  Use when: publishing releases, preparing notes.
name: release-agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/unnamed-agent.md") {
    return new Response(`---
description: Missing required name
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/fold-clip-agent.md") {
    return new Response(`---
description: >
  Fold clip first line.
  Fold clip second line.
name: fold-clip-agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/fold-keep-agent.md") {
    return new Response(`---
description: >+
  Fold keep first line.
  Fold keep second line.
name: fold-keep-agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/fold-strip-agent.md") {
    return new Response(`---
description: >-
  Fold strip first line.
  Fold strip second line.
name: fold-strip-agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/literal-clip-agent.md") {
    return new Response(`---
description: |
  Literal clip first line.
  Literal clip second line.
name: literal-clip-agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/literal-keep-agent.md") {
    return new Response(`---
description: |+
  Literal keep first line.
  Literal keep second line.
name: literal-keep-agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/literal-strip-agent.md") {
    return new Response(`---
description: |-
  Literal strip first line.
  Literal strip second line.
name: literal-strip-agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/alpha/DESIGN.md") {
    return new Response(`---
name: alpha-design
description: Alpha design
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/catalog/group/alpha/SKILL.md") {
    return new Response(`---
name: alpha
description: Alpha recursive skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/catalog/root-agent.md") {
    return new Response(`---
name: root-agent
description: Root recursive agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/catalog/group/alpha/DESIGN.md") {
    return new Response(`---
name: alpha-design
description: Alpha recursive design
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/catalog/group/beta/SKILL.md") {
    return new Response(`---
name: beta
description: Beta recursive skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/catalog/group/beta/DESIGN.md") {
    return new Response(`---
name: beta-design
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/.github/agents/release-agent.md") {
    return new Response(`---
name: release-agent
description: Release hidden agent
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/.curated/alpha/SKILL.md") {
    return new Response(`---
name: alpha
description: Curated alpha skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/library/parent/SKILL.md") {
    return new Response(`---
name: parent
description: Parent skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/library/parent/child/SKILL.md") {
    return new Response(`---
name: child
description: Child skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/library/parent/child/DESIGN.md") {
    return new Response(`---
name: child-design
description: Child design
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/feature/skills/skills/branch-alpha/SKILL.md") {
    return new Response(`---
name: branch-alpha
description: Branch alpha skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/alpha/SKILL.md") {
    return new Response(`---
name: alpha
description: Alpha root skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/alpha/DESIGN.md") {
    return new Response(`---
name: alpha-root-design
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/master/alpha/SKILL.md") {
    return new Response(`---
name: alpha
description: Alpha master skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/beta/SKILL.md") {
    return new Response(`---
name: beta
description: Beta skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/beta/DESIGN.md") {
    return new Response(`---
name: beta-design
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/nameless/SKILL.md") {
    return new Response(`---
description: Missing skill name
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/nameless/DESIGN.md") {
    return new Response("# No front matter here\n");
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/stitch-design/examples/DESIGN.md") {
    return new Response(`---
# The "Solace" Design System
This is a comprehensive design language for a mindfulness and wellness application.

## Typography
- Body: Inter
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/beta/SKILL.md") {
    return new Response(`---
name: beta
description: Beta root skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/master/beta/SKILL.md") {
    return new Response(`---
name: beta
description: Beta master skill
---
`);
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/main/broken-agents/binary-agent.md") {
    return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]), {
      headers: {
        "content-type": "image/png",
      },
    });
  }

  if (url === "https://raw.githubusercontent.com/octo/demo/utf16/utf16-skills/utf16-skill/SKILL.md") {
    return new Response(
      new Uint8Array([
        255, 254, 45, 0, 45, 0, 45, 0, 10, 0, 110, 0, 97, 0, 109, 0, 101, 0, 58, 0, 32,
        0, 117, 0, 116, 0, 102, 0, 49, 0, 54, 0, 45, 0, 115, 0, 107, 0, 105, 0, 108, 0,
        108, 0, 10, 0, 100, 0, 101, 0, 115, 0, 99, 0, 114, 0, 105, 0, 112, 0, 116, 0,
        105, 0, 111, 0, 110, 0, 58, 0, 32, 0, 85, 0, 84, 0, 70, 0, 45, 0, 49, 0, 54, 0,
        32, 0, 103, 0, 101, 0, 110, 0, 101, 0, 114, 0, 97, 0, 116, 0, 101, 0, 100, 0,
        32, 0, 115, 0, 107, 0, 105, 0, 108, 0, 108, 0, 10, 0, 45, 0, 45, 0, 45, 0, 10, 0,
      ]),
      {
        headers: {
          "content-type": "text/plain; charset=utf-16le",
        },
      },
    );
  }

  if (
    url ===
    "https://raw.githubusercontent.com/octo/demo/octet/octet-stream-skills/octet-stream-skill/SKILL.md"
  ) {
    return new Response(
      "---\nname: octet-stream-skill\ndescription: Octet stream generated skill\n---\n",
      {
        headers: {
          "content-type": "application/octet-stream",
        },
      },
    );
  }

  throw new Error(`Unexpected fetch: ${url}`);
}
