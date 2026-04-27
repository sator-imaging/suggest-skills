import { describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import {
  generateOutputs,
  generateSkillsManifest,
  writeGeneratedManifest,
  type GeneratedDocument,
} from "../src/generate.js";

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

      expect(outputs.agents.markdown).not.toContain("unnamed-agent.md");
      expect(outputs.agents.markdown).not.toContain("broken-agent.md");
      expect(outputs.manifest.markdown).not.toContain("skills/nameless");
      expect(outputs.design.markdown).not.toContain("skills/nameless");
      expect(writes.join("")).toContain(
        'Warning: skipped agent "skills/unnamed-agent.md" because front matter is missing required "name".',
      );
      expect(writes.join("")).toContain(
        'Warning: skipped agent "skills/broken-agent.md" because front matter YAML could not be parsed:',
      );
      expect(writes.join("")).toContain(`---
name: "broken-agent
description: Broken YAML
---`);
      expect(writes.join("")).toContain(
        'Warning: skipped skill "skills/nameless/SKILL.md" because front matter is missing required "name".',
      );
      expect(writes.join("")).toContain(
        'Warning: skipped design "skills/nameless/DESIGN.md" because front matter is missing required "name".',
      );
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
      writeGeneratedManifest(manifest, {
        confirmOverwrite: async () => false,
        fileExists: async () => true,
        workingDirectory: () => workingDirectory,
        writeFile: async (path, content) => {
          writes.push({ content, path });
        },
      }),
    ).rejects.toThrow('Refusing to overwrite "octo.demo.skills.skills.md".');

    expect(writes).toEqual([]);
  });

  test("writes the file when overwrite is confirmed", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "octo.demo.skills.skills.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, {
      confirmOverwrite: async () => true,
      fileExists: async () => true,
      workingDirectory: () => workingDirectory,
      writeFile: async (path, content) => {
        writes.push({ content, path });
      },
    });

    expect(outputPath).toBe(join(workingDirectory, "octo.demo.skills.skills.md"));
    expect(writes).toEqual([
      {
        content: "manifest-body\n",
        path: join(workingDirectory, "octo.demo.skills.skills.md"),
      },
    ]);
  });

  test("skips overwrite and write when the generated file is empty", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "| Name | Description |\n| -----|-------------|\n",
      outputFileName: "octo.demo.skills.agents.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, {
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
});

async function fetchMock(input: string | URL | Request): Promise<Response> {
  const url = String(input);

  if (url === "https://api.github.com/repos/octo/demo/contents?ref=main") {
    return Response.json([
      {
        type: "dir",
        path: "alpha",
        download_url: null,
      },
      {
        type: "dir",
        path: "beta",
        download_url: null,
      },
    ]);
  }

  if (url === "https://api.github.com/repos/octo/demo/contents?ref=master") {
    return Response.json([
      {
        type: "dir",
        path: "alpha",
        download_url: null,
      },
      {
        type: "dir",
        path: "beta",
        download_url: null,
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
        path: "skills/broken-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/broken-agent.md",
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

  if (url === "https://raw.githubusercontent.com/octo/demo/main/skills/broken-agent.md") {
    return new Response(`---
name: "broken-agent
description: Broken YAML
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
    return new Response(`---
description: Missing design name
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

  throw new Error(`Unexpected fetch: ${url}`);
}
