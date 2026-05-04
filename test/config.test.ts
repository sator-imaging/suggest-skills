import { describe, expect, test } from "bun:test";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { parseCli } from "../src/config.js";
import { createHttpApp } from "../src/http.js";

const DEFAULT_SOURCE_URL =
  "https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md";

const DEFAULT_RAW_SOURCE_URL =
  "https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.skills.md";

describe("parseCli", () => {
  test("uses the manifest URL from env and converts it after loading", () => {
    const runtimeMode = parseCli(["node", "index.js"], {
      SUGGEST_SKILLS_MANIFEST_URLS: JSON.stringify([DEFAULT_SOURCE_URL]),
    });

    expect(runtimeMode.config).toEqual({
      outputDirectory: ".agents/skills",
      sourceUrls: [DEFAULT_RAW_SOURCE_URL],
    });
  });

  test("uses --manifest-urls from argv", () => {
    const runtimeMode = parseCli(
      ["node", "index.js", "--manifest-urls", "https://example.com/manifest.md"],
      {},
    );

    expect(runtimeMode.config.sourceUrls).toEqual(["https://example.com/manifest.md"]);
  });

  test("captures multiple --manifest-urls from argv", () => {
    const runtimeMode = parseCli(
      ["node", "index.js", "--manifest-urls", "aa", "bb", "cc"],
      {},
    );

    expect(runtimeMode.config.sourceUrls).toEqual(["aa", "bb", "cc"]);
  });

  test("combines env and --manifest-urls without duplicates", () => {
    const runtimeMode = parseCli(
      ["node", "index.js", "--manifest-urls", "https://example.com/1.md", "https://example.com/2.md"],
      {
        SUGGEST_SKILLS_MANIFEST_URLS: JSON.stringify([
          "https://example.com/2.md",
          "https://example.com/3.md",
        ]),
      },
    );

    expect(runtimeMode.config.sourceUrls).toEqual([
      "https://example.com/2.md",
      "https://example.com/3.md",
      "https://example.com/1.md",
    ]);
  });

  test("stops reading --manifest-urls when next option is found", () => {
    const runtimeMode = parseCli(
      [
        "node",
        "index.js",
        "--manifest-urls",
        "https://example.com/1.md",
        "-o",
        "./out",
        "https://example.com/2.md",
      ],
      {},
    );

    expect(runtimeMode.config.sourceUrls).toEqual(["https://example.com/1.md"]);
    expect(runtimeMode.config.outputDirectory).toBe("./out");
  });

  test("throws ConfigError when no URLs are provided", () => {
    expect(() => parseCli(["node", "index.js"], {})).toThrow(
      /SUGGEST_SKILLS_MANIFEST_URLS environment variable or --manifest-urls CLI option must contain at least one URL./,
    );
  });

  test("does not throw ConfigError when --help is used without URLs", () => {
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;
    let exitCode: number | undefined;
    let stdoutData = "";

    (process.exit as any) = (code: number) => {
      exitCode = code;
      throw new Error("EXIT");
    };
    (process.stdout.write as any) = (data: string | Uint8Array) => {
      stdoutData += typeof data === "string" ? data : new TextDecoder().decode(data);
      return true;
    };

    try {
      parseCli(["node", "index.js", "--help"], {});
    } catch (e: any) {
      if (e.message !== "EXIT") {
        throw e;
      }
    } finally {
      process.exit = originalExit;
      process.stdout.write = originalWrite;
    }

    expect(exitCode).toBe(0);
    expect(stdoutData).toContain("Usage:");
    expect(stdoutData).toContain("suggest-skills");
  });

  test("does not throw ConfigError when --version is used without URLs", () => {
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;
    let exitCode: number | undefined;
    let stdoutData = "";

    (process.exit as any) = (code: number) => {
      exitCode = code;
      throw new Error("EXIT");
    };
    (process.stdout.write as any) = (data: string | Uint8Array) => {
      stdoutData += typeof data === "string" ? data : new TextDecoder().decode(data);
      return true;
    };

    try {
      parseCli(["node", "index.js", "--version"], {});
    } catch (e: any) {
      if (e.message !== "EXIT") {
        throw e;
      }
    } finally {
      process.exit = originalExit;
      process.stdout.write = originalWrite;
    }

    expect(exitCode).toBe(0);
    expect(stdoutData).toMatch(/suggest-skills\/\d+\.\d+\.\d+/u);
  });

  test("does not throw ConfigError and shows version when subcommand --version is used without URLs", () => {
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;
    let exitCode: number | undefined;
    let stdoutData = "";

    (process.exit as any) = (code: number) => {
      exitCode = code;
      throw new Error("EXIT");
    };
    (process.stdout.write as any) = (data: string | Uint8Array) => {
      stdoutData += typeof data === "string" ? data : new TextDecoder().decode(data);
      return true;
    };

    try {
      parseCli(["node", "index.js", "generate", "--version"], {});
    } catch (e: any) {
      if (e.message !== "EXIT") {
        throw e;
      }
    } finally {
      process.exit = originalExit;
      process.stdout.write = originalWrite;
    }

    expect(exitCode).toBe(0);
    expect(stdoutData).toMatch(/suggest-skills\/\d+\.\d+\.\d+/u);
  });

  test("does not throw ConfigError when subcommand --help is used without URLs", () => {
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;
    let exitCode: number | undefined;
    let stdoutData = "";

    (process.exit as any) = (code: number) => {
      exitCode = code;
      throw new Error("EXIT");
    };
    (process.stdout.write as any) = (data: string | Uint8Array) => {
      stdoutData += typeof data === "string" ? data : new TextDecoder().decode(data);
      return true;
    };

    try {
      parseCli(["node", "index.js", "server", "--help"], {});
    } catch (e: any) {
      if (e.message !== "EXIT") {
        throw e;
      }
    } finally {
      process.exit = originalExit;
      process.stdout.write = originalWrite;
    }

    expect(exitCode).toBe(0);
    expect(stdoutData).toContain("Usage:");
    expect(stdoutData).toContain("suggest-skills server");
  });
});

describe("stdio MCP server", () => {
  test("prints the tool response returned over stdio with the original GitHub URL in env", async () => {
    const server = Bun.spawn(["bun", "src/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUGGEST_SKILLS_MANIFEST_URLS: JSON.stringify([DEFAULT_SOURCE_URL]),
      },
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
    });

    const messages: JSONRPCMessage[] = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "suggest-skills-test",
            version: "1.0.0",
          },
        },
      },
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "suggest_skills",
          arguments: {},
        },
      },
    ];

    server.stdin.write(`${messages.map((message) => JSON.stringify(message)).join("\n")}\n`);
    await server.stdin.flush();
    server.stdin.end();

    const stdout = await new Response(server.stdout).text();
    const stderr = await new Response(server.stderr).text();
    const exitCode = await server.exited;
    const responses = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const initializeResponse = responses.find((response) => response["id"] === 1);
    const toolResponse = responses.find((response) => response["id"] === 2);

    console.log(JSON.stringify(responses, null, 2));

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(DEFAULT_SOURCE_URL).toContain("github.com/github/awesome-copilot/blob/main/");
    expect(initializeResponse).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
    });
    expect(toolResponse).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      result: {
        content: [
          {
            type: "text",
          },
        ],
      },
    });
    expect(JSON.stringify(toolResponse)).toContain(DEFAULT_RAW_SOURCE_URL);
  });

  test("overwrites manifest URL when manifestUrl argument is provided in suggest_skills tool call", async () => {
    const OVERRIDE_URL = "https://example.com/override.md";
    const server = Bun.spawn(["bun", "src/index.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUGGEST_SKILLS_MANIFEST_URLS: JSON.stringify([DEFAULT_SOURCE_URL]),
      },
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
    });

    const messages: JSONRPCMessage[] = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "suggest-skills-test",
            version: "1.0.0",
          },
        },
      },
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "suggest_skills",
          arguments: {
            manifestUrl: OVERRIDE_URL,
          },
        },
      },
    ];

    server.stdin.write(`${messages.map((message) => JSON.stringify(message)).join("\n")}\n`);
    await server.stdin.flush();
    server.stdin.end();

    const stdout = await new Response(server.stdout).text();
    const responses = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const toolResponse = responses.find((response) => response["id"] === 2);

    expect(JSON.stringify(toolResponse)).toContain(OVERRIDE_URL);
    expect(JSON.stringify(toolResponse)).not.toContain(DEFAULT_RAW_SOURCE_URL);

    await server.exited;
  });
});

describe("streamable HTTP MCP server", () => {
  test("serves health checks and handles initialize requests", async () => {
    const runtimeMode = parseCli(["node", "index.js"], {
      SUGGEST_SKILLS_MANIFEST_URLS: JSON.stringify([DEFAULT_SOURCE_URL]),
    });
    const app = createHttpApp(runtimeMode.config);

    const healthResponse = await app.fetch(
      new Request("http://localhost/health"),
      {} as never,
    );

    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ status: "ok" });

    const initializeResponse = await app.fetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "suggest-skills-http-test",
              version: "1.0.0",
            },
          },
        }),
      }),
      {} as never,
    );

    expect(initializeResponse.status).toBe(200);
    expect(initializeResponse.headers.get("mcp-session-id")).toBeNull();
    expect(await initializeResponse.text()).toContain('"id":1');
  });
});
