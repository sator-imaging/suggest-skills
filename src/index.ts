// @ts-expect-error cac types are not correctly resolved with "moduleResolution": "Bundler"
import { cac } from "cac";
import { ConfigError, loadConfig } from "./config.js";
import { runGenerateCommand } from "./generate.js";
import { startHttpServer } from "./http.js";
import { startStdioServer } from "./stdio.js";
import { logError } from "./utils.js";
import pkg from "../package.json";

async function main(): Promise<void> {
  const cli = cac("suggest-skills");

  cli
    .command("generate <url>", "Generate markdown inventories from a GitHub skills directory or repo root")
    .option("-r, --recursive", "Recursive scan")
    .action(async (url: string, options: { recursive?: boolean }) => {
      await runGenerateCommand(url, { recursive: !!options.recursive });
    });

  cli
    .command("server", "Run the streamable HTTP server")
    .option("--port <port>", "Port number")
    .action(async (options: { port?: string }) => {
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

      const config = loadConfig();
      startHttpServer(config, port);
    });

  cli
    .command("[...args]", "Run in stdio mode (default)")
    .action(async () => {
      const config = loadConfig();
      await startStdioServer(config);
    });

  cli.option("-o, --output <dir>", "Output directory for installed skills");
  cli.option("--manifest-urls <urls...>", "List of manifest URLs to use");

  cli.version(pkg.version);
  cli.help();

  try {
    cli.parse(process.argv, { run: false });
    await cli.runMatchedCommand();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof ConfigError) {
      logError(`Configuration error: ${message}`);
      process.exitCode = 1;
      return;
    }

    logError(message);
    process.exitCode = 1;
  }
}

await main();
