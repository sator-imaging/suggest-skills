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

      expect(manifest.outputFileName).toBe("octo.demo.skills.md");
      expect(manifest.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha](https://github.com/octo/demo/tree/main/skills/alpha) | Alpha skill | \`assets/example.txt\`, \`assets/templates/config.json\`, \`scripts/deploy.sh\` |
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

      expect(outputs.agents.outputFileName).toBe("octo.demo.agents.md");
      expect(outputs.agents.markdown).toBe(`| Name | Description |
| -----|-------------|
| [release-agent](https://github.com/octo/demo/blob/main/skills/release-agent.md) | Release workflows |
| [root-skill-agent](https://github.com/octo/demo/blob/main/skills/SKILL.md) | Root skill as agent |
`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("builds a design markdown file from DESIGN.md front matter", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;

    try {
      const outputs = await generateOutputs("https://github.com/octo/demo/tree/main/skills");

      expect(outputs.design.outputFileName).toBe("octo.demo.designs.md");
      expect(outputs.design.markdown).toBe(`| Name | Description | Bundled Assets |
| -----|-------------|----------------|
| [alpha-design](https://github.com/octo/demo/tree/main/skills/alpha) | Alpha design | \`assets/example.txt\`, \`assets/templates/config.json\`, \`scripts/deploy.sh\` |
| [beta-design](https://github.com/octo/demo/tree/main/skills/beta) | None | \`notes.txt\` |
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
      outputFileName: "octo.demo.skills.md",
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
    ).rejects.toThrow('Refusing to overwrite "octo.demo.skills.md".');

    expect(writes).toEqual([]);
  });

  test("writes the file when overwrite is confirmed", async () => {
    const writes: Array<{ content: string; path: string }> = [];
    const manifest: GeneratedDocument = {
      markdown: "manifest-body\n",
      outputFileName: "octo.demo.skills.md",
    };

    const outputPath = await writeGeneratedManifest(manifest, {
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
      outputFileName: "octo.demo.agents.md",
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
        path: "skills/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/SKILL.md",
      },
      {
        type: "file",
        path: "skills/release-agent.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/release-agent.md",
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
name: release-agent
description: Release workflows
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
