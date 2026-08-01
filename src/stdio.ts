import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import type { SuggestSkillsConfig } from "./config.js";
import { createServer } from "./core.js";

export async function startStdioServer(config: SuggestSkillsConfig): Promise<void> {
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}
