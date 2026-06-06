import { describe, expect, test } from "bun:test";
import {
  appendSeparatorCell,
  appendTableCell,
  manifestHasSecurityRisk,
} from "../eng/skillspector.ts";

describe("skillspector manifest table helpers", () => {
  test("appendSeparatorCell appends ---| after trailing pipe", () => {
    const line = "| -----|-------------|----------------|";
    expect(appendSeparatorCell(line)).toBe("| -----|-------------|----------------|---|");
  });

  test("appendSeparatorCell fixes the broken insert-before-pipe pattern", () => {
    const broken = "| -----|-------------|-------------------|";
    const fixed = "| -----|-------------|----------------|---|";
    expect(appendSeparatorCell("| -----|-------------|----------------|")).toBe(fixed);
    expect(appendSeparatorCell(broken)).not.toBe(broken);
  });

  test("appendTableCell appends a data column", () => {
    const line = "| [skill](https://github.com/o/r/tree/main/s) | desc | None |";
    expect(appendTableCell(line, "42")).toBe(
      "| [skill](https://github.com/o/r/tree/main/s) | desc | None | 42 |",
    );
  });

  test("manifestHasSecurityRisk detects an existing column", () => {
    const withColumn = "| Name | Description | Bundled Assets | Security Risk |\n| -----|-------------|----------------|---|";
    const withoutColumn = "| Name | Description | Bundled Assets |\n| -----|-------------|----------------|";
    expect(manifestHasSecurityRisk(withColumn)).toBe(true);
    expect(manifestHasSecurityRisk(withoutColumn)).toBe(false);
  });
});
