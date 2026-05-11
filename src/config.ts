import { cac } from "cac";
import { logInfo, normalizeGithubRawUrl } from "./utils.js";
import pkg from "../package.json";

export type SuggestSkillsConfig = {
  outputDirectory: string;
  sourceUrls: string[];
};

export type CliRuntimeMode =
  | { kind: "stdio"; config: SuggestSkillsConfig }
  | { kind: "generate"; url: string; recursive: boolean; config: SuggestSkillsConfig }
  | { kind: "download"; url: string; recursive: boolean; config: SuggestSkillsConfig }
  | { kind: "server"; port: number; config: SuggestSkillsConfig };

const DEFAULT_OUTPUT_DIRECTORY = ".agents/skills";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function parseCli(argv = process.argv, env = process.env): CliRuntimeMode {
  const cli = cac("suggest-skills");
  cli.version(pkg.version);

  let runtimeMode: CliRuntimeMode | undefined;

  cli.option("-o, --output <dir>", "Output directory for installed skills");
  cli.option("--manifest-urls", "List of manifest URLs to use (ignored; use positional arguments instead)", {
    type: [Boolean],
  });

  cli
    .command("generate <url>", "Generate markdown inventories from a GitHub skills directory or repo root")
    .option("-r, --recursive", "Recursive scan")
    .action((url: string, options: { recursive?: boolean }) => {
      runtimeMode = {
        kind: "generate",
        url: normalizeGithubRawUrl(url) ?? url,
        recursive: !!options.recursive,
        config: {
          outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
          sourceUrls: [],
        },
      };
    });

  cli
    .command("download <url>", "Download skills, agents and designs to the current directory")
    .option("-r, --recursive", "Recursive scan")
    .action((url: string, options: { recursive?: boolean }) => {
      runtimeMode = {
        kind: "download",
        url: normalizeGithubRawUrl(url) ?? url,
        recursive: !!options.recursive,
        config: {
          outputDirectory: ".",
          sourceUrls: [],
        },
      };
    });

  cli
    .command("server [...args]", "Run the streamable HTTP server")
    .option("--port <port>", "Port number")
    .action((args: string[], options: { port?: string; output?: string }) => {
      if (options.port === undefined) {
        throw new ConfigError("server subcommand requires --port <number>.");
      }

      const portValue = options.port;
      if (!/^\d+$/u.test(portValue)) {
        throw new ConfigError(`Invalid port number: ${portValue}`);
      }

      const port = Number.parseInt(portValue, 10);
      if (port < 1 || port > 65535) {
        throw new ConfigError(`Port number must be between 1 and 65535: ${portValue}`);
      }

      runtimeMode = {
        kind: "server",
        port,
        config: buildConfig(args, options, env),
      };
    });

  cli
    .command("[...args]", "Run in stdio mode (default)")
    .action((args: string[], options: { output?: string }) => {
      runtimeMode = {
        kind: "stdio",
        config: buildConfig(args, options, env),
      };
    });

  const parsed = cli.parse(argv, { run: false });

  if (parsed.options["version"]) {
    logInfo(`${pkg.name}/${pkg.version} ${process.platform}-${process.arch}`);
    process.exit(0);
  }

  if (parsed.options["help"]) {
    cli.help((sections) => {
      for (const section of sections) {
        if (section.title) {
          logInfo(`${section.title}:`);
        }
        logInfo(section.body);
        logInfo("");
      }
      return [];
    });
    cli.outputHelp();
    process.exit(0);
  }

  cli.runMatchedCommand();

  if (!runtimeMode) {
    // Should not happen with [...args] catch-all
    throw new Error("Failed to determine runtime mode.");
  }

  return runtimeMode;
}

export function loadConfig(argv = process.argv, env = process.env): SuggestSkillsConfig {
  const cli = cac();
  cli.option("--manifest-urls", "Manifest URLs", { type: [Boolean] });
  cli.option("-o, --output <dir>", "Output directory");
  const { args, options } = cli.parse(argv, { run: false });

  return buildConfig(args, options as Parameters<typeof buildConfig>[1], env);
}

function buildConfig(
  args: string[],
  options: { output?: string },
  env: NodeJS.ProcessEnv,
): SuggestSkillsConfig {
  const outputDirectory = options.output ?? DEFAULT_OUTPUT_DIRECTORY;
  const envUrls = parseSourceUrls(env["SUGGEST_SKILLS_MANIFEST_URLS"]);

  const cliUrls = normalizeAndFilterUrls(args);

  const sourceUrls = Array.from(new Set([...envUrls, ...cliUrls]));

  if (sourceUrls.length === 0) {
    throw new ConfigError(
      "SUGGEST_SKILLS_MANIFEST_URLS environment variable or positional arguments must contain at least one URL.",
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
    .map((url) => {
      if (!url.toLowerCase().endsWith(".md")) {
        throw new ConfigError(`Manifest URL must end with .md: ${url}`);
      }
      return url;
    })
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
