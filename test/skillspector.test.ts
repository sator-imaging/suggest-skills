import { describe, expect, test } from "bun:test";

function appendSecurityRiskSeparator(line: string): string {
  return line.replace(/\|\s*$/, "|---|");
}

function scanLabel(status: ScanResult["status"], score: string): string {
  switch (status) {
    case "CLONE_FAILED":
      return "Clone failed";
    case "FAILED":
      return "Failed";
    case "TIMEOUT":
      return "Timed out";
    case "OK": {
      const num = score.match(/^(\d+)/)?.[1] ?? "";
      return num === "0" ? "no problem" : "Succeeded";
    }
  }
}

type ScanResult = { status: "OK" | "FAILED" | "TIMEOUT" | "CLONE_FAILED"; score: string };

describe("skillspector report helpers", () => {
  test("appends a separator cell instead of extending the last one", () => {
    expect(appendSecurityRiskSeparator("| -----|-------------|----------------|"))
      .toBe("| -----|-------------|----------------|---|");
    expect(appendSecurityRiskSeparator("| -----|-------------|"))
      .toBe("| -----|-------------|---|");
  });

  test("uses Succeeded for completed scans with risk and no problem for zero risk", () => {
    expect(scanLabel("OK", "42/100")).toBe("Succeeded");
    expect(scanLabel("OK", "0/100")).toBe("no problem");
    expect(scanLabel("FAILED", "-")).toBe("Failed");
    expect(scanLabel("TIMEOUT", "-")).toBe("Timed out");
    expect(scanLabel("CLONE_FAILED", "-")).toBe("Clone failed");
  });
});
