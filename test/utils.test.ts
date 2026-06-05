import { describe, expect, test } from "bun:test";
import {
  extractMarkdownFrontMatter,
  normalizeGithubRawUrl,
  parseMarkdownFrontMatterFields,
  sanitizeUrlCredentials,
} from "../src/utils.js";

describe("extractMarkdownFrontMatter", () => {
  test("returns the first markdown front matter block", () => {
    expect(
      extractMarkdownFrontMatter(`---
name: alpha
description: Alpha skill
---

# Title
`),
    ).toBe(`name: alpha
description: Alpha skill`);
  });

  test("returns null when front matter is missing", () => {
    expect(extractMarkdownFrontMatter("# Title\n")).toBeNull();
  });
});

describe("parseMarkdownFrontMatterFields", () => {
  test("parses name and description as string or null", () => {
    expect(
      parseMarkdownFrontMatterFields(`---
name: alpha
description: Alpha skill
---
`),
    ).toEqual({
      description: "Alpha skill",
      name: "alpha",
      parseError: null,
      source: `name: alpha
description: Alpha skill`,
    });
  });

  test("allows omitting description while keeping name", () => {
    expect(
      parseMarkdownFrontMatterFields(`---
name: alpha
---
`),
    ).toEqual({
      description: null,
      name: "alpha",
      parseError: null,
      source: "name: alpha",
    });
  });

  test("collapses multiline yaml strings", () => {
    expect(
      parseMarkdownFrontMatterFields(`---
name: release-agent
description: >-
  Release workflows with multiline description.
  Use when: publishing releases, preparing notes.
---
`),
    ).toEqual({
      description: "Release workflows with multiline description. Use when: publishing releases, preparing notes.",
      name: "release-agent",
      parseError: null,
      source: `name: release-agent
description: >-
  Release workflows with multiline description.
  Use when: publishing releases, preparing notes.`,
    });
  });

  test("accepts trailing commas in flow collections after preprocessing", () => {
    expect(
      parseMarkdownFrontMatterFields(`---
name: DiffblueCover
description: Expert agent for creating unit tests for java applications using Diffblue Cover.
tools: [ 'DiffblueCover/*', ]
mcp-servers:
  DiffblueCover:
    type: 'local'
    command: 'uv'
    args: [
      'run',
      '--with',
      'fastmcp',
      'fastmcp',
      'run',
      '/placeholder/path/to/cover-mcp/main.py',
    ]
    env:
      DIFFBLUE_COVER_CLI: "/placeholder/path/to/dcover"
    tools: [ "*", ]
---
`),
    ).toEqual({
      description: "Expert agent for creating unit tests for java applications using Diffblue Cover.",
      name: "DiffblueCover",
      parseError: null,
      source: `name: DiffblueCover
description: Expert agent for creating unit tests for java applications using Diffblue Cover.
tools: [ 'DiffblueCover/*', ]
mcp-servers:
  DiffblueCover:
    type: 'local'
    command: 'uv'
    args: [
      'run',
      '--with',
      'fastmcp',
      'fastmcp',
      'run',
      '/placeholder/path/to/cover-mcp/main.py',
    ]
    env:
      DIFFBLUE_COVER_CLI: "/placeholder/path/to/dcover"
    tools: [ "*", ]`,
    });
  });

  test("returns null for missing or non-string fields", () => {
    expect(
      parseMarkdownFrontMatterFields(`---
name:
description:
---
`),
    ).toEqual({
      description: null,
      name: null,
      parseError: null,
      source: `name:
description:`,
    });

    expect(
      parseMarkdownFrontMatterFields(`---
name:
  nested: true
description: 42
---
`),
    ).toEqual({
      description: null,
      name: null,
      parseError: null,
      source: `name:
  nested: true
description: 42`,
    });
  });

  test("returns nulls when front matter is absent", () => {
    expect(parseMarkdownFrontMatterFields("# Title\n")).toEqual({
      description: null,
      name: null,
      parseError: null,
      source: null,
    });
  });

  test("returns parse error for invalid yaml", () => {
    expect(parseMarkdownFrontMatterFields(`---
name: "alpha
---
`)).toEqual({
      description: null,
      name: null,
      parseError: expect.stringContaining("YAML Parse error"),
      source: 'name: "alpha',
    });
  });
});

describe("sanitizeUrlCredentials", () => {
  test("removes embedded GitHub tokens from raw manifest URLs", () => {
    expect(
      sanitizeUrlCredentials(
        "https://ghp_exampletoken@raw.githubusercontent.com/octo/demo/main/docs/README.skills.md",
      ),
    ).toBe("https://raw.githubusercontent.com/octo/demo/main/docs/README.skills.md");
  });

  test("removes x-access-token credentials from GitHub blob URLs", () => {
    expect(
      sanitizeUrlCredentials(
        "https://x-access-token:ghp_exampletoken@github.com/octo/demo/blob/main/docs/README.skills.md",
      ),
    ).toBe("https://github.com/octo/demo/blob/main/docs/README.skills.md");
  });

  test("leaves credential-free URLs unchanged", () => {
    const url = "https://raw.githubusercontent.com/octo/demo/main/docs/README.skills.md";
    expect(sanitizeUrlCredentials(url)).toBe(url);
  });
});

describe("normalizeGithubRawUrl", () => {
  test("strips embedded credentials while converting blob URLs", () => {
    expect(
      normalizeGithubRawUrl(
        "https://x-access-token:ghp_exampletoken@github.com/octo/demo/blob/main/docs/README.skills.md",
      ),
    ).toBe("https://raw.githubusercontent.com/octo/demo/main/docs/README.skills.md");
  });
});
