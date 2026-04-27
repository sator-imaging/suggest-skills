import { describe, expect, test } from "bun:test";
import {
  extractMarkdownFrontMatter,
  parseMarkdownFrontMatterFields,
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
    });
  });

  test("returns nulls when front matter is absent", () => {
    expect(parseMarkdownFrontMatterFields("# Title\n")).toEqual({
      description: null,
      name: null,
    });
  });
});
