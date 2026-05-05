import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Server } from "bun";
import type { SuggestSkillsConfig } from "./config.js";
import { createServer } from "./core.js";
import { logError } from "./utils.js";

export function createHttpApp(config: SuggestSkillsConfig, port?: number): Server<undefined> {
  return Bun.serve({
    port: port ?? 0,
    async fetch(req: Request) {
      const url = new URL(req.url);
      if (url.pathname === "/health") {
        return Response.json({ status: "ok" });
      }
      if (url.pathname === "/mcp") {
        const transport = new WebStandardStreamableHTTPServerTransport({});
        const server = createServer(config);
        await server.connect(transport);
        return transport.handleRequest(req);
      }
      return new Response("Not Found", { status: 404 });
    },
    error(error: Error): Response {
      logError(error.message);
      return new Response("Internal Server Error", { status: 500 });
    },
  });
}

export function startHttpServer(config: SuggestSkillsConfig, port: number): void {
  createHttpApp(config, port);
  process.stderr.write(`MCP server listening on http://localhost:${port}/mcp\n`);
}
