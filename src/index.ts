import { ConfigError, loadConfig, parseCli } from "./config.js";
import { runGenerateCommand } from "./generate.js";
import { startHttpServer } from "./http.js";
import { startStdioServer } from "./stdio.js";
import { logError, logInfo } from "./utils.js";
import pkg from "../package.json";

async function main(): Promise<void> {
  try {
    const runtimeMode = parseCli();

    if (runtimeMode.kind === "help") {
      runtimeMode.cli.outputHelp();
      return;
    }

    if (runtimeMode.kind === "version") {
      logInfo(`Version: ${pkg.version}`);
      logInfo(JSON.stringify(loadConfig(), null, 2));
      return;
    }

    if (runtimeMode.kind === "generate") {
      await runGenerateCommand(runtimeMode.url, { recursive: runtimeMode.recursive });
      return;
    }

    if (runtimeMode.kind === "server") {
      startHttpServer(runtimeMode.config, runtimeMode.port);
      return;
    }

    await startStdioServer(runtimeMode.config);
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
