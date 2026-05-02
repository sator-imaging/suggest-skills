import { ConfigError, loadConfig } from "./config.js";
import { runGenerateCommand } from "./generate.js";
import { startHttpServer } from "./http.js";
import { startStdioServer } from "./stdio.js";
import { logError, logInfo } from "./utils.js";
import pkg from '../package.json';

type RuntimeMode =
  | { kind: "stdio" }
  | { kind: "generate"; recursive: boolean; url: string }
  | { kind: "server"; port: number };

async function main(): Promise<void> {
  try {
    if (process.argv.includes('-v') || process.argv.includes('--version')) {
      logInfo(`Version: ${pkg.version}`);
      logInfo(JSON.stringify(loadConfig(), null, 2));
      return;
    }

    const runtimeMode = parseRuntimeMode(process.argv);

    if (runtimeMode.kind === "generate") {
      await runGenerateCommand(runtimeMode.url, { recursive: runtimeMode.recursive });
      return;
    }

    const config = loadConfig();

    if (runtimeMode.kind === "server") {
      startHttpServer(config, runtimeMode.port);
      return;
    }

    await startStdioServer(config);
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

function parseRuntimeMode(argv: readonly string[]): RuntimeMode {
  const args = argv.slice(2);

  if (args[0] === "generate") {
    let url: string | undefined;
    let recursive = false;

    for (let i = 1; i < args.length; i += 1) {
      const arg = args[i] ?? "";

      if (arg === "-r" || arg === "--recursive") {
        recursive = true;
        continue;
      }

      if (!arg.startsWith("-")) {
        url = arg;
      }
    }

    if (url === undefined) {
      throw new ConfigError("generate subcommand requires a GitHub skills directory URL.");
    }

    return {
      kind: "generate",
      recursive,
      url,
    };
  }

  let serverPort: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";

    if (arg === "--server") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new ConfigError("--server requires a port number.");
      }

      serverPort = parsePort(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--server=")) {
      const value = arg.slice("--server=".length);

      if (!value) {
        throw new ConfigError("--server requires a port number.");
      }

      serverPort = parsePort(value);
    }
  }

  if (serverPort !== undefined) {
    return {
      kind: "server",
      port: serverPort,
    };
  }

  return { kind: "stdio" };
}

function parsePort(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new ConfigError(`Invalid port number: ${value}`);
  }

  const port = Number.parseInt(value, 10);

  if (port < 1 || port > 65535) {
    throw new ConfigError(`Port number must be between 1 and 65535: ${value}`);
  }

  return port;
}

await main();
