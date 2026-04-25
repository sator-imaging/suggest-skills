import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { downloadGithubFolder, fetchManifestText } from "../src/download.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mock(fetchMock) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("downloadGithubFolder", () => {
  test("downloads a GitHub folder and preserves relative paths", async () => {
    const files = await downloadGithubFolder(
      "https://github.com/octo/demo/tree/main/skills/test-skill",
    );

    expect(files).toEqual([
      {
        path: "SKILL.md",
        content: "---\nname: test-skill\n---\n",
      },
      {
        path: "assets/template.txt",
        content: "template-body\n",
      },
    ]);
  });

  test("resolves branch names that contain slashes", async () => {
    const files = await downloadGithubFolder(
      "https://github.com/octo/demo/tree/feature/skills/skills/test-skill",
    );

    expect(files).toEqual([
      {
        path: "SKILL.md",
        content: "---\nname: branch-skill\n---\n",
      },
    ]);
  });

  test("returns an error when a downloaded file is binary", async () => {
    await expect(
      downloadGithubFolder("https://github.com/octo/demo/tree/main/skills/binary-skill"),
    ).rejects.toThrow(
      'File "skills/binary-skill/icon.png" appears to be binary and cannot be returned as text.',
    );
  });
});

describe("fetchManifestText", () => {
  test("fetches manifest text from a GitHub blob URL", async () => {
    const content = await fetchManifestText(
      "https://github.com/octo/demo/blob/main/docs/README.skills.md",
    );

    expect(content).toBe("# manifest\n");
  });

  test("returns an error when the manifest is binary", async () => {
    await expect(fetchManifestText("https://example.com/binary.manifest")).rejects.toThrow(
      "Manifest appears to be binary and cannot be returned as text.",
    );
  });
});

async function fetchMock(input: string | URL | Request): Promise<Response> {
  const url = String(input);

  if (
    url ===
    "https://api.github.com/repos/octo/demo/contents/skills/test-skill?ref=main"
  ) {
    return Response.json([
      {
        type: "file",
        path: "skills/test-skill/SKILL.md",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/test-skill/SKILL.md",
      },
      {
        type: "dir",
        path: "skills/test-skill/assets",
        download_url: null,
      },
    ]);
  }

  if (
    url ===
    "https://api.github.com/repos/octo/demo/contents/skills/test-skill/assets?ref=main"
  ) {
    return Response.json([
      {
        type: "file",
        path: "skills/test-skill/assets/template.txt",
        download_url:
          "https://raw.githubusercontent.com/octo/demo/main/skills/test-skill/assets/template.txt",
      },
    ]);
  }

  if (
    url ===
    "https://api.github.com/repos/octo/demo/contents/skills/binary-skill?ref=main"
  ) {
    return Response.json([
      {
        type: "file",
        path: "skills/binary-skill/icon.png",
        download_url: "https://raw.githubusercontent.com/octo/demo/main/skills/binary-skill/icon.png",
      },
    ]);
  }

  if (
    url ===
    "https://raw.githubusercontent.com/octo/demo/main/skills/test-skill/SKILL.md"
  ) {
    return new Response("---\nname: test-skill\n---\n");
  }

  if (
    url ===
    "https://raw.githubusercontent.com/octo/demo/main/skills/test-skill/assets/template.txt"
  ) {
    return new Response("template-body\n");
  }

  if (
    url ===
    "https://raw.githubusercontent.com/octo/demo/main/skills/binary-skill/icon.png"
  ) {
    return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]), {
      headers: {
        "content-type": "image/png",
      },
    });
  }

  if (
    url ===
    "https://api.github.com/repos/octo/demo/contents/skills/skills/test-skill?ref=feature"
  ) {
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

  if (
    url ===
    "https://api.github.com/repos/octo/demo/contents/skills/test-skill?ref=feature%2Fskills"
  ) {
    return Response.json([
      {
        type: "file",
        path: "skills/test-skill/SKILL.md",
        download_url:
          "https://raw.githubusercontent.com/octo/demo/feature/skills/skills/test-skill/SKILL.md",
      },
    ]);
  }

  if (
    url ===
    "https://raw.githubusercontent.com/octo/demo/feature/skills/skills/test-skill/SKILL.md"
  ) {
    return new Response("---\nname: branch-skill\n---\n");
  }

  if (
    url ===
    "https://raw.githubusercontent.com/octo/demo/main/docs/README.skills.md"
  ) {
    return new Response("# manifest\n", {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
      },
    });
  }

  if (url === "https://example.com/binary.manifest") {
    return new Response(new Uint8Array([0, 159, 146, 150]), {
      headers: {
        "content-type": "application/octet-stream",
      },
    });
  }

  throw new Error(`Unexpected fetch: ${url}`);
}
