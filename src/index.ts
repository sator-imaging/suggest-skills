import { ConfigError, parseCli } from "./config.js";
import { runDownloadCommand } from "./download.js";
import { runGenerateCommand } from "./generate.js";
import { startHttpServer } from "./http.js";
import { startStdioServer } from "./stdio.js";
import { logError } from "./utils.js";

async function main(): Promise<void> {
  try {
    const runtimeMode = parseCli();

    if (runtimeMode.kind === "generate") {
      await runGenerateCommand(runtimeMode.url, { recursive: runtimeMode.recursive });
      return;
    }

    if (runtimeMode.kind === "download") {
      await runDownloadCommand(runtimeMode.url, { recursive: runtimeMode.recursive });
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
