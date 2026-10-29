import type {
  BranchRef,
  CommitDetails,
  CommitRecord,
  ComparisonResult,
  FileChange,
  RepositoryInfo,
  RepositorySnapshot,
  SnapshotEntry,
  TagRef,
  TreeEntryType,
} from "../../types/domain";
import type {
  GitHubBranch,
  GitHubCommitDetail,
  GitHubCommitSummary,
  GitHubCompareResponse,
  GitHubFileChange,
  GitHubRepository,
  GitHubTag,
  GitHubTreeEntry,
} from "../../types/github";
import { githubCommitUrl, githubCompareUrl } from "./api";

function asMessage(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeRepository(
  raw: GitHubRepository,
  identityFallback: { owner: string; name: string },
  source: RepositoryInfo["source"] = "github",
): RepositoryInfo {
  const fullName = raw.full_name || `${identityFallback.owner}/${identityFallback.name}`;
  const [rawOwner, rawName] = fullName.split("/");
  const owner = rawOwner || identityFallback.owner;
  const name = rawName || identityFallback.name;
  return {
    identity: { owner, name, fullName: `${owner}/${name}` },
    description: raw.description?.slice(0, 500) ?? null,
    defaultBranch: raw.default_branch || "main",
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    language: raw.language,
    license: raw.license?.spdx_id ?? raw.license?.name ?? null,
    topics: Array.isArray(raw.topics) ? raw.topics.slice(0, 12) : [],
    htmlUrl: raw.html_url,
    ownerAvatarUrl: raw.owner?.avatar_url ?? "",
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at,
    archived: Boolean(raw.archived),
    fork: Boolean(raw.fork),
    sizeKb: raw.size ?? 0,
    source,
  };
}

export function normalizeBranch(raw: GitHubBranch): BranchRef {
  return {
    name: raw.name,
    sha: raw.commit.sha,
    protected: Boolean(raw.protected),
  };
}

export function normalizeTag(raw: GitHubTag): TagRef {
  return { name: raw.name, sha: raw.commit.sha };
}

export function normalizeCommit(
  raw: GitHubCommitSummary,
  identity: { owner: string; name: string },
): CommitRecord {
  const message = asMessage(raw.commit?.message);
  const subject = message.split("\n")[0]?.trim() || "(no commit message)";
  const authorName = raw.commit?.author?.name ?? null;
  const authoredAt = raw.commit?.author?.date ?? null;
  const committedAt = raw.commit?.committer?.date ?? authoredAt;
  const authorLogin = raw.author?.login ?? null;
  const authorAvatarUrl = raw.author?.avatar_url ?? null;

  return {
    sha: raw.sha,
    subject,
    message,
    authorName,
    authorEmail: raw.commit?.author?.email ?? null,
    authorLogin,
    authorAvatarUrl,
    authoredAt,
    committedAt,
    parents: Array.isArray(raw.parents)
      ? raw.parents.map((parent) => parent.sha).filter(Boolean)
      : [],
    treeSha: raw.commit?.tree?.sha ?? null,
    htmlUrl:
      raw.html_url ??
      githubCommitUrl({ owner: identity.owner, name: identity.name, fullName: "" }, raw.sha),
    isMerge: Array.isArray(raw.parents) && raw.parents.length > 1,
    refs: [],
    tags: [],
  };
}

export function normalizeFileChange(raw: GitHubFileChange): FileChange {
  return {
    path: raw.filename,
    previousPath: raw.previous_filename,
    status: raw.status,
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    changes: raw.changes ?? (raw.additions ?? 0) + (raw.deletions ?? 0),
    patch: raw.patch,
    patchAvailable: typeof raw.patch === "string" && raw.patch.length > 0,
  };
}

export function normalizeCommitDetails(
  raw: GitHubCommitDetail,
  identity: { owner: string; name: string },
): CommitDetails {
  const base = normalizeCommit(raw, identity);
  const files = Array.isArray(raw.files) ? raw.files.map(normalizeFileChange) : [];
  const missingPatches = files.filter((file) => !file.patchAvailable).length;
  const fileListTruncated = files.length >= 300;
  let patchNote: string | null = null;

  if (fileListTruncated) {
    patchNote =
      "GitHub may cap commit file lists at 300 entries. Use the GitHub commit page for the full diff.";
  } else if (missingPatches > 0) {
    patchNote = `Patch content is unavailable for ${missingPatches} ${
      missingPatches === 1 ? "file" : "files"
    } (binary, very large, or omitted by GitHub).`;
  }

  return {
    sha: base.sha,
    subject: base.subject,
    message: base.message,
    authorName: base.authorName,
    authorEmail: base.authorEmail,
    authorLogin: base.authorLogin,
    authorAvatarUrl: base.authorAvatarUrl,
    authoredAt: base.authoredAt,
    committedAt: base.committedAt,
    parents: base.parents,
    treeSha: base.treeSha,
    stats: raw.stats
      ? {
          total: raw.stats.total,
          additions: raw.stats.additions,
          deletions: raw.stats.deletions,
        }
      : null,
    files,
    fileListTruncated,
    htmlUrl: base.htmlUrl,
    isMerge: base.isMerge,
    patchNote,
  };
}

function parentPathOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

function extensionOf(path: string): string | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  return name.slice(dot + 1).toLowerCase();
}

export function normalizeTreeEntry(raw: GitHubTreeEntry, prefix = ""): SnapshotEntry {
  const path = prefix ? `${prefix}/${raw.path}` : raw.path;
  const type: TreeEntryType =
    raw.type === "tree" || raw.type === "commit" ? raw.type : "blob";
  return {
    path,
    name: path.slice(path.lastIndexOf("/") + 1),
    type,
    sha: raw.sha,
    size: typeof raw.size === "number" ? raw.size : null,
    mode: raw.mode,
    parentPath: parentPathOf(path),
    depth: path.split("/").length - 1,
    extension: type === "blob" ? extensionOf(path) : null,
  };
}

export function snapshotFromEntries(options: {
  commitSha: string;
  treeSha: string;
  entries: SnapshotEntry[];
  truncated: boolean;
  lazy: boolean;
  partialReason: string | null;
  changeFiles: FileChange[];
  changeBaseSha: string | null;
  expandedDirs?: string[];
  loadedDirs?: string[];
}): RepositorySnapshot {
  return {
    commitSha: options.commitSha,
    treeSha: options.treeSha,
    entries: options.entries,
    truncated: options.truncated,
    lazy: options.lazy,
    partialReason: options.partialReason,
    loadedDirs: options.loadedDirs ?? [],
    expandedDirs: options.expandedDirs ?? [],
    changeFiles: options.changeFiles,
    changeBaseSha: options.changeBaseSha,
    fetchedAt: new Date().toISOString(),
  };
}

export function normalizeComparison(
  raw: GitHubCompareResponse,
  identity: { owner: string; name: string },
  base: string,
  target: string,
): ComparisonResult {
  const commits = Array.isArray(raw.commits)
    ? raw.commits.map((commit) => normalizeCommit(commit, identity))
    : [];
  const files = Array.isArray(raw.files) ? raw.files.map(normalizeFileChange) : [];
  return {
    base,
    target,
    status: raw.status,
    aheadBy: raw.ahead_by ?? 0,
    behindBy: raw.behind_by ?? 0,
    totalCommits: raw.total_commits ?? commits.length,
    commits,
    files,
    commitsIncomplete: (raw.total_commits ?? 0) > commits.length,
    filesMayBeIncomplete: files.length >= 300,
    htmlUrl:
      raw.html_url ??
      githubCompareUrl({ owner: identity.owner, name: identity.name, fullName: "" }, base, target),
  };
}

export function inferArchivedNote(repository: RepositoryInfo): string | null {
  if (!repository.archived) return null;
  return "This public repository is archived. History is available, but development has stopped.";
}
