import { parseCli } from "../src/config.js";
import { expect, test, describe } from "bun:test";

describe("download subcommand config", () => {
  test("parses download command correctly", () => {
    const mode = parseCli(["node", "suggest-skills", "download", "https://github.com/owner/repo/tree/main/path"]);
    expect(mode.kind).toBe("download");
    if (mode.kind === "download") {
      expect(mode.url).toBe("https://github.com/owner/repo/tree/main/path");
      expect(mode.recursive).toBe(false);
      expect(mode.config.outputDirectory).toBe(".");
    }
  });

  test("parses download command with recursive flag", () => {
    const mode = parseCli(["node", "suggest-skills", "download", "https://github.com/owner/repo/tree/main/path", "-r"]);
    expect(mode.kind).toBe("download");
    if (mode.kind === "download") {
      expect(mode.recursive).toBe(true);
    }
  });
});
