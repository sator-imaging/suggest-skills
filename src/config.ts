import { normalizeGithubRawUrl } from "./utils.js";

export type SuggestSkillsConfig = {
  outputDirectory: string;
  sourceUrls: string[];
};

const DEFAULT_OUTPUT_DIRECTORY = ".agents/skills";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(argv = process.argv, env = process.env): SuggestSkillsConfig {
  const outputDirectory = parseOutputDirectory(argv);
  const sourceUrls = parseSourceUrls(env["SUGGEST_SKILLS_MANIFEST_URLS"]);

  if (sourceUrls.length === 0) {
    throw new ConfigError("SUGGEST_SKILLS_MANIFEST_URLS must contain at least one URL.");
  }

  return {
    outputDirectory,
    sourceUrls,
  };
}

function parseOutputDirectory(argv: readonly string[]): string {
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";

    if (arg === "-o" || arg === "--output") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new ConfigError(`${arg} requires an output directory.`);
      }

      return value;
    }

    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length);

      if (!value) {
        throw new ConfigError("--output requires an output directory.");
      }

      return value;
    }
  }

  return DEFAULT_OUTPUT_DIRECTORY;
}

function parseSourceUrls(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  const parsedValue = parseJsonSourceUrls(rawValue);
  const urls = Array.isArray(parsedValue) ? parsedValue : splitSourceUrls(rawValue);

  return urls
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .map(normalizeSourceUrl)
    .filter(Boolean);
}

function normalizeSourceUrl(sourceUrl: string): string {
  const githubRawUrl = normalizeGithubRawUrl(sourceUrl);

  return githubRawUrl ?? sourceUrl;
}

function parseJsonSourceUrls(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue);
  } catch {
    return undefined;
  }
}

function splitSourceUrls(rawValue: string): string[] {
  return rawValue
    .split(/\r?\n|,/u)
    .map((url) => url.trim())
    .filter(Boolean);
}
