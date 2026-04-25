import { ConfigError, loadConfig } from "./config.js";
import { runGenerateCommand } from "./generate.js";
import { startHttpServer } from "./http.js";
import { startStdioServer } from "./stdio.js";

type RuntimeMode =
  | { kind: "stdio" }
  | { kind: "generate"; url: string }
  | { kind: "server"; port: number };

async function main(): Promise<void> {
  try {
    const runtimeMode = parseRuntimeMode(process.argv);

    if (runtimeMode.kind === "generate") {
      await runGenerateCommand(runtimeMode.url);
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
      console.error(`Configuration error: ${message}`);
      process.exitCode = 1;
      return;
    }

    console.error(message);
    process.exitCode = 1;
  }
}

function parseRuntimeMode(argv: readonly string[]): RuntimeMode {
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";

    if (arg === "--generate") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new ConfigError("--generate requires a GitHub skills directory URL.");
      }

      return {
        kind: "generate",
        url: value,
      };
    }

    if (arg.startsWith("--generate=")) {
      const value = arg.slice("--generate=".length);

      if (!value) {
        throw new ConfigError("--generate requires a GitHub skills directory URL.");
      }

      return {
        kind: "generate",
        url: value,
      };
    }

    if (arg === "--server") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new ConfigError("--server requires a port number.");
      }

      return {
        kind: "server",
        port: parsePort(value),
      };
    }

    if (arg.startsWith("--server=")) {
      const value = arg.slice("--server=".length);

      if (!value) {
        throw new ConfigError("--server requires a port number.");
      }

      return {
        kind: "server",
        port: parsePort(value),
      };
    }
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
