export type GithubDirectoryLocation = {
  owner: string;
  repo: string;
  ref: string;
  path: string;
};

export type MarkdownFrontMatterFields = {
  description: string | null;
  name: string | null;
  parseError: string | null;
  source: string | null;
};

const GITHUB_HOSTNAME = "github.com";
const GITHUB_RAW_HOSTNAME = "raw.githubusercontent.com";

export function sanitizeUrlCredentials(sourceUrl: string): string {
  const parsedUrl = parseUrl(sourceUrl);

  if (!parsedUrl) {
    return sourceUrl;
  }

  if (!parsedUrl.username && !parsedUrl.password) {
    return sourceUrl;
  }

  parsedUrl.username = "";
  parsedUrl.password = "";
  return parsedUrl.toString();
}

export function normalizeGithubRawUrl(sourceUrl: string): string | undefined {
  const parsedUrl = parseUrl(sanitizeUrlCredentials(sourceUrl));

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

export function extractMarkdownFrontMatter(markdown: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(markdown);
  return match?.[1] ?? null;
}

export function parseMarkdownFrontMatterFields(markdown: string): MarkdownFrontMatterFields {
  const frontMatter = extractMarkdownFrontMatter(markdown);

  if (frontMatter === null) {
    return {
      description: null,
      name: null,
      parseError: null,
      source: null,
    };
  }

  let parsed: unknown;
  const normalizedFrontMatter = stripTrailingCommas(frontMatter);

  try {
    parsed = Bun.YAML.parse(normalizedFrontMatter);
  } catch (error) {
    const parseError = error instanceof Error ? error.message : String(error);

    if (parseError.includes("YAML Parse error") || parseError.includes("undefined is not an object")) {
      const fallback = fallbackParseFrontMatter(frontMatter);
      if (fallback.name !== null || fallback.description !== null) {
        return {
          description: normalizeFrontMatterField(fallback.description),
          name: normalizeFrontMatterField(fallback.name),
          parseError: null,
          source: frontMatter,
        };
      }
    }

    return {
      description: null,
      name: null,
      parseError,
      source: frontMatter,
    };
  }

  if (!isRecord(parsed)) {
    return {
      description: null,
      name: null,
      parseError: null,
      source: frontMatter,
    };
  }

  return {
    description: normalizeFrontMatterField(parsed["description"]),
    name: normalizeFrontMatterField(parsed["name"]),
    parseError: null,
    source: frontMatter,
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

export function logWarning(message: string): void {
  process.stdout.write(`[WARN] ${message}\n`);
}

export function logError(message: string): void {
  process.stderr.write(`[ERROR] ${message}\n`);
}

function normalizeGithubRepo(repo: string | undefined): string | undefined {
  if (!repo) {
    return undefined;
  }

  return repo.endsWith(".git") ? repo.slice(0, -4) : repo;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFrontMatterField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = collapseWhitespace(value);
  return normalized === "" ? null : normalized;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function stripTrailingCommas(value: string): string {
  return value.replace(/,(\s*[\]}])/gu, "$1");
}

function fallbackParseFrontMatter(frontMatter: string): {
  name: string | null;
  description: string | null;
} {
  const lines = frontMatter.split(/\r?\n/u);
  let name: string | null = null;
  let description: string | null = null;

  for (const line of lines) {
    const nameMatch = /^name:\s*(.+)$/u.exec(line);
    if (nameMatch && name === null) {
      const val = nameMatch[1].trim();
      if (isValidFallbackValue(val)) {
        name = unquote(val);
      }
    }

    const descMatch = /^description:\s*(.+)$/u.exec(line);
    if (descMatch && description === null) {
      const val = descMatch[1].trim();
      if (isValidFallbackValue(val)) {
        description = unquote(val);
      }
    }
  }

  return { name, description };
}

function isValidFallbackValue(val: string): boolean {
  if (val.startsWith(">") || val.startsWith("|")) {
    return false;
  }
  if (val.startsWith("\"") && !val.endsWith("\"")) {
    return false;
  }
  if (val.startsWith("'") && !val.endsWith("'")) {
    return false;
  }
  return val !== "" && val !== "\"" && val !== "'";
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
