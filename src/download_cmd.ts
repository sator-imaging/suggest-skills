import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname as nodeDirname } from "node:path";
import {
  downloadGithubFolder,
  fetchTextContent,
  listGithubDirectoryRecursive,
  resolveGithubFolderUrl,
} from "./download.js";
import { logInfo, parseUrl } from "./utils.js";

export async function runDownloadCommand(url: string, options: { recursive?: boolean }) {
  const parsedUrlForHostname = parseUrl(url);
  const hostname = parsedUrlForHostname?.hostname ?? "github.com";

  let location;
  try {
    location = await resolveGithubFolderUrl(url);
  } catch (error) {
    const rootLocation = resolveRootLocation(url);
    if (rootLocation) {
      location = rootLocation;
    } else {
      throw error;
    }
  }

  logInfo(`Scanning for candidates in ${url}${options.recursive ? " (recursive)" : ""}...`);
  const entries = await listGithubDirectoryRecursive(location);

  const folderCandidates = new Set<string>();
  const fileCandidates: { path: string; url: string }[] = [];

  // Check if target folder itself is a candidate
  const isTargetCandidate = entries.some((e) => {
    const relPath = toRelativePath(e.path, location.path);
    return relPath === "SKILL.md" || relPath === "DESIGN.md";
  });

  if (isTargetCandidate) {
    folderCandidates.add(location.path);
  }

  for (const entry of entries) {
    if (entry.type === "file") {
      const fileName = basename(entry.path);
      const dir = dirname(entry.path);
      const relDir = toRelativePath(dir, location.path);

      const isImmediateChild = relDir !== "" && !relDir.includes("/");
      const isRoot = relDir === "";

      if (fileName === "SKILL.md" || fileName === "DESIGN.md") {
        if (options.recursive || isImmediateChild || isRoot) {
          folderCandidates.add(dir);
        }
      } else if (fileName.endsWith(".md")) {
        // For agents, we only take them from the root if not recursive
        if (options.recursive || isRoot) {
          if (entry.download_url) {
            fileCandidates.push({ path: entry.path, url: entry.download_url });
          }
        }
      }
    }
  }

  // Filter out nested folder candidates (keep only the top-most one)
  const sortedCandidates = Array.from(folderCandidates).sort((a, b) => a.length - b.length);
  const finalFolderCandidates = new Set<string>();
  for (const c of sortedCandidates) {
    let isNested = false;
    for (const existing of finalFolderCandidates) {
      if (c.startsWith(existing + "/") || (existing === "" && c !== "")) {
        isNested = true;
        break;
      }
    }
    if (!isNested) {
      finalFolderCandidates.add(c);
    }
  }

  const filteredFileCandidates = fileCandidates.filter((file) => {
    for (const folder of finalFolderCandidates) {
      if (file.path === folder || file.path.startsWith(folder + "/")) {
        return false;
      }
    }
    return true;
  });

  for (const folderPath of finalFolderCandidates) {
    const folderUrl = `https://github.com/${location.owner}/${location.repo}/tree/${location.ref}/${folderPath}`;
    logInfo(`Downloading folder: ${folderPath || "(root)"}`);
    const files = await downloadGithubFolder(folderUrl);
    for (const file of files) {
      const fullRepoPath = folderPath ? `${folderPath}/${file.path}` : file.path;
      await saveFile(hostname, location, fullRepoPath, file.content);
    }
  }

  for (const file of filteredFileCandidates) {
    logInfo(`Downloading file: ${file.path}`);
    const content = await fetchTextContent(file.url, `File ${file.path}`);
    await saveFile(hostname, location, file.path, content);
  }
}

async function saveFile(
  hostname: string,
  location: { owner: string; repo: string },
  repoPath: string,
  content: string,
) {
  const outputPath = join(hostname, location.owner, location.repo, ...repoPath.split("/"));
  await mkdir(nodeDirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
  logInfo(`Saved: ${outputPath}`);
}

function resolveRootLocation(url: string) {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl || (parsedUrl.hostname !== "github.com" && parsedUrl.hostname !== "raw.githubusercontent.com")) {
    return undefined;
  }
  const parts = parsedUrl.pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const owner = parts[0]!;
    const repo = parts[1]!.endsWith(".git") ? parts[1]!.slice(0, -4) : parts[1]!;
    let ref = "main";
    let path = "";
    if (parts[2] === "tree" && parts[3]) {
      ref = parts[3];
      path = parts.slice(4).join("/");
    } else if (parts[2] === "blob" && parts[3]) {
      ref = parts[3];
      path = parts.slice(4).join("/");
    }
    return { owner, repo, ref, path };
  }
  return undefined;
}

function toRelativePath(path: string, rootPath: string): string {
  if (path === rootPath) {
    return "";
  }
  if (rootPath === "") {
    return path;
  }
  const prefix = `${rootPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? "";
}

function dirname(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) {
    return "";
  }
  return parts.slice(0, -1).join("/");
}
