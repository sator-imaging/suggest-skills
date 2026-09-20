import { Octokit } from "@octokit/rest";
import { Fibers } from "ts-fibers";
import type { GithubDirectoryLocation } from "./utils.js";
import {
  normalizeGithubRawUrl,
  parseGithubDirectoryUrl,
  parseUrl,
} from "./utils.js";

export type GithubContentEntry = {
  sha?: string;
  target?: string;
  type: "dir" | "file" | "submodule" | "symlink";
  path: string;
  download_url: string | null;
};

export type DownloadedFile = {
  path: string;
  content: string;
};

const GITHUB_HOSTNAME = "github.com";
const DOWNLOAD_CONCURRENCY = 4;

function getOctokit(): Octokit {
  const githubPat = process.env["GITHUB_PAT"];
  return new Octokit({
    auth: githubPat || undefined,
    userAgent: "suggest-skills-mcp",
    request: {
      fetch: (url: string | URL | Request, opts?: RequestInit) => {
        const urlStr = String(url);
        const parts = urlStr.split("?");
        const baseAndPath = parts[0] ?? "";
        const query = parts[1];
        const normalizedPath = baseAndPath.replace(/%2F/gi, "/");
        const finalUrl = query !== undefined ? `${normalizedPath}?${query}` : normalizedPath;
        return globalThis.fetch(finalUrl, opts);
      },
    },
  });
}

function formatOctokitError(error: any): string {
  const status = error.status || error.response?.status || 500;
  const message = error.response?.data?.message || error.message || "Request failed.";
  return `GitHub request failed with ${status}: ${message}`;
}

const MANIFEST_CACHE = new Map<string, string>();

/** @internal */
export function clearManifestCache(): void {
  MANIFEST_CACHE.clear();
}

export async function downloadGithubFolder(url: string): Promise<DownloadedFile[]> {
  const location = await resolveGithubFolderUrl(url);
  return downloadDirectory(location, location.path);
}

export async function fetchManifestText(url: string): Promise<string> {
  const cached = MANIFEST_CACHE.get(url);

  if (cached !== undefined) {
    return cached;
  }

  const content = await fetchTextContent(url, "Manifest");
  MANIFEST_CACHE.set(url, content);

  return content;
}

export async function fetchTextContent(url: string, label: string): Promise<string> {
  const response = await fetchTextResponse(url, label, url);
  return response.text;
}

export async function resolveGithubFolderUrl(url: string): Promise<GithubDirectoryLocation> {
  const simpleLocation = parseGithubDirectoryUrl(url);

  if (simpleLocation) {
    const resolvedLocation = await resolveGithubDirectoryLocation(simpleLocation);

    if (resolvedLocation) {
      return resolvedLocation;
    }
  }

  const parsedUrl = parseUrl(url);

  if (!parsedUrl || parsedUrl.hostname !== GITHUB_HOSTNAME) {
    throw new Error("Expected a GitHub folder URL.");
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  const [owner, rawRepo, urlType, ...remainder] = pathParts;
  const repo = rawRepo?.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;

  if (!owner || !repo || urlType !== "tree" || remainder.length < 2) {
    throw new Error(
      "GitHub folder URL must look like https://github.com/<owner>/<repo>/tree/<ref>/<path>.",
    );
  }

  for (let refLength = 1; refLength < remainder.length; refLength += 1) {
    const ref = remainder.slice(0, refLength).join("/");
    const path = remainder.slice(refLength).join("/");

    if (!path) {
      continue;
    }

    try {
      const octokit = getOctokit();
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        ref,
        path,
      });

      if (!Array.isArray(response.data)) {
        throw new Error("GitHub URL must point to a folder, not a file.");
      }

      return { owner, repo, ref, path };
    } catch (error: any) {
      if (error.status === 404) {
        continue;
      }
      if (error.message === "GitHub URL must point to a folder, not a file.") {
        throw error;
      }
      throw new Error(formatOctokitError(error));
    }
  }

  throw new Error("Unable to resolve the folder from the GitHub URL.");
}

async function resolveGithubDirectoryLocation(
  location: GithubDirectoryLocation,
): Promise<GithubDirectoryLocation | undefined> {
  try {
    const octokit = getOctokit();
    const response = await octokit.rest.repos.getContent({
      owner: location.owner,
      repo: location.repo,
      path: location.path,
      ref: location.ref,
    });

    if (!Array.isArray(response.data)) {
      throw new Error("GitHub URL must point to a folder, not a file.");
    }

    return location;
  } catch (error: any) {
    if (error.status === 404) {
      return undefined;
    }
    if (error.message === "GitHub URL must point to a folder, not a file.") {
      throw error;
    }
    throw new Error(formatOctokitError(error));
  }
}

async function downloadDirectory(
  location: GithubDirectoryLocation,
  rootPath: string,
  virtualPath = location.path,
  ancestry = new Set<string>(),
): Promise<DownloadedFile[]> {
  if (ancestry.has(location.path)) {
    throw new Error(`Detected recursive GitHub symlink cycle at "${location.path}".`);
  }

  const nextAncestry = new Set(ancestry);
  nextAncestry.add(location.path);
  const entries = await listGithubDirectory(location);
  const results = Array.from<Array<DownloadedFile> | undefined>({ length: entries.length });
  const fibers = Fibers.forEach(
    DOWNLOAD_CONCURRENCY,
    entries.map((entry, index) => ({ entry, index })),
    async ({ entry, index }) => ({
      index,
      files: await downloadDirectoryEntry(entry, location, rootPath, virtualPath, nextAncestry),
    }),
  );

  for await (const result of fibers) {
    results[result.index] = result.files;
  }

  return results.flatMap((files) => files ?? []);
}

async function downloadDirectoryEntry(
  entry: GithubContentEntry,
  location: GithubDirectoryLocation,
  rootPath: string,
  virtualPath: string,
  ancestry: ReadonlySet<string>,
): Promise<DownloadedFile[]> {
  const virtualEntryPath = remapEntryPath(entry.path, location.path, virtualPath);

  if (entry.type === "dir") {
    return downloadDirectory(
      {
        ...location,
        path: entry.path,
      },
      rootPath,
      virtualEntryPath,
      new Set(ancestry),
    );
  }

  if (entry.type === "symlink") {
    if (entry.download_url) {
      return [await downloadFileEntry(entry.download_url, virtualEntryPath, rootPath)];
    }

    const resolvedTargetPath = resolveRepoRelativeSymlinkPath(entry.path, entry.target);

    if (resolvedTargetPath) {
      return downloadDirectory(
        {
          ...location,
          path: resolvedTargetPath,
        },
        rootPath,
        virtualEntryPath,
        new Set(ancestry),
      );
    }
  }

  if (entry.type !== "file") {
    throw new Error(`Unsupported GitHub entry type "${entry.type}" at "${entry.path}".`);
  }

  return [await downloadFileEntry(entry.download_url, virtualEntryPath, rootPath)];
}

export async function listGithubDirectory(
  location: GithubDirectoryLocation,
): Promise<GithubContentEntry[]> {
  try {
    const octokit = getOctokit();
    const response = await octokit.rest.repos.getContent({
      owner: location.owner,
      repo: location.repo,
      path: location.path,
      ref: location.ref,
    });

    if (!Array.isArray(response.data)) {
      throw new Error(`Expected "${location.path}" to be a GitHub folder.`);
    }

    return response.data as GithubContentEntry[];
  } catch (error: any) {
    if (error.message?.startsWith('Expected "')) {
      throw error;
    }
    throw new Error(formatOctokitError(error));
  }
}

export async function listGithubDirectoryRecursive(
  location: GithubDirectoryLocation,
): Promise<GithubContentEntry[]> {
  const treeSha = await resolveGithubTreeSha(location);
  try {
    const octokit = getOctokit();
    const response = await octokit.rest.git.getTree({
      owner: location.owner,
      repo: location.repo,
      tree_sha: treeSha,
      recursive: "1",
    });

    const payload = response.data;

    if (!Array.isArray(payload.tree)) {
      throw new Error(`Expected "${location.path}" to be a GitHub folder.`);
    }

    if (payload.truncated === true) {
      throw new Error(`GitHub tree response for "${location.path}" was truncated.`);
    }

    const entries: GithubContentEntry[] = [];

    for (const entry of payload.tree) {
      if (typeof entry.path !== "string") {
        continue;
      }

      const resolvedPath = location.path
        ? `${location.path}/${entry.path}`.replace(/^\/+/u, "")
        : entry.path;

      if (entry.type === "tree") {
        entries.push({
          path: resolvedPath,
          download_url: null,
          type: "dir",
        });
        continue;
      }

      if (entry.type === "blob") {
        entries.push({
          path: resolvedPath,
          download_url: buildGithubRawUrl(location.owner, location.repo, location.ref, resolvedPath),
          type: "file",
        });
      }
    }

    return entries;
  } catch (error: any) {
    if (
      error.message?.startsWith('Expected "') ||
      error.message?.includes("was truncated")
    ) {
      throw error;
    }
    throw new Error(formatOctokitError(error));
  }
}

export type CommitInfo = {
  sha: string;
  date: string;
};

export async function fetchCommitInfo(location: GithubDirectoryLocation): Promise<CommitInfo | null> {
  try {
    const octokit = getOctokit();
    let firstCommit: any;

    if (location.path) {
      const response = await octokit.rest.repos.listCommits({
        owner: location.owner,
        repo: location.repo,
        sha: location.ref,
        path: location.path,
      });
      firstCommit = response.data[0];
    } else {
      const response = await octokit.rest.repos.getCommit({
        owner: location.owner,
        repo: location.repo,
        ref: location.ref,
      });
      firstCommit = response.data;
    }

    if (!firstCommit) {
      return null;
    }

    const sha = firstCommit.sha;
    const date = firstCommit.commit?.committer?.date || firstCommit.commit?.author?.date;

    if (typeof sha !== "string" || sha === "" || typeof date !== "string" || date === "") {
      return null;
    }

    return { sha, date };
  } catch {
    return null;
  }
}

export async function fetchCommitSha(location: GithubDirectoryLocation): Promise<string> {
  try {
    const octokit = getOctokit();
    let sha: string | undefined;

    if (location.path) {
      const response = await octokit.rest.repos.listCommits({
        owner: location.owner,
        repo: location.repo,
        sha: location.ref,
        path: location.path,
      });
      sha = response.data[0]?.sha;
    } else {
      const response = await octokit.rest.repos.getCommit({
        owner: location.owner,
        repo: location.repo,
        ref: location.ref,
      });
      sha = response.data?.sha;
    }

    if (typeof sha === "string" && sha !== "") {
      return sha;
    }
  } catch {
    // Ignore error and proceed to fallback check below
  }

  if (location.ref === "main") {
    return fetchCommitSha({ ...location, ref: "master" });
  }

  return location.ref;
}

async function resolveGithubTreeSha(location: GithubDirectoryLocation): Promise<string> {
  if (location.path === "") {
    try {
      const octokit = getOctokit();
      const response = await octokit.rest.repos.getCommit({
        owner: location.owner,
        repo: location.repo,
        ref: location.ref,
      });

      const treeSha = response.data.commit?.tree?.sha;

      if (typeof treeSha !== "string" || treeSha === "") {
        throw new Error(`Missing tree SHA for "${location.ref}".`);
      }

      return treeSha;
    } catch (error: any) {
      if (error.message?.startsWith("Missing tree SHA")) {
        throw error;
      }
      throw new Error(formatOctokitError(error));
    }
  }

  const parentLocation = {
    ...location,
    path: dirname(location.path),
  };
  const parentEntries = await listGithubDirectory(parentLocation);
  const directoryEntry = parentEntries.find((entry) => entry.path === location.path && entry.type === "dir");

  if (typeof directoryEntry?.sha !== "string" || directoryEntry.sha === "") {
    throw new Error(`Missing tree SHA for "${location.path}".`);
  }

  return directoryEntry.sha;
}

function buildGithubRawUrl(owner: string, repo: string, ref: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

async function downloadFileEntry(
  downloadUrl: string | null,
  path: string,
  rootPath: string,
): Promise<DownloadedFile> {
  if (!downloadUrl) {
    throw new Error(`Missing download URL for "${path}".`);
  }

  const content = await fetchTextContent(downloadUrl, `File "${path}"`);

  return {
    path: toRelativePath(path, rootPath),
    content,
  };
}

function toRelativePath(path: string, rootPath: string): string {
  const prefix = `${rootPath}/`;

  if (path === rootPath) {
    return "";
  }

  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function dirname(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/");
}

function remapEntryPath(path: string, basePath: string, virtualBasePath: string): string {
  const relativePath = toRelativePath(path, basePath);

  if (!virtualBasePath) {
    return relativePath;
  }

  if (!relativePath) {
    return virtualBasePath;
  }

  return `${virtualBasePath}/${relativePath}`;
}

function resolveRepoRelativeSymlinkPath(path: string, target: string | undefined): string | undefined {
  if (!target || target.startsWith("/") || target.includes("://")) {
    return undefined;
  }

  const parts = `${dirname(path)}/${target}`.split("/");
  const normalizedParts: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      const parent = normalizedParts.pop();

      if (parent === undefined) {
        return undefined;
      }

      continue;
    }

    normalizedParts.push(part);
  }

  return normalizedParts.join("/");
}


async function fetchTextResponse(
  url: string,
  label: string,
  sourceIdentifier: string,
): Promise<{ response: Response; text: string }> {
  const normalizedUrl = normalizeGithubRawUrl(url) ?? url;
  const response = await fetch(normalizedUrl);

  if (!response.ok) {
    throw new Error(
      `${label} request failed with ${response.status}: ${response.statusText || "Request failed."}`,
    );
  }

  return {
    response,
    text: await readTextResponse(response, label, sourceIdentifier),
  };
}

async function readTextResponse(
  response: Response,
  label: string,
  sourceIdentifier: string,
): Promise<string> {
  const contentType = response.headers.get("content-type");
  const textEncoding = detectTextEncoding(contentType, sourceIdentifier);

  if (contentType && isBinaryContentType(contentType) && !textEncoding) {
    throw new Error(formatBinaryTextError(label, contentType));
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (textEncoding) {
    return decodeTextBytes(bytes, textEncoding);
  }

  if (looksBinary(bytes)) {
    throw new Error(formatBinaryTextError(label, contentType));
  }

  return new TextDecoder("utf-8").decode(bytes);
}

function formatBinaryTextError(label: string, contentType: string | null): string {
  const detail = contentType ? ` Content-Type: ${contentType}.` : "";
  return `${label} appears to be binary and cannot be returned as text.${detail}`;
}

function decodeTextBytes(
  bytes: Uint8Array,
  encoding: "utf-8" | "utf-16le" | "utf-16be",
): string {
  if (encoding === "utf-8") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  const normalizedBytes =
    encoding === "utf-16be"
      ? swapByteOrder(stripUtf16Bom(bytes, "utf-16be"))
      : stripUtf16Bom(bytes, "utf-16le");

  return new TextDecoder("utf-16").decode(normalizedBytes);
}

function stripUtf16Bom(bytes: Uint8Array, encoding: "utf-16le" | "utf-16be"): Uint8Array {
  if (
    bytes.length >= 2
    && (
      (encoding === "utf-16le" && bytes[0] === 255 && bytes[1] === 254)
      || (encoding === "utf-16be" && bytes[0] === 254 && bytes[1] === 255)
    )
  ) {
    return bytes.subarray(2);
  }

  return bytes;
}

function swapByteOrder(bytes: Uint8Array): Uint8Array {
  const swapped = new Uint8Array(bytes.length);

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    swapped[index] = bytes[index + 1] ?? 0;
    swapped[index + 1] = bytes[index] ?? 0;
  }

  if (bytes.length % 2 !== 0) {
    swapped[bytes.length - 1] = bytes[bytes.length - 1] ?? 0;
  }

  return swapped;
}

function detectTextEncoding(
  contentType: string | null,
  sourceIdentifier: string,
): "utf-8" | "utf-16le" | "utf-16be" | undefined {
  const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase();
  const charset = parseCharset(contentType);

  if (charset === "utf-8" || charset === "utf8") {
    return "utf-8";
  }

  if (charset === "utf-16le") {
    return "utf-16le";
  }

  if (charset === "utf-16be") {
    return "utf-16be";
  }

  if (charset === "utf-16") {
    return "utf-16le";
  }

  if (normalizedType === "application/octet-stream" && hasUtf8TextFileExtension(sourceIdentifier)) {
    return "utf-8";
  }

  return undefined;
}

function parseCharset(contentType: string | null): string | undefined {
  if (!contentType) {
    return undefined;
  }

  for (const parameter of contentType.split(";").slice(1)) {
    const [name, value] = parameter.split("=", 2).map((part) => part?.trim().toLowerCase());

    if (name === "charset" && value) {
      return value;
    }
  }

  return undefined;
}

function hasUtf8TextFileExtension(sourceIdentifier: string): boolean {
  const normalizedIdentifier = sourceIdentifier.toLowerCase();

  return (
    normalizedIdentifier.endsWith(".md")
    || normalizedIdentifier.endsWith(".txt")
    || normalizedIdentifier.endsWith(".json")
    || normalizedIdentifier.endsWith(".xml")
    || normalizedIdentifier.endsWith(".yaml")
    || normalizedIdentifier.endsWith(".yml")
    || normalizedIdentifier.endsWith(".js")
    || normalizedIdentifier.endsWith(".mjs")
    || normalizedIdentifier.endsWith(".cjs")
    || normalizedIdentifier.endsWith(".ts")
    || normalizedIdentifier.endsWith(".mts")
    || normalizedIdentifier.endsWith(".cts")
  );
}
function isBinaryContentType(contentType: string): boolean {
  const normalizedType = contentType.split(";")[0]?.trim().toLowerCase();

  if (!normalizedType) {
    return false;
  }

  if (normalizedType.startsWith("text/")) {
    return false;
  }

  if (
    normalizedType === "application/json" ||
    normalizedType === "application/ld+json" ||
    normalizedType === "application/xml" ||
    normalizedType === "application/javascript" ||
    normalizedType === "application/x-javascript" ||
    normalizedType === "application/typescript" ||
    normalizedType === "application/x-typescript" ||
    normalizedType === "application/yaml" ||
    normalizedType === "application/x-yaml"
  ) {
    return false;
  }

  if (normalizedType.endsWith("+json") || normalizedType.endsWith("+xml")) {
    return false;
  }

  return true;
}

function looksBinary(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }

  let suspiciousCount = 0;

  for (const byte of bytes) {
    if (byte === 0) {
      return true;
    }

    const isAllowedControl = byte === 9 || byte === 10 || byte === 13;
    const isAsciiControl = byte < 32 || byte === 127;

    if (isAsciiControl && !isAllowedControl) {
      suspiciousCount += 1;
    }
  }

  return suspiciousCount / bytes.length > 0.1;
}
