import type { GithubDirectoryLocation } from "./utils.js";
import {
  normalizeGithubRawUrl,
  parseGithubDirectoryUrl,
  parseUrl,
} from "./utils.js";

export type GithubContentEntry = {
  sha?: string;
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
): Promise<DownloadedFile[]> {
  const entries = await listGithubDirectory(location);
  const files: DownloadedFile[] = [];

  for (const entry of entries) {
    if (entry.type === "dir") {
      files.push(
        ...(await downloadDirectory(
          {
            ...location,
            path: entry.path,
          },
          rootPath,
        )),
      );
      continue;
    }

    if (entry.type !== "file") {
      throw new Error(`Unsupported GitHub entry type "${entry.type}" at "${entry.path}".`);
    }

    if (!entry.download_url) {
      throw new Error(`Missing download URL for "${entry.path}".`);
    }

    const response = await fetchGithub(entry.download_url);

    if (!response.ok) {
      throw new Error(await formatGithubApiError(response));
    }

    files.push({
      path: toRelativePath(entry.path, rootPath),
      content: await readTextResponse(response, `File "${entry.path}"`),
    });
  }

  return files;
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
    throw new Error(`${label} appears to be binary and cannot be returned as text.`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (looksBinary(bytes)) {
    throw new Error(`${label} appears to be binary and cannot be returned as text.`);
  }

  return new TextDecoder("utf-8").decode(bytes);
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
