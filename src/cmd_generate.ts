import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Fibers } from "ts-fibers";
import type { GithubDirectoryLocation } from "./utils.js";
import { logInfo, logWarning, parseMarkdownFrontMatterFields, parseUrl } from "./utils.js";
import {
  fetchCommitSha,
  fetchTextContent,
  listGithubDirectoryRecursive,
  resolveGithubFolderUrl,
  type GithubContentEntry,
} from "./download.js";
import {
  analyzeTreeEntries,
  basename,
  dirname,
  formatGithubFileUrl,
  formatGithubFolderUrl,
  type DirectorySummary,
} from "./generate.js";

export type GeneratedDocument = {
  markdown: string;
  outputFileName: string;
};

export type GeneratedOutputs = {
  agents: GeneratedDocument;
  design: GeneratedDocument;
  manifest: GeneratedDocument;
};

export type GenerateOptions = {
  recursive?: boolean;
  delayMillis?: number;
};

type GeneratedEntry = {
  assets: string[];
  assetBlobBaseUrl: string;
  assetTreeBaseUrl: string;
  description: string;
  name: string;
  url: string;
};


type AgentFileSummary = {
  path: string;
  url: string;
};

type GeneratedOutputKey = keyof GeneratedOutputs;

type MarkdownBuildOptions = {
  emptyDescription: string;
  includeAssets: boolean;
  linkAssets: boolean;
};

type ManifestWriter = {
  confirmOverwrite: (path: string) => Promise<boolean>;
  fileExists: (path: string) => Promise<boolean>;
  workingDirectory: () => string;
  writeFile: (path: string, content: string) => Promise<void>;
};

const MANIFEST_DOWNLOAD_CONCURRENCY = 4;
const GITHUB_HOSTNAME = "github.com";
const BUNDLED_ASSETS_NONE = "None";
const BUNDLED_ASSETS_INLINE_MAX_ITEMS = 3;
const GENERATED_OUTPUT_KIND_SUFFIXES = {
  agents: "agents",
  design: "designs",
  manifest: "skills",
} as const satisfies Record<GeneratedOutputKey, string>;
const GENERATED_MARKDOWN_OPTIONS = {
  agents: {
    emptyDescription: "None",
    includeAssets: false,
    linkAssets: false,
  },
  design: {
    emptyDescription: "None",
    includeAssets: true,
    linkAssets: true,
  },
  manifest: {
    emptyDescription: "",
    includeAssets: true,
    linkAssets: false,
  },
} as const satisfies Record<GeneratedOutputKey, MarkdownBuildOptions>;

export async function generateSkillsManifest(
  url: string,
  options: GenerateOptions = {},
): Promise<GeneratedDocument> {
  const outputs = await generateOutputs(url, options);
  return outputs.manifest;
}

export async function generateOutputs(
  url: string,
  options: GenerateOptions = {},
  pinnedLocation?: GithubDirectoryLocation,
): Promise<GeneratedOutputs> {
  const rootLocation = pinnedLocation
    ?? resolveGenerateRootLocation(url)
    ?? await resolveGithubFolderUrl(url);
  const treeEntries = await listGithubDirectoryRecursive(rootLocation);
  const analysis = analyzeTreeEntries(rootLocation.path, treeEntries);
  const rootEntries = analysis.immediateEntries;
  const agentFiles = rootEntries
    .filter((entry) => entry.type === "file")
    .sort((left, right) => left.path.localeCompare(right.path));
  const candidateDirectories = options.recursive
    ? analysis.recursiveCandidateDirectories
    : rootEntries
      .filter((entry) => entry.type === "dir")
      .map((entry) => entry.path)
      .sort((left, right) => left.localeCompare(right));
  const agentEntries = await summarizeAgentFiles(rootLocation, agentFiles, options.delayMillis);
  const summaries = await summarizeDirectories(
    rootLocation,
    candidateDirectories,
    analysis.summariesByDirectory,
    options.delayMillis,
  );

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
      markdown: buildMarkdown(agentEntries, GENERATED_MARKDOWN_OPTIONS.agents),
      outputFileName: buildGeneratedOutputFileName(rootLocation, GENERATED_OUTPUT_KIND_SUFFIXES.agents),
    },
    design: {
      markdown: buildMarkdown(designEntries, GENERATED_MARKDOWN_OPTIONS.design),
      outputFileName: buildGeneratedOutputFileName(rootLocation, GENERATED_OUTPUT_KIND_SUFFIXES.design),
    },
    manifest: {
      markdown: buildMarkdown(manifestEntries, GENERATED_MARKDOWN_OPTIONS.manifest),
      outputFileName: buildGeneratedOutputFileName(rootLocation, GENERATED_OUTPUT_KIND_SUFFIXES.manifest),
    },
  };
}

export async function writeGeneratedManifest(
  manifest: GeneratedDocument,
  kind: string,
  writer: ManifestWriter = createDefaultManifestWriter(),
): Promise<string | undefined> {
  if (isEmptyGeneratedDocument(manifest)) {
    return undefined;
  }

  if (manifest.outputFileName.endsWith(`${kind}.${kind}.md`)) {
    manifest.outputFileName = fixRedundantTypeSuffix(manifest.outputFileName, kind);
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

export async function runGenerateCommand(
  url: string,
  options: GenerateOptions = {},
): Promise<void> {
  let writtenCount = 0;

  const rootLocation = resolveGenerateRootLocation(url)
    ?? await resolveGithubFolderUrl(url);
  rootLocation.ref = await fetchCommitSha(rootLocation);

  const outputs = await generateOutputs(url, options, rootLocation);
  const agentsPath = await writeGeneratedManifest(outputs.agents, "agents");
  const manifestPath = await writeGeneratedManifest(outputs.manifest, "skills");
  const designPath = await writeGeneratedManifest(outputs.design, "designs");

  if (agentsPath) {
    logInfo(`Wrote ${agentsPath}`);
    writtenCount += 1;
  }

  if (manifestPath) {
    logInfo(`Wrote ${manifestPath}`);
    writtenCount += 1;
  }

  if (designPath) {
    logInfo(`Wrote ${designPath}`);
    writtenCount += 1;
  }

  if (writtenCount === 0) {
    throw new Error("No manifest files were generated.");
  }
}

async function summarizeAgentFiles(
  rootLocation: GithubDirectoryLocation,
  agentFiles: GithubContentEntry[],
  delayMillis = 0,
): Promise<GeneratedEntry[]> {
  const results = Array.from<GeneratedEntry | undefined>({ length: agentFiles.length });
  const fibers = Fibers.forEach(
    MANIFEST_DOWNLOAD_CONCURRENCY,
    agentFiles.map((entry, index) => ({
      index,
      summary: {
        path: entry.path,
        url: formatGithubFileUrl(rootLocation, entry.path),
      },
    })),
    async ({ index, summary }) => {
      const result = {
        entry: await summarizeAgentFile(summary),
        index,
      };
      if (delayMillis > 0) {
        await Fibers.delay(delayMillis);
      }
      return result;
    },
  );

  for await (const result of fibers) {
    results[result.index] = result.entry;
  }

  return results.filter((entry): entry is GeneratedEntry => entry !== undefined);
}

async function summarizeDirectories(
  rootLocation: GithubDirectoryLocation,
  candidateDirectories: string[],
  summariesByDirectory: ReadonlyMap<string, DirectorySummary>,
  delayMillis = 0,
): Promise<Array<{ design?: GeneratedEntry; manifest?: GeneratedEntry }>> {
  const results = Array.from<{ design?: GeneratedEntry; manifest?: GeneratedEntry } | undefined>({
    length: candidateDirectories.length,
  });
  const fibers = Fibers.forEach(
    MANIFEST_DOWNLOAD_CONCURRENCY,
    candidateDirectories.map((path, index) => ({ index, path })),
    async ({ index, path }) => {
      const result = {
        index,
        summary: await summarizeDirectory(rootLocation, path, summariesByDirectory),
      };
      if (delayMillis > 0) {
        await Fibers.delay(delayMillis);
      }
      return result;
    },
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

  logInfo(`Fetching: ${summary.path}`);
  const fileText = await fetchTextContent(summary.url, `Agent file "${summary.path}"`);
  const frontMatter = parseMarkdownFrontMatterFields(fileText);

  if (frontMatter.parseError) {
    throw new Error(
      `Front matter YAML could not be parsed for agent "${summary.path}": ${frontMatter.parseError}\n${formatFrontMatterWarningBlock(frontMatter.source)}`,
    );
  }

  const expectedName = expectedAgentName(summary.path);
  const resolvedName = resolveFrontMatterName({
    currentName: frontMatter.name,
    expectedName,
    frontMatterSource: frontMatter.source,
    targetLabel: `agent "${summary.path}"`,
  });

  if (!resolvedName) {
    logWarning(`Skipped agent "${summary.path}" because front matter is missing required "name".`);
    return undefined;
  }

  const entry = {
    assets: [],
    assetBlobBaseUrl: summary.url,
    assetTreeBaseUrl: summary.url,
    description: frontMatter.description || "None",
    name: resolvedName,
    url: summary.url,
  };
  logInfo(`Agent summarized: ${entry.name}`);

  return entry;
}

async function summarizeDirectory(
  rootLocation: GithubDirectoryLocation,
  directoryPath: string,
  summariesByDirectory: ReadonlyMap<string, DirectorySummary>,
): Promise<{ design?: GeneratedEntry; manifest?: GeneratedEntry }> {
  logInfo(`Fetching: ${directoryPath}`);
  const summary = summariesByDirectory.get(directoryPath) ?? EMPTY_DIRECTORY_SUMMARY;
  const fallbackName = resolveDirectoryName(rootLocation, directoryPath);
  const manifest = await buildEntry({
    descriptionFallback: "",
    fileLabel: "Skill",
    fileName: "SKILL.md",
    fileUrl: summary.skillFileUrl,
    rootLocation,
    sourcePath: directoryPath,
    summary,
  });
  let design = await buildEntry({
    descriptionFallback: "None",
    fileLabel: "Design",
    fileName: "DESIGN.md",
    fileUrl: summary.designFileUrl,
    rootLocation,
    sourcePath: directoryPath,
    summary,
  });

  const designWasSkipped = design !== undefined && design.description === "None" && design.assets.length === 0;
  if (designWasSkipped) {
    logInfo(`Skipped design: ${directoryPath}`);
    design = undefined;
  }

  if (manifest) {
    logInfo(`Skill summarized: ${fallbackName}`);
  } else if (design) {
    logInfo(`Design summarized: ${fallbackName}`);
  } else if (!designWasSkipped) {
    logInfo(`Skipped skill: ${directoryPath}`);
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
  fileLabel,
  fileName,
  fileUrl,
  rootLocation,
  sourcePath,
  summary,
}: {
  descriptionFallback: string;
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
  const frontMatter = parseMarkdownFrontMatterFields(fileText);

  if (frontMatter.parseError) {
    if (fileName === "DESIGN.md") {
      logWarning(
        `Treating design "${sourcePath}/${fileName}" as markdown-only because front matter YAML could not be parsed.`,
      );
      return {
        assets: summary.assets,
        assetBlobBaseUrl: formatGithubFileUrl(rootLocation, sourcePath),
        assetTreeBaseUrl: formatGithubFolderUrl(rootLocation, sourcePath),
        description: descriptionFallback,
        name: resolveDirectoryName(rootLocation, sourcePath),
        url: formatGithubFolderUrl(rootLocation, sourcePath),
      };
    }

    throw new Error(
      `Front matter YAML could not be parsed for ${fileLabel.toLowerCase()} "${sourcePath}/${fileName}": ${frontMatter.parseError}\n${formatFrontMatterWarningBlock(frontMatter.source)}`,
    );
  }

  if (fileName === "DESIGN.md" && frontMatter.source === null) {
    return {
      assets: summary.assets,
      assetBlobBaseUrl: formatGithubFileUrl(rootLocation, sourcePath),
      assetTreeBaseUrl: formatGithubFolderUrl(rootLocation, sourcePath),
      description: descriptionFallback,
      name: resolveDirectoryName(rootLocation, sourcePath),
      url: formatGithubFolderUrl(rootLocation, sourcePath),
    };
  }

  const expectedName = resolveDirectoryName(rootLocation, sourcePath);
  const resolvedName = resolveFrontMatterName({
    currentName: frontMatter.name,
    expectedName,
    frontMatterSource: frontMatter.source,
    targetLabel: `${fileLabel.toLowerCase()} "${sourcePath}/${fileName}"`,
  });

  if (!resolvedName) {
    logWarning(`Skipped ${fileLabel.toLowerCase()} "${sourcePath}/${fileName}" because front matter is missing required "name".`);
    return undefined;
  }

  return {
    assets: summary.assets,
    assetBlobBaseUrl: formatGithubFileUrl(rootLocation, sourcePath),
    assetTreeBaseUrl: formatGithubFolderUrl(rootLocation, sourcePath),
    description: frontMatter.description || descriptionFallback,
    name: resolvedName,
    url: formatGithubFolderUrl(rootLocation, sourcePath),
  };
}

const EMPTY_DIRECTORY_SUMMARY: DirectorySummary = { assets: [] };

function buildMarkdown(
  entries: GeneratedEntry[],
  options: MarkdownBuildOptions,
): string {
  const lines = options.includeAssets
    ? [
      "| Name | Description | Bundled Assets |",
      "| -----|-------------|----------------|",
    ]
    : [
      "| Name | Description |",
      "| -----|-------------|",
    ];

  for (const entry of entries) {
    lines.push(formatRow(entry, options));
  }

  return `${lines.join("\n")}\n`;
}

function isEmptyGeneratedDocument(document: GeneratedDocument): boolean {
  return document.markdown === "| Name | Description |\n| -----|-------------|\n"
    || document.markdown === "| Name | Description | Bundled Assets |\n| -----|-------------|----------------|\n";
}

function formatRow(
  entry: GeneratedEntry,
  options: MarkdownBuildOptions,
): string {
  const assets = formatBundledAssets(entry, options);
  const description = entry.description || options.emptyDescription;

  if (!options.includeAssets) {
    return `| [${escapeTableCell(entry.name)}](${entry.url}) | ${escapeTableCell(description)} |`;
  }

  return `| [${escapeTableCell(entry.name)}](${entry.url}) | ${escapeTableCell(description)} | ${escapeTableCell(assets)} |`;
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatBundledAssets(entry: GeneratedEntry, options: MarkdownBuildOptions): string {
  if (entry.assets.length === 0) {
    return BUNDLED_ASSETS_NONE;
  }

  if (entry.assets.length <= BUNDLED_ASSETS_INLINE_MAX_ITEMS) {
    const items = Array.from({ length: entry.assets.length }, () => "");

    for (let index = 0; index < entry.assets.length; index += 1) {
      items[index] = formatAssetItem(entry.assets[index] ?? "", entry, options);
    }

    return items.join(", ");
  }

  const rootFiles: string[] = [];
  const directoryFiles = new Map<string, string[]>();

  for (const asset of entry.assets) {
    const directory = dirname(asset);

    if (directory === "") {
      rootFiles.push(asset);
      continue;
    }

    const files = directoryFiles.get(directory);

    if (files) {
      files.push(asset);
      continue;
    }

    directoryFiles.set(directory, [asset]);
  }

  rootFiles.sort((left, right) => left.localeCompare(right));

  const directoryEntries = Array.from(directoryFiles.entries())
    .sort(([left], [right]) => left.localeCompare(right));
  const items: string[] = [];

  for (const asset of rootFiles) {
    items.push(formatAssetItem(asset, entry, options));
  }

  for (const [directory, files] of directoryEntries) {
    if (files.length === 1) {
      items.push(formatAssetItem(files[0] ?? "", entry, options));
      continue;
    }

    items.push(formatCollapsedAssetDirectory(directory, files.length, entry, options));
  }

  return items.join(", ");
}

function formatAssetItem(
  asset: string,
  entry: GeneratedEntry,
  options: MarkdownBuildOptions,
): string {
  if (!options.linkAssets) {
    return `\`${asset}\``;
  }

  return `[${asset}](${entry.assetBlobBaseUrl}/${asset})`;
}

function formatCollapsedAssetDirectory(
  directory: string,
  count: number,
  entry: GeneratedEntry,
  options: MarkdownBuildOptions,
): string {
  const label = options.linkAssets
    ? `[${directory}](${entry.assetTreeBaseUrl}/${directory})`
    : `\`${directory}\``;

  return `${label} (${count} files)`;
}

function buildGeneratedOutputFileName(
  location: GithubDirectoryLocation,
  kind: typeof GENERATED_OUTPUT_KIND_SUFFIXES[keyof typeof GENERATED_OUTPUT_KIND_SUFFIXES],
): string {
  const pathSuffix = normalizePathToDotted(location.path);
  const prefix = pathSuffix === ""
    ? `${location.owner}.${location.repo}`
    : `${location.owner}.${location.repo}.${pathSuffix}`;

  return `${prefix}.${kind}.md`;
}

function resolveDirectoryName(location: GithubDirectoryLocation, path: string): string {
  if (path !== "") {
    return basename(path);
  }

  if (location.path !== "") {
    return basename(location.path);
  }

  return location.repo;
}

function withoutMarkdownExtension(path: string): string {
  return path.endsWith(".md") ? path.slice(0, -3) : path;
}

function expectedAgentName(path: string): string {
  const fileName = basename(path);

  if (fileName === "SKILL.md" || fileName === "DESIGN.md") {
    return basename(dirname(path));
  }

  return withoutMarkdownExtension(fileName);
}

function resolveFrontMatterName({
  currentName,
  expectedName,
  frontMatterSource,
  targetLabel,
}: {
  currentName: string | null;
  expectedName: string;
  frontMatterSource: string | null;
  targetLabel: string;
}): string | undefined {
  if (currentName !== null) {
    return currentName;
  }

  if (frontMatterSource === null) {
    return undefined;
  }

  const filledFrontMatter = fillFrontMatterName(frontMatterSource, expectedName);
  logWarning(`Filled missing "name" in ${targetLabel} with "${expectedName}".`);
  logInfo(formatFrontMatterWarningBlock(filledFrontMatter));
  return expectedName;
}

function fillFrontMatterName(frontMatter: string, expectedName: string): string {
  const lines = frontMatter.split(/\r?\n/u);
  const filteredLines = [`name: ${expectedName}`];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (index === 0 && line === "") {
      continue;
    }

    if (line.startsWith("name:")) {
      continue;
    }

    filteredLines.push(line);
  }

  return filteredLines.join("\n");
}

function formatFrontMatterWarningBlock(frontMatter: string | null): string {
  return `---\n${frontMatter ?? ""}\n---`;
}

function normalizePathToDotted(path: string): string {
  let result = "";

  for (let index = 0; index < path.length; index += 1) {
    const char = path[index];

    if (char === "/") {
      if (result !== "") {
        result += ".";
      }
      continue;
    }

    result += char;
  }

  return result.endsWith(".") ? result.slice(0, -1) : result;
}

function fixRedundantTypeSuffix(filename: string, kind: string): string {
  const extension = ".md";
  const suffix = kind + ".";

  let base = filename;
  if (base.endsWith(extension)) {
    base = base.slice(0, -2);  // Check extension but remove only "md"
  }

  while (base.endsWith(suffix)) {
    const preSuffixCharIndex = base.length - suffix.length - 1;
    if (preSuffixCharIndex >= 0 && base[preSuffixCharIndex] !== ".") {
      break;
    }
    base = base.slice(0, -suffix.length);
  }

  return base + kind + extension;
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
