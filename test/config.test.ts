import { describe, expect, test } from "bun:test";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "../src/config.js";
import { createHttpApp } from "../src/http.js";

const DEFAULT_SOURCE_URL =
  "https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md";

const DEFAULT_RAW_SOURCE_URL =
  "https://raw.githubusercontent.com/github/awesome-copilot/main/docs/README.skills.md";

describe("loadConfig", () => {
  test("uses the default GitHub URL fixture from env and converts it after loading", () => {
    const config = loadConfig(["suggest-skills"], {
      SUGGEST_SKILLS_MANIFEST_URLS: JSON.stringify([DEFAULT_SOURCE_URL]),
    });

    expect(config).toEqual({
      outputDirectory: ".agents/skills",
      sourceUrls: [DEFAULT_RAW_SOURCE_URL],
    });
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
});

describe("streamable HTTP MCP server", () => {
  test("serves health checks and handles initialize requests", async () => {
    const config = loadConfig(["suggest-skills"], {
      SUGGEST_SKILLS_MANIFEST_URLS: JSON.stringify([DEFAULT_SOURCE_URL]),
    });
    const app = createHttpApp(config);

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
