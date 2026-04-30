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
const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_HOSTNAME = "api.github.com";
const DOWNLOAD_CONCURRENCY = 4;

export async function downloadGithubFolder(url: string): Promise<DownloadedFile[]> {
  const location = await resolveGithubFolderUrl(url);
  return downloadDirectory(location, location.path);
}

export async function fetchManifestText(url: string): Promise<string> {
  return fetchTextContent(url, "Manifest");
}

export async function fetchTextContent(url: string, label: string): Promise<string> {
  const response = await fetchTextResponse(url, label);
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

    const response = await fetchGithub(
      buildContentsApiUrl({
        owner,
        repo,
        ref,
        path,
      }),
    );

    if (response.status === 404) {
      continue;
    }

    if (!response.ok) {
      throw new Error(await formatGithubApiError(response));
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      throw new Error("GitHub URL must point to a folder, not a file.");
    }

    return { owner, repo, ref, path };
  }

  throw new Error("Unable to resolve the folder from the GitHub URL.");
}

async function resolveGithubDirectoryLocation(
  location: GithubDirectoryLocation,
): Promise<GithubDirectoryLocation | undefined> {
  const response = await fetchGithub(buildContentsApiUrl(location));

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(await formatGithubApiError(response));
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("GitHub URL must point to a folder, not a file.");
  }

  return location;
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
  let fiberError: unknown;
  const fibers = Fibers.forEach(
    DOWNLOAD_CONCURRENCY,
    entries.map((entry, index) => ({ entry, index })),
    async ({ entry, index }) => ({
      index,
      files: await downloadDirectoryEntry(entry, location, rootPath, virtualPath, nextAncestry),
    }),
  );
  fibers.setErrorHandler((error) => {
    fiberError = error;
    return "stop";
  });

  for await (const result of fibers) {
    results[result.index] = result.files;
  }

  if (fiberError !== undefined) {
    throw fiberError;
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
  const response = await fetchGithub(buildContentsApiUrl(location));

  if (!response.ok) {
    throw new Error(await formatGithubApiError(response));
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(`Expected "${location.path}" to be a GitHub folder.`);
  }

  return payload as GithubContentEntry[];
}

export async function listGithubDirectoryRecursive(
  location: GithubDirectoryLocation,
): Promise<GithubContentEntry[]> {
  const treeSha = await resolveGithubTreeSha(location);
  const response = await fetchGithub(buildTreeApiUrl(location.owner, location.repo, treeSha));

  if (!response.ok) {
    throw new Error(await formatGithubApiError(response));
  }

  const payload = (await response.json()) as {
    tree?: Array<{ path?: unknown; type?: unknown }>;
    truncated?: unknown;
  };

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
}

function buildContentsApiUrl(location: GithubDirectoryLocation): string {
  const pathSuffix = location.path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const pathname = pathSuffix
    ? `/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}/contents/${pathSuffix}`
    : `/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}/contents`;
  const url = new URL(pathname, GITHUB_API_BASE_URL);

  url.searchParams.set("ref", location.ref);

  return url.toString();
}

function buildTreeApiUrl(owner: string, repo: string, treeSha: string): string {
  const pathname = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}`;
  const url = new URL(pathname, GITHUB_API_BASE_URL);
  url.searchParams.set("recursive", "1");
  return url.toString();
}

function buildCommitApiUrl(location: GithubDirectoryLocation): string {
  return new URL(
    `/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}/commits/${encodeURIComponent(location.ref)}`,
    GITHUB_API_BASE_URL,
  ).toString();
}

async function resolveGithubTreeSha(location: GithubDirectoryLocation): Promise<string> {
  if (location.path === "") {
    const response = await fetchGithub(buildCommitApiUrl(location));

    if (!response.ok) {
      throw new Error(await formatGithubApiError(response));
    }

    const payload = (await response.json()) as { commit?: { tree?: { sha?: unknown } } };
    const treeSha = payload.commit?.tree?.sha;

    if (typeof treeSha !== "string" || treeSha === "") {
      throw new Error(`Missing tree SHA for "${location.ref}".`);
    }

    return treeSha;
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

  const response = await fetchGithub(downloadUrl);

  if (!response.ok) {
    throw new Error(await formatGithubApiError(response));
  }

  return {
    path: toRelativePath(path, rootPath),
    content: await readTextResponse(response, `File "${path}"`),
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

async function formatGithubApiError(response: Response): Promise<string> {
  const payload = (await tryParseJson(response)) as { message?: unknown } | undefined;
  const message =
    typeof payload?.message === "string" ? payload.message : response.statusText || "Request failed.";

  return `GitHub request failed with ${response.status}: ${message}`;
}

async function tryParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function fetchTextResponse(
  url: string,
  label: string,
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
    text: await readTextResponse(response, label),
  };
}

async function readTextResponse(response: Response, label: string): Promise<string> {
  const contentType = response.headers.get("content-type");

  if (contentType && isBinaryContentType(contentType)) {
    throw new Error(formatBinaryTextError(label, contentType));
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const textEncoding = detectTextEncoding(contentType);

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

function detectTextEncoding(contentType: string | null): "utf-8" | "utf-16le" | "utf-16be" | undefined {
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

  return charset === "utf-16" ? "utf-16le" : undefined;
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

function fetchGithub(input: string): Promise<Response> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "suggest-skills-mcp",
  };
  const githubPat = process.env["GITHUB_PAT"];

  if (githubPat) {
    const url = parseUrl(input);

    if (url?.hostname === GITHUB_API_HOSTNAME) {
      headers["authorization"] = `Bearer ${githubPat}`;
    }
  }

  return fetch(input, {
    headers,
  });
}
