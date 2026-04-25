import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import type { SuggestSkillsConfig } from "./config.js";
import { createServer } from "./core.js";

export function createHttpApp(config: SuggestSkillsConfig): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  app.all("/mcp", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({});
    const server = createServer(config);

    await server.connect(transport);

    return transport.handleRequest(c.req.raw);
  });

  return app;
}

export function startHttpServer(config: SuggestSkillsConfig, port: number): void {
  const app = createHttpApp(config);

  Bun.serve({
    port,
    fetch: app.fetch,
    error: (error: Error): Response => {
      process.stderr.write(`${error.message}\n`);
      return new Response("Internal Server Error", { status: 500 });
    },
  });

  process.stderr.write(`MCP server listening on http://localhost:${port}/mcp\n`);
}
