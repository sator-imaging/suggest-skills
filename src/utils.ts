export type GithubDirectoryLocation = {
  owner: string;
  repo: string;
  ref: string;
  path: string;
};

const GITHUB_HOSTNAME = "github.com";
const GITHUB_RAW_HOSTNAME = "raw.githubusercontent.com";

export function normalizeGithubRawUrl(sourceUrl: string): string | undefined {
  const parsedUrl = parseUrl(sourceUrl);

  if (!parsedUrl) {
    return undefined;
  }

  if (parsedUrl.hostname === GITHUB_RAW_HOSTNAME) {
    return parsedUrl.toString();
  }

  if (parsedUrl.hostname !== GITHUB_HOSTNAME) {
    return undefined;
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  const [owner, rawRepo, urlType, ref, ...filePath] = pathParts;
  const repo = normalizeGithubRepo(rawRepo);

  if (!owner || !repo || !urlType || !ref || filePath.length === 0) {
    return undefined;
  }

  if (urlType !== "blob" && urlType !== "raw") {
    return undefined;
  }

  return `https://${GITHUB_RAW_HOSTNAME}/${owner}/${repo}/${ref}/${filePath.join("/")}`;
}

export function parseGithubDirectoryUrl(sourceUrl: string): GithubDirectoryLocation | undefined {
  const parsedUrl = parseUrl(sourceUrl);

  if (!parsedUrl || parsedUrl.hostname !== GITHUB_HOSTNAME) {
    return undefined;
  }

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  const [owner, rawRepo, urlType, ...remainder] = pathParts;
  const repo = normalizeGithubRepo(rawRepo);

  if (!owner || !repo) {
    return undefined;
  }

  if (urlType !== "tree") {
    return undefined;
  }

  if (remainder.length < 2) {
    return undefined;
  }

  const [ref, ...folderPathParts] = remainder;

  if (!ref) {
    return undefined;
  }

  return {
    owner,
    repo,
    ref,
    path: folderPathParts.join("/"),
  };
}

export function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export function logInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

function normalizeGithubRepo(repo: string | undefined): string | undefined {
  if (!repo) {
    return undefined;
  }

  return repo.endsWith(".git") ? repo.slice(0, -4) : repo;
}
