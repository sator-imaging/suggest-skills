import { McpServer, fromJsonSchema } from "@modelcontextprotocol/server";
import type { SuggestSkillsConfig } from "./config.js";
import { buildSuggestionResponse } from "./suggest.js";
import { downloadGithubFolder, fetchManifestText } from "./download.js";
import { normalizeGithubRawUrl } from "./utils.js";
import pkg from "../package.json";
import { SUGGEST_TOOL_NAME, toolDescriptions, DOWNLOAD_TOOL_NAME, FETCH_MANIFEST_TOOL_NAME } from "./constants.js";

export function createServer(config: SuggestSkillsConfig): McpServer {
  const server = new McpServer({
    name: "suggest-skills",
    version: pkg.version,
  });

  server.registerTool(
    SUGGEST_TOOL_NAME,
    {
      description: toolDescriptions.suggestSkills,
      inputSchema: fromJsonSchema<{ manifestUrl?: string }>({
        type: "object",
        properties: {
          manifestUrl: {
            type: "string",
            description: "Optional manifest URL to overwrite the default configuration.",
          },
        },
      }),
    },
    async ({ manifestUrl }) => {
      const normalizedUrl = manifestUrl ? (normalizeGithubRawUrl(manifestUrl) ?? manifestUrl) : undefined;

      return {
        content: [
          {
            type: "text" as const,
            text: buildSuggestionResponse(config, normalizedUrl),
          },
        ],
      };
    },
  );

  server.registerTool(
    DOWNLOAD_TOOL_NAME,
    {
      description: toolDescriptions.downloadSkill,
      inputSchema: fromJsonSchema<{ url: string }>({
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "GitHub folder URL in the form https://github.com/<owner>/<repo>/tree/<ref>/<path>.",
          },
        },
        required: ["url"],
      }),
      outputSchema: fromJsonSchema<{ files: Array<{ path: string; content: string }> }>({
        type: "object",
        properties: {
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "File path relative to the requested GitHub folder.",
                },
                content: {
                  type: "string",
                  description: "UTF-8 text content fetched from GitHub.",
                },
              },
              required: ["path", "content"],
            },
          },
        },
        required: ["files"],
      }),
    },
    async ({ url }) => {
      const files = await downloadGithubFolder(url);
      const structuredContent = { files };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    },
  );

  server.registerTool(
    FETCH_MANIFEST_TOOL_NAME,
    {
      description: toolDescriptions.fetchManifest,
      inputSchema: fromJsonSchema<{ url: string }>({
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL of the manifest file to fetch.",
          },
        },
        required: ["url"],
      }),
      outputSchema: fromJsonSchema<{ content: string }>({
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "UTF-8 text content fetched from the manifest URL.",
          },
        },
        required: ["content"],
      }),
    },
    async ({ url }) => {
      const content = await fetchManifestText(url);
      const structuredContent = { content };

      return {
        content: [
          {
            type: "text" as const,
            text: content,
          },
        ],
        structuredContent,
      };
    },
  );

  return server;
}
