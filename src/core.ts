import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { SuggestSkillsConfig } from "./config.js";
import { buildSuggestionResponse } from "./suggest.js";
import { downloadGithubFolder, fetchManifestText } from "./download.js";
import { normalizeGithubRawUrl } from "./utils.js";
import pkg from "../package.json";

const SUGGEST_TOOL_NAME = "suggest_skills";
const DOWNLOAD_TOOL_NAME = "download_skill";
const FETCH_MANIFEST_TOOL_NAME = "fetch_manifest";
const toolDescriptions = {
  suggestSkills: "Suggest AI-agent skills for this repository.",
  downloadSkill:
    "Download a GitHub skill folder and return every file with its original relative path and text content.",
  fetchManifest:
    "Fetch a manifest file from a URL and return its text content.",
} as const;

export function createServer(config: SuggestSkillsConfig): McpServer {
  const server = new McpServer({
    name: "suggest-skills",
    version: pkg.version,
  });

  server.registerTool(
    SUGGEST_TOOL_NAME,
    {
      description: toolDescriptions.suggestSkills,
      inputSchema: {
        manifestUrl: z
          .string()
          .optional()
          .describe("Optional manifest URL to overwrite the default configuration."),
      },
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
      inputSchema: {
        url: z
          .string()
          .min(1)
          .describe("GitHub folder URL in the form https://github.com/<owner>/<repo>/tree/<ref>/<path>."),
      },
      outputSchema: {
        files: z.array(
          z.object({
            path: z.string().describe("File path relative to the requested GitHub folder."),
            content: z.string().describe("UTF-8 text content fetched from GitHub."),
          }),
        ),
      },
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
      inputSchema: {
        url: z.string().min(1).describe("URL of the manifest file to fetch."),
      },
      outputSchema: {
        content: z.string().describe("UTF-8 text content fetched from the manifest URL."),
      },
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
