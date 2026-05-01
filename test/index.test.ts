import { describe, expect, test } from "bun:test";

describe("CLI", () => {
  test("prints a configuration error when required env is missing", async () => {
    const server = Bun.spawn(["bun", "src/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUGGEST_SKILLS_MANIFEST_URLS: "",
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = await new Response(server.stdout).text();
    const stderr = await new Response(server.stderr).text();
    const exitCode = await server.exited;

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("[ERROR] Configuration error:");
    expect(stderr).toContain(
      "SUGGEST_SKILLS_MANIFEST_URLS environment variable or --manifest-urls CLI option must contain at least one URL.",
    );
  });
});
