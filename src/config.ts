// @ts-expect-error cac types are not correctly resolved with "moduleResolution": "Bundler"
import { cac } from "cac";
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
  const cli = cac();
  cli.option("--manifest-urls <urls...>", "Manifest URLs");
  cli.option("-o, --output <dir>", "Output directory");
  const { options } = cli.parse(argv, { run: false });

  const outputDirectory = options.output ?? DEFAULT_OUTPUT_DIRECTORY;
  const envUrls = parseSourceUrls(env["SUGGEST_SKILLS_MANIFEST_URLS"]);

  const cliUrlsRaw = options.manifestUrls;
  const cliUrls = normalizeAndFilterUrls(
    Array.isArray(cliUrlsRaw) ? cliUrlsRaw : cliUrlsRaw ? [cliUrlsRaw] : [],
  );

  const sourceUrls = Array.from(new Set([...envUrls, ...cliUrls]));

  if (sourceUrls.length === 0) {
    throw new ConfigError(
      "SUGGEST_SKILLS_MANIFEST_URLS environment variable or --manifest-urls CLI option must contain at least one URL.",
    );
  }

  return {
    outputDirectory,
    sourceUrls,
  };
}

function parseSourceUrls(rawValue: string | undefined): string[] {
  if (rawValue === undefined) {
    return [];
  }

  if (!rawValue) {
    return [];
  }

  const parsedValue = parseJsonSourceUrls(rawValue);
  const urls = Array.isArray(parsedValue) ? (parsedValue as unknown[]) : splitSourceUrls(rawValue);

  return normalizeAndFilterUrls(urls);
}

function normalizeAndFilterUrls(urls: unknown[]): string[] {
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
