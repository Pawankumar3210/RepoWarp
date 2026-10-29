import type { RepositoryIdentity } from "../../types/domain";

export interface ParsedRepository {
  ok: true;
  identity: RepositoryIdentity;
  canonicalInput: string;
}

export interface RepositoryParseError {
  ok: false;
  reason:
    | "empty"
    | "protocol"
    | "host"
    | "path"
    | "owner"
    | "repo"
    | "reserved";
  message: string;
}

export type RepositoryParseResult = ParsedRepository | RepositoryParseError;

const OWNER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i;
const REPO_PATTERN = /^[a-z0-9._-]{1,100}$/i;
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const RESERVED_OWNERS = new Set([
  "about",
  "account",
  "apps",
  "collections",
  "contact",
  "copilot",
  "customer-stories",
  "dashboard",
  "enterprise",
  "events",
  "explore",
  "features",
  "issues",
  "join",
  "login",
  "marketplace",
  "new",
  "notifications",
  "orgs",
  "pricing",
  "pulls",
  "readme",
  "search",
  "security",
  "settings",
  "signup",
  "site",
  "sponsors",
  "team",
  "topics",
  "trending",
  "users",
]);

function fail(reason: RepositoryParseError["reason"], message: string): RepositoryParseError {
  return { ok: false, reason, message };
}

function normalizeInput(raw: string): string {
  let value = raw.trim();
  if (!value) return value;

  if (value.startsWith("git@github.com:")) {
    value = `https://github.com/${value.slice("git@github.com:".length)}`;
  } else if (value.startsWith("ssh://git@github.com/")) {
    value = `https://github.com/${value.slice("ssh://git@github.com/".length)}`;
  } else if (value.startsWith("//")) {
    value = `https:${value}`;
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  return value;
}

export function parseRepositoryInput(raw: string): RepositoryParseResult {
  if (!raw.trim()) {
    return fail("empty", "Enter a public GitHub repository URL.");
  }

  let url: URL;
  try {
    url = new URL(normalizeInput(raw));
  } catch {
    return fail("path", "That does not look like a GitHub repository URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return fail("protocol", "Only https:// github.com URLs are supported.");
  }

  const hostname = url.hostname.toLowerCase();
  if (!GITHUB_HOSTS.has(hostname)) {
    return fail("host", "RepoWarp only accepts URLs hosted on github.com.");
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  if (segments.length === 0) {
    return fail("path", "Include an owner and repository name in the URL.");
  }
  if (segments.length > 2) {
    return fail(
      "path",
      "Use the repository root URL, for example github.com/owner/repository.",
    );
  }

  const owner = segments[0] ?? "";
  let name = segments[1] ?? "";

  if (!name) {
    return fail("repo", "The URL is missing a repository name.");
  }

  if (name.toLowerCase().endsWith(".git")) {
    name = name.slice(0, -4);
  }
  name = name.replace(/\/+$/, "");

  if (!owner || RESERVED_OWNERS.has(owner.toLowerCase())) {
    return fail(
      "reserved",
      "That GitHub page is not a public repository. Open the repository root and try again.",
    );
  }

  if (!OWNER_PATTERN.test(owner)) {
    return fail("owner", "The repository owner name is not valid.");
  }

  if (!REPO_PATTERN.test(name) || name === "." || name === "..") {
    return fail("repo", "The repository name is not valid.");
  }

  const identity: RepositoryIdentity = {
    owner,
    name,
    fullName: `${owner}/${name}`,
  };

  return {
    ok: true,
    identity,
    canonicalInput: `https://github.com/${owner}/${name}`,
  };
}

export function parseOwnerRepo(
  owner: string | undefined,
  repo: string | undefined,
): RepositoryParseResult {
  if (!owner || !repo) {
    return fail("path", "The repository address is incomplete.");
  }
  return parseRepositoryInput(`${owner}/${repo}`);
}

export function identityEquals(
  a: RepositoryIdentity | null,
  b: RepositoryIdentity | null,
): boolean {
  if (!a || !b) return false;
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() &&
    a.name.toLowerCase() === b.name.toLowerCase()
  );
}

export function repositoryKey(owner: string, name: string): string {
  return `${owner.toLowerCase()}/${name.toLowerCase()}`;
}
