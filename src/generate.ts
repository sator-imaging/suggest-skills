import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Fibers } from "ts-fibers";
import type { GithubDirectoryLocation } from "./utils.js";
import { logInfo, parseUrl } from "./utils.js";
import {
  fetchTextContent,
  listGithubDirectory,
  resolveGithubFolderUrl,
  type GithubContentEntry,
} from "./download.js";

export type GeneratedDocument = {
  markdown: string;
  outputFileName: string;
};

export type GeneratedOutputs = {
  agents: GeneratedDocument;
  design: GeneratedDocument;
  manifest: GeneratedDocument;
};

type GeneratedEntry = {
  assets: string[];
  description: string;
  name: string;
  url: string;
};

type DirectorySummary = {
  assets: string[];
  designFileUrl?: string;
  skillFileUrl?: string;
};

type AgentFileSummary = {
  path: string;
  url: string;
};

type FrontMatter = {
  description: string;
  name: string;
};

type ManifestWriter = {
  confirmOverwrite: (path: string) => Promise<boolean>;
  fileExists: (path: string) => Promise<boolean>;
  workingDirectory: () => string;
  writeFile: (path: string, content: string) => Promise<void>;
};

const SKILL_DOWNLOAD_CONCURRENCY = 4;
const GITHUB_HOSTNAME = "github.com";

export async function generateSkillsManifest(url: string): Promise<GeneratedDocument> {
  const outputs = await generateOutputs(url);
  return outputs.manifest;
}

export async function generateOutputs(url: string): Promise<GeneratedOutputs> {
  const rootLocation = resolveGenerateRootLocation(url)
    ?? await resolveGithubFolderUrl(url);
  const rootEntries = await listGithubDirectory(rootLocation);
  const agentFiles = rootEntries
    .filter((entry) => entry.type === "file")
    .sort((left, right) => left.path.localeCompare(right.path));
  const candidateDirectories = rootEntries
    .filter((entry) => entry.type === "dir")
    .sort((left, right) => left.path.localeCompare(right.path));
  const agentEntries = await summarizeAgentFiles(rootLocation, agentFiles);
  const summaries = await summarizeDirectories(rootLocation, candidateDirectories);

  const manifestEntries = summaries
    .map((summary) => summary.manifest)
    .filter((entry): entry is GeneratedEntry => entry !== undefined);
  const designEntries = summaries
    .map((summary) => summary.design)
    .filter((entry): entry is GeneratedEntry => entry !== undefined);

  logInfo(`Finished summarize all agents: ${agentEntries.length}`);
  logInfo(`Finished summarize all skills: ${manifestEntries.length}`);
  logInfo(`Finished summarize all designs: ${designEntries.length}`);

  return {
    agents: {
      markdown: buildMarkdown(agentEntries, {
        emptyDescription: "None",
        includeAssets: false,
      }),
      outputFileName: `${rootLocation.owner}.${rootLocation.repo}.agents.md`,
    },
    design: {
      markdown: buildMarkdown(designEntries, {
        emptyDescription: "None",
        includeAssets: true,
      }),
      outputFileName: `${rootLocation.owner}.${rootLocation.repo}.designs.md`,
    },
    manifest: {
      markdown: buildMarkdown(manifestEntries, {
        emptyDescription: "",
        includeAssets: true,
      }),
      outputFileName: `${rootLocation.owner}.${rootLocation.repo}.skills.md`,
    },
  };
}

export async function writeGeneratedManifest(
  manifest: GeneratedDocument,
  writer: ManifestWriter = createDefaultManifestWriter(),
): Promise<string | undefined> {
  if (isEmptyGeneratedDocument(manifest)) {
    return undefined;
  }

  const outputPath = join(writer.workingDirectory(), manifest.outputFileName);
  const exists = await writer.fileExists(outputPath);

  if (exists) {
    const shouldOverwrite = await writer.confirmOverwrite(outputPath);

    if (!shouldOverwrite) {
      throw new Error(`Refusing to overwrite "${manifest.outputFileName}".`);
    }
  }

  await writer.writeFile(outputPath, manifest.markdown);

  return outputPath;
}

export async function runGenerateCommand(url: string): Promise<void> {
  const outputs = await generateOutputs(url);
  const agentsPath = await writeGeneratedManifest(outputs.agents);
  const manifestPath = await writeGeneratedManifest(outputs.manifest);
  const designPath = await writeGeneratedManifest(outputs.design);

  if (agentsPath) {
    process.stdout.write(`Wrote ${agentsPath}\n`);
  }

  if (manifestPath) {
    process.stdout.write(`Wrote ${manifestPath}\n`);
  }

  if (designPath) {
    process.stdout.write(`Wrote ${designPath}\n`);
  }
}

async function summarizeAgentFiles(
  rootLocation: GithubDirectoryLocation,
  agentFiles: GithubContentEntry[],
): Promise<GeneratedEntry[]> {
  const results = Array.from<GeneratedEntry | undefined>({ length: agentFiles.length });
  const fibers = Fibers.forEach(
    SKILL_DOWNLOAD_CONCURRENCY,
    agentFiles.map((entry, index) => ({
      index,
      summary: {
        path: entry.path,
        url: formatGithubFileUrl(rootLocation, entry.path),
      },
    })),
    async ({ index, summary }) => ({
      entry: await summarizeAgentFile(summary),
      index,
    }),
  );

  for await (const result of fibers) {
    results[result.index] = result.entry;
  }

  return results.filter((entry): entry is GeneratedEntry => entry !== undefined);
}

async function summarizeDirectories(
  rootLocation: GithubDirectoryLocation,
  candidateDirectories: GithubContentEntry[],
): Promise<Array<{ design?: GeneratedEntry; manifest?: GeneratedEntry }>> {
  const results = Array.from<{ design?: GeneratedEntry; manifest?: GeneratedEntry } | undefined>({
    length: candidateDirectories.length,
  });
  const fibers = Fibers.forEach(
    SKILL_DOWNLOAD_CONCURRENCY,
    candidateDirectories.map((entry, index) => ({ index, path: entry.path })),
    async ({ index, path }) => ({
      index,
      summary: await summarizeDirectory(rootLocation, path),
    }),
  );

  for await (const result of fibers) {
    results[result.index] = result.summary;
  }

  return results.filter(
    (entry): entry is { design?: GeneratedEntry; manifest?: GeneratedEntry } => entry !== undefined,
  );
}

function resolveGenerateRootLocation(url: string): GithubDirectoryLocation | undefined {
  const parsedUrl = parseUrl(url);

  if (!parsedUrl || parsedUrl.hostname !== GITHUB_HOSTNAME) {
    return undefined;
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  const [owner, rawRepo, urlType, ...remainder] = pathParts;
  const repo = rawRepo?.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;

  if (!owner || !repo) {
    return undefined;
  }

  if (urlType === undefined && remainder.length === 0) {
    return {
      owner,
      path: "",
      ref: "main",
      repo,
    };
  }

  if (urlType === "tree" && remainder.length === 1) {
    return {
      owner,
      path: "",
      ref: remainder[0] ?? "main",
      repo,
    };
  }

  if (urlType !== undefined || remainder.length !== 0) {
    return undefined;
  }

  return {
    owner,
    path: "",
    ref: "main",
    repo,
  };
}

async function summarizeAgentFile(
  summary: AgentFileSummary,
): Promise<GeneratedEntry | undefined> {
  if (!summary.path.endsWith(".md")) {
    return undefined;
  }

  const basenameValue = basename(summary.path);

  logInfo(`Starting summarize agent: ${summary.path}`);
  const fileText = await fetchTextContent(summary.url, `Agent file "${summary.path}"`);
  const frontMatter = parseFrontMatter(fileText);

  if (!frontMatter.name && !frontMatter.description) {
    logInfo(`Finished summarize agent: ${summary.path} (skipped)`);
    return undefined;
  }

  const entry = {
    assets: [],
    description: frontMatter.description || "None",
    name: frontMatter.name || basenameValue,
    url: summary.url,
  };
  logInfo(`Finished summarize agent: ${entry.name}`);

  return entry;
}

async function summarizeDirectory(
  rootLocation: GithubDirectoryLocation,
  directoryPath: string,
): Promise<{ design?: GeneratedEntry; manifest?: GeneratedEntry }> {
  logInfo(`Starting summarize skill: ${directoryPath}`);
  const summary = await collectDirectoryFiles(
    {
      ...rootLocation,
      path: directoryPath,
    },
    directoryPath,
  );
  const fallbackName = basename(directoryPath);
  const manifest = await buildEntry({
    descriptionFallback: "",
    fallbackName,
    fileLabel: "Skill",
    fileName: "SKILL.md",
    fileUrl: summary.skillFileUrl,
    rootLocation,
    sourcePath: directoryPath,
    summary,
  });
  const design = await buildEntry({
    descriptionFallback: "None",
    fallbackName,
    fileLabel: "Design",
    fileName: "DESIGN.md",
    fileUrl: summary.designFileUrl,
    rootLocation,
    sourcePath: directoryPath,
    summary,
  });

  if (manifest || design) {
    logInfo(`Finished summarize skill: ${fallbackName}`);
  } else {
    logInfo(`Finished summarize skill: ${directoryPath} (skipped)`);
  }

  const result: { design?: GeneratedEntry; manifest?: GeneratedEntry } = {};

  if (design !== undefined) {
    result.design = design;
  }

  if (manifest !== undefined) {
    result.manifest = manifest;
  }

  return result;
}

async function buildEntry({
  descriptionFallback,
  fallbackName,
  fileLabel,
  fileName,
  fileUrl,
  rootLocation,
  sourcePath,
  summary,
}: {
  descriptionFallback: string;
  fallbackName: string;
  fileLabel: string;
  fileName: "DESIGN.md" | "SKILL.md";
  fileUrl: string | undefined;
  rootLocation: GithubDirectoryLocation;
  sourcePath: string;
  summary: DirectorySummary;
}): Promise<GeneratedEntry | undefined> {
  if (!fileUrl) {
    return undefined;
  }

  const fileText = await fetchTextContent(fileUrl, `${fileLabel} file "${sourcePath}/${fileName}"`);
  const frontMatter = parseFrontMatter(fileText);

  return {
    assets: summary.assets.slice().sort((left, right) => left.localeCompare(right)),
    description: frontMatter.description || descriptionFallback,
    name: frontMatter.name || fallbackName,
    url: formatGithubFolderUrl(rootLocation, sourcePath),
  };
}

async function collectDirectoryFiles(
  location: GithubDirectoryLocation,
  rootPath: string,
): Promise<DirectorySummary> {
  const entries = await listGithubDirectory(location);
  const assets: string[] = [];
  let designFileUrl: string | undefined;
  let skillFileUrl: string | undefined;

  for (const entry of entries) {
    if (entry.type === "dir") {
      const nested = await collectDirectoryFiles(
        {
          ...location,
          path: entry.path,
        },
        rootPath,
      );

      assets.push(...nested.assets);
      designFileUrl ??= nested.designFileUrl;
      skillFileUrl ??= nested.skillFileUrl;
      continue;
    }

    if (entry.type !== "file") {
      continue;
    }

    const relativePath = toRelativePath(entry.path, rootPath);

    if (relativePath === "SKILL.md") {
      skillFileUrl = entry.download_url ?? undefined;
      continue;
    }

    if (relativePath === "DESIGN.md") {
      designFileUrl = entry.download_url ?? undefined;
      continue;
    }

    assets.push(relativePath);
  }

  const summary: DirectorySummary = { assets };

  if (designFileUrl !== undefined) {
    summary.designFileUrl = designFileUrl;
  }

  if (skillFileUrl !== undefined) {
    summary.skillFileUrl = skillFileUrl;
  }

  return summary;
}

function parseFrontMatter(content: string): FrontMatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(content);

  if (!match) {
    return { description: "", name: "" };
  }

  const frontMatter = match[1] ?? "";

  return {
    description: parseFrontMatterField(frontMatter, "description"),
    name: parseFrontMatterField(frontMatter, "name"),
  };
}

function parseFrontMatterField(frontMatter: string, fieldName: string): string {
  const lines = frontMatter.split(/\r?\n/u);
  const fieldPrefix = `${fieldName}:`;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (!line.startsWith(fieldPrefix)) {
      continue;
    }

    const rawValue = line.slice(fieldPrefix.length).trim();

    if (/^[>|][+-]?$/u.test(rawValue)) {
      const blockLines: string[] = [];

      for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex += 1) {
        const blockLine = lines[blockIndex] ?? "";

        if (blockLine === "") {
          blockLines.push("");
          continue;
        }

        if (!/^[ \t]+/u.test(blockLine)) {
          break;
        }

        blockLines.push(blockLine.trim());
      }

      return collapseWhitespace(blockLines.join(" "));
    }

    return stripQuotes(rawValue);
  }

  return "";
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function buildMarkdown(
  entries: GeneratedEntry[],
  options: {
    emptyDescription: string;
    includeAssets: boolean;
  },
): string {
  const lines = options.includeAssets
    ? [
      "| Name | Description | Bundled Assets |",
      "| -----|-------------|----------------|",
      ...entries.map((entry) => formatRow(entry, options)),
    ]
    : [
      "| Name | Description |",
      "| -----|-------------|",
      ...entries.map((entry) => formatRow(entry, options)),
    ];

  return `${lines.join("\n")}\n`;
}

function isEmptyGeneratedDocument(document: GeneratedDocument): boolean {
  return document.markdown === "| Name | Description |\n| -----|-------------|\n"
    || document.markdown === "| Name | Description | Bundled Assets |\n| -----|-------------|----------------|\n";
}

function formatRow(
  entry: GeneratedEntry,
  options: {
    emptyDescription: string;
    includeAssets: boolean;
  },
): string {
  const assets = entry.assets.length === 0 ? "None" : entry.assets.map((asset) => `\`${asset}\``).join(", ");
  const description = entry.description || options.emptyDescription;

  if (!options.includeAssets) {
    return `| [${escapeTableCell(entry.name)}](${entry.url}) | ${escapeTableCell(description)} |`;
  }

  return `| [${escapeTableCell(entry.name)}](${entry.url}) | ${escapeTableCell(description)} | ${escapeTableCell(assets)} |`;
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatGithubFolderUrl(location: GithubDirectoryLocation, path: string): string {
  return `https://github.com/${location.owner}/${location.repo}/tree/${location.ref}/${path}`;
}

function formatGithubFileUrl(location: GithubDirectoryLocation, path: string): string {
  return `https://github.com/${location.owner}/${location.repo}/blob/${location.ref}/${path}`;
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function toRelativePath(path: string, rootPath: string): string {
  const prefix = `${rootPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function createDefaultManifestWriter(): ManifestWriter {
  return {
    confirmOverwrite: promptForOverwrite,
    fileExists: async (path) => {
      try {
        await access(path, constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
    workingDirectory: () => process.cwd(),
    writeFile: async (path, content) => {
      await writeFile(path, content, "utf8");
    },
  };
}

async function promptForOverwrite(path: string): Promise<boolean> {
  const terminal = createInterface({ input, output });

  try {
    const answer = await terminal.question(`Overwrite ${path}? [y/N] `);
    return /^(y|yes)$/iu.test(answer.trim());
  } finally {
    terminal.close();
  }
}
