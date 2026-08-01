import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import type { Server } from "bun";
import { randomUUID } from "node:crypto";
import type { SuggestSkillsConfig } from "./config.js";
import { createServer } from "./core.js";
import { logError } from "./utils.js";

const sessions = new Map<
  string,
  {
    transport: WebStandardStreamableHTTPServerTransport;
    server: ReturnType<typeof createServer>;
  }
>();

export function createHttpApp(config: SuggestSkillsConfig, port?: number): Server<undefined> {
  return Bun.serve({
    port: port ?? 0,
    async fetch(req: Request) {
      const url = new URL(req.url);
      if (url.pathname === "/health") {
        return Response.json({ status: "ok" });
      }
      if (url.pathname === "/mcp") {
        const isStateless = config.stateless !== false;

        if (isStateless) {
          const transportOptions: any = {
            sessionIdGenerator: undefined,
          };
          const transport = new WebStandardStreamableHTTPServerTransport(transportOptions);
          const server = createServer(config);
          await server.connect(transport);
          return transport.handleRequest(req);
        } else {
          // Stateful (session-based) mode
          const sessionId = req.headers.get("mcp-session-id");
          if (sessionId) {
            const session = sessions.get(sessionId);
            if (!session) {
              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: { code: -32001, message: "Session not found" },
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
            return session.transport.handleRequest(req);
          }

          // No session ID in headers. Create a new transport and server session.
          const server = createServer(config);
          let sessionTransport: WebStandardStreamableHTTPServerTransport | undefined;

          sessionTransport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              if (sessionTransport) {
                sessions.set(id, { transport: sessionTransport, server });
              }
            },
            onsessionclosed: (id) => {
              sessions.delete(id);
            },
          });

          await server.connect(sessionTransport);
          return sessionTransport.handleRequest(req);
        }
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
