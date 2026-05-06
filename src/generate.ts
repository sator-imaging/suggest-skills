import type { GithubContentEntry } from "./download.js";
import type { GithubDirectoryLocation } from "./utils.js";

export type DirectorySummary = {
  assets: string[];
  designFileUrl?: string;
  skillFileUrl?: string;
};

export type TreeAnalysis = {
  immediateEntries: GithubContentEntry[];
  recursiveCandidateDirectories: string[];
  summariesByDirectory: Map<string, DirectorySummary>;
};

export function formatGithubFolderUrl(location: GithubDirectoryLocation, path: string): string {
  const suffix = path ? `/${path}` : "";
  return `https://github.com/${location.owner}/${location.repo}/tree/${location.ref}${suffix}`;
}

export function formatGithubFileUrl(location: GithubDirectoryLocation, path: string): string {
  const suffix = path ? `/${path}` : "";
  return `https://github.com/${location.owner}/${location.repo}/blob/${location.ref}${suffix}`;
}

export function basename(path: string): string {
  const end = trimTrailingSlashes(path);

  if (end === 0) {
    return "";
  }

  const start = path.lastIndexOf("/", end - 1);
  return path.slice(start + 1, end);
}

export function dirname(path: string): string {
  const end = trimTrailingSlashes(path);

  if (end === 0) {
    return "";
  }

  const slashIndex = path.lastIndexOf("/", end - 1);

  if (slashIndex === -1) {
    return "";
  }

  return path.slice(0, slashIndex);
}

export function shouldIgnoreGeneratedAsset(path: string): boolean {
  return basename(path).startsWith(".");
}

export function toRelativePath(path: string, rootPath: string): string {
  if (path === rootPath) {
    return "";
  }

  if (rootPath === "") {
    return path;
  }

  const prefix = `${rootPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function trimTrailingSlashes(path: string): number {
  let end = path.length;

  while (end > 0 && path.charCodeAt(end - 1) === 47) {
    end -= 1;
  }

  return end;
}

export function analyzeTreeEntries(rootPath: string, treeEntries: GithubContentEntry[]): TreeAnalysis {
  const immediateEntries = new Map<string, GithubContentEntry>();
  const nestedCandidateDirectories = new Set<string>();
  const summariesByDirectory = new Map<string, DirectorySummary>();

  for (const entry of treeEntries) {
    const relativePath = toRelativePath(entry.path, rootPath);

    if (relativePath === "" || relativePath.startsWith("../")) {
      continue;
    }

    const firstSlashIndex = relativePath.indexOf("/");
    const firstSegment = firstSlashIndex === -1 ? relativePath : relativePath.slice(0, firstSlashIndex);

    if (firstSegment !== "") {
      const immediatePath = rootPath ? `${rootPath}/${firstSegment}` : firstSegment;

      if (firstSlashIndex === -1) {
        immediateEntries.set(immediatePath, entry);
      } else if (!immediateEntries.has(immediatePath)) {
        immediateEntries.set(immediatePath, {
          path: immediatePath,
          download_url: null,
          type: "dir",
        });
      }
    }

    if (entry.type !== "file") {
      continue;
    }

    const fileName = basename(entry.path);
    const directoryPath = dirname(entry.path);
    let summary = summariesByDirectory.get(directoryPath);

    if (!summary) {
      summary = { assets: [] };
      summariesByDirectory.set(directoryPath, summary);
    }

    if (fileName === "SKILL.md") {
      if (entry.download_url !== null) {
        summary.skillFileUrl = entry.download_url;
      }
      nestedCandidateDirectories.add(directoryPath);
      continue;
    }

    if (fileName === "DESIGN.md") {
      if (entry.download_url !== null) {
        summary.designFileUrl = entry.download_url;
      }
      nestedCandidateDirectories.add(directoryPath);
      continue;
    }

    if (shouldIgnoreGeneratedAsset(fileName)) {
      continue;
    }
  }

  const recursiveCandidateDirectories = Array.from(nestedCandidateDirectories)
    .sort((left, right) => left.localeCompare(right));

  for (const candidateDirectory of recursiveCandidateDirectories) {
    const summary = summariesByDirectory.get(candidateDirectory);

    if (!summary) {
      summariesByDirectory.set(candidateDirectory, { assets: [] });
    }
  }

  for (const entry of treeEntries) {
    if (entry.type !== "file") {
      continue;
    }

    let ownerDirectory = dirname(entry.path);

    while (ownerDirectory !== "") {
      if (!nestedCandidateDirectories.has(ownerDirectory)) {
        ownerDirectory = dirname(ownerDirectory);
        continue;
      }

      const ownerSummary = summariesByDirectory.get(ownerDirectory);

      if (!ownerSummary) {
        ownerDirectory = dirname(ownerDirectory);
        continue;
      }

      const relativePath = toRelativePath(entry.path, ownerDirectory);

      if (
        relativePath !== "SKILL.md"
        && relativePath !== "DESIGN.md"
        && !shouldIgnoreGeneratedAsset(relativePath)
      ) {
        ownerSummary.assets.push(relativePath);
      }

      ownerDirectory = dirname(ownerDirectory);
    }
  }

  for (const candidateDirectory of recursiveCandidateDirectories) {
    const candidateSummary = summariesByDirectory.get(candidateDirectory);

    if (!candidateSummary || candidateSummary.assets.length === 0) {
      continue;
    }

    candidateSummary.assets.sort((left, right) => left.localeCompare(right));
  }

  for (const [path, entry] of immediateEntries) {
    if (entry.type !== "dir") {
      continue;
    }

    if (!nestedCandidateDirectories.has(path)) {
      immediateEntries.delete(path);
    }
  }

  return {
    immediateEntries: Array.from(immediateEntries.values()).sort((left, right) => left.path.localeCompare(right.path)),
    recursiveCandidateDirectories,
    summariesByDirectory,
  };
}
