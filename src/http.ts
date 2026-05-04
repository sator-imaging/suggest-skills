import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Server } from "bun";
import type { SuggestSkillsConfig } from "./config.js";
import { createServer } from "./core.js";

export function createHttpApp(config: SuggestSkillsConfig, port?: number): Server {
  return Bun.serve({
    port,
    routes: {
      "/health": () => Response.json({ status: "ok" }),
      "/mcp": async (req: Request) => {
        const transport = new WebStandardStreamableHTTPServerTransport({});
        const server = createServer(config);
        await server.connect(transport);
        return transport.handleRequest(req);
      },
    },
    fetch() {
      return new Response("Not Found", { status: 404 });
    },
    error(error: Error): Response {
      process.stderr.write(`${error.message}\n`);
      return new Response("Internal Server Error", { status: 500 });
    },
  });
}

export function startHttpServer(config: SuggestSkillsConfig, port: number): void {
  createHttpApp(config, port);
  process.stderr.write(`MCP server listening on http://localhost:${port}/mcp\n`);
}
