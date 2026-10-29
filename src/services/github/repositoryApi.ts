import type {
  BranchRef,
  CommitDetails,
  CommitRecord,
  ComparisonResult,
  FileChange,
  RepositoryIdentity,
  RepositoryInfo,
  SnapshotEntry,
  TagRef,
} from "../../types/domain";
import type {
  GitHubBranch,
  GitHubCommitDetail,
  GitHubCommitSummary,
  GitHubCompareResponse,
  GitHubRepository,
  GitHubTag,
  GitHubTreeResponse,
} from "../../types/github";
import { githubApi } from "./api";
import { requestGitHub } from "./client";
import { GitHubApiError } from "./errors";
import {
  normalizeBranch,
  normalizeCommit,
  normalizeCommitDetails,
  normalizeComparison,
  normalizeRepository,
  normalizeTag,
  normalizeTreeEntry,
} from "./transform";

const BRANCHES_PER_PAGE = 100;
const TAGS_PER_PAGE = 100;
export const COMMITS_PER_PAGE = 50;
export const EAGER_TREE_ENTRY_LIMIT = 1800;
export const EAGER_REPOSITORY_SIZE_KB = 45_000;

function malformed(message: string): GitHubApiError {
  return new GitHubApiError({ kind: "malformed", message });
}

function withContext(error: unknown, message: string): never {
  if (error instanceof GitHubApiError && error.kind === "not_found") {
    throw new GitHubApiError({
      kind: "not_found",
      message,
      status: error.status,
      requestPath: error.requestPath,
      docsUrl: error.docsUrl,
    });
  }
  throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchRepository(
  identity: RepositoryIdentity,
  signal?: AbortSignal,
): Promise<RepositoryInfo> {
  const raw = await requestGitHub<unknown>(githubApi.repository(identity), { signal })
    .catch((error: unknown) =>
      withContext(
        error,
        "We could not find that public repository. Check the spelling and confirm it is public.",
      ),
    );
  if (!isRecord(raw) || typeof raw.full_name !== "string") {
    throw malformed("GitHub returned unexpected repository metadata.");
  }
  return normalizeRepository(raw as unknown as GitHubRepository, identity);
}

export interface BranchPage {
  branches: BranchRef[];
  hasMore: boolean;
}

export async function fetchBranchesPage(
  identity: RepositoryIdentity,
  page: number,
  signal?: AbortSignal,
): Promise<BranchPage> {
  const raw = await requestGitHub<unknown>(
    githubApi.branches(identity, page, BRANCHES_PER_PAGE),
    { signal, ttlMs: 90_000 },
  ).catch((error: unknown) =>
    withContext(error, "Branch references could not be loaded for this repository."),
  );
  if (!Array.isArray(raw)) throw malformed("GitHub returned an unexpected branch list.");
  const branches = raw
    .filter((item): item is GitHubBranch => isRecord(item) && typeof item.name === "string")
    .map(normalizeBranch);
  return { branches, hasMore: raw.length === BRANCHES_PER_PAGE };
}

export interface TagPage {
  tags: TagRef[];
  hasMore: boolean;
}

export async function fetchTagsPage(
  identity: RepositoryIdentity,
  page: number,
  signal?: AbortSignal,
): Promise<TagPage> {
  const raw = await requestGitHub<unknown>(githubApi.tags(identity, page, TAGS_PER_PAGE), {
    signal,
    ttlMs: 120_000,
  });
  if (!Array.isArray(raw)) throw malformed("GitHub returned an unexpected tag list.");
  const tags = raw
    .filter((item): item is GitHubTag => isRecord(item) && typeof item.name === "string")
    .map(normalizeTag);
  return { tags, hasMore: raw.length === TAGS_PER_PAGE };
}

export interface CommitPage {
  commits: CommitRecord[];
  hasMore: boolean;
}

export async function fetchCommitsPage(
  identity: RepositoryIdentity,
  ref: string,
  page: number,
  signal?: AbortSignal,
): Promise<CommitPage> {
  const raw = await requestGitHub<unknown>(
    githubApi.commits(identity, ref, page, COMMITS_PER_PAGE),
    { signal, ttlMs: 45_000 },
  ).catch((error: unknown) =>
    withContext(
      error,
      "That branch or reference could not be loaded. It may have been deleted or renamed.",
    ),
  );
  if (!Array.isArray(raw)) throw malformed("GitHub returned an unexpected commit list.");
  const commits = raw
    .filter((item): item is GitHubCommitSummary => isRecord(item) && typeof item.sha === "string")
    .map((item) => normalizeCommit(item, identity));
  return { commits, hasMore: raw.length === COMMITS_PER_PAGE };
}

export async function fetchCommitBySha(
  identity: RepositoryIdentity,
  sha: string,
  signal?: AbortSignal,
): Promise<CommitRecord> {
  const raw = await requestGitHub<unknown>(githubApi.commit(identity, sha), {
    signal,
    ttlMs: Number.POSITIVE_INFINITY,
  }).catch((error: unknown) =>
    withContext(error, "That commit is not available in this repository."),
  );
  if (!isRecord(raw) || typeof raw.sha !== "string") {
    throw malformed("GitHub returned unexpected commit data.");
  }
  return normalizeCommit(raw as unknown as GitHubCommitSummary, identity);
}

export async function fetchCommitDetails(
  identity: RepositoryIdentity,
  sha: string,
  signal?: AbortSignal,
): Promise<CommitDetails> {
  const raw = await requestGitHub<GitHubCommitDetail>(githubApi.commit(identity, sha), {
    signal,
    ttlMs: Number.POSITIVE_INFINITY,
  }).catch((error: unknown) =>
    withContext(error, "That commit is not available in this repository."),
  );
  if (!isRecord(raw) || typeof raw.sha !== "string") {
    throw malformed("GitHub returned unexpected commit data.");
  }
  return normalizeCommitDetails(raw, identity);
}

async function fetchTreeRaw(
  identity: RepositoryIdentity,
  treeSha: string,
  recursive: boolean,
  signal?: AbortSignal,
): Promise<GitHubTreeResponse> {
  const raw = await requestGitHub<GitHubTreeResponse>(
    githubApi.tree(identity, treeSha, recursive),
    { signal, ttlMs: Number.POSITIVE_INFINITY },
  ).catch((error: unknown) => {
    if (error instanceof GitHubApiError && error.kind === "not_found") {
      throw new GitHubApiError({
        kind: "not_found",
        message: "The tree for this revision is not available. GitHub may have expired it.",
        status: 404,
        requestPath: error.requestPath,
      });
    }
    throw error;
  });
  if (!isRecord(raw) || !Array.isArray(raw.tree)) {
    throw malformed("GitHub returned an unexpected tree response.");
  }
  return raw;
}

export interface SnapshotLoadResult {
  commitSha: string;
  treeSha: string;
  entries: SnapshotEntry[];
  truncated: boolean;
  lazy: boolean;
  partialReason: string | null;
  changeFiles: FileChange[];
  changeBaseSha: string | null;
  loadedDirs: string[];
  expandedDirs: string[];
}

export async function loadSnapshotForCommit(
  identity: RepositoryIdentity,
  commit: CommitRecord,
  repositorySizeKb: number,
  signal?: AbortSignal,
  knownDetails?: CommitDetails,
): Promise<SnapshotLoadResult> {
  const details = knownDetails ?? (await fetchCommitDetails(identity, commit.sha, signal));
  const treeSha = details.treeSha ?? commit.treeSha;
  if (!treeSha) {
    throw malformed("This commit does not expose a tree identifier.");
  }

  const changeFiles = details.files;
  const changeBaseSha = details.parents[0] ?? null;
  const wantsEagerLoad =
    repositorySizeKb <= 0 || repositorySizeKb <= EAGER_REPOSITORY_SIZE_KB;

  if (wantsEagerLoad) {
    const recursiveTree = await fetchTreeRaw(identity, treeSha, true, signal);
    if (
      !recursiveTree.truncated &&
      recursiveTree.tree.length <= EAGER_TREE_ENTRY_LIMIT
    ) {
      const entries = recursiveTree.tree.map((entry) => normalizeTreeEntry(entry));
      return {
        commitSha: commit.sha,
        treeSha,
        entries,
        truncated: false,
        lazy: false,
        partialReason: null,
        changeFiles,
        changeBaseSha,
        loadedDirs: [],
        expandedDirs: [],
      };
    }

    const rootTree = await fetchTreeRaw(identity, treeSha, false, signal);
    const entries = rootTree.tree.map((entry) => normalizeTreeEntry(entry));
    return {
      commitSha: commit.sha,
      treeSha,
      entries,
      truncated: recursiveTree.truncated || rootTree.truncated,
      lazy: true,
      partialReason: recursiveTree.truncated
        ? "GitHub truncated this recursive tree. Expand directories to load contents on demand."
        : "This repository has a large tree. Directories load on demand to keep the scene responsive.",
      changeFiles,
      changeBaseSha,
      loadedDirs: [],
      expandedDirs: [],
    };
  }

  const rootTree = await fetchTreeRaw(identity, treeSha, false, signal);
  const entries = rootTree.tree.map((entry) => normalizeTreeEntry(entry));
  return {
    commitSha: commit.sha,
    treeSha,
    entries,
    truncated: rootTree.truncated,
    lazy: true,
    partialReason:
      "This is a large repository. RepoWarp loaded the root snapshot and will retrieve directories as you expand them.",
    changeFiles,
    changeBaseSha,
    loadedDirs: [],
    expandedDirs: [],
  };
}

export interface DirectoryLoadResult {
  entries: SnapshotEntry[];
  truncated: boolean;
}

export async function loadDirectoryChildren(
  identity: RepositoryIdentity,
  directoryPath: string,
  directorySha: string,
  signal?: AbortSignal,
): Promise<DirectoryLoadResult> {
  const raw = await fetchTreeRaw(identity, directorySha, false, signal);
  const prefix = directoryPath.replace(/\/+$/, "");
  return {
    entries: raw.tree.map((entry) => normalizeTreeEntry(entry, prefix)),
    truncated: raw.truncated,
  };
}

export async function compareRevisions(
  identity: RepositoryIdentity,
  base: string,
  target: string,
  signal?: AbortSignal,
): Promise<ComparisonResult> {
  const raw = await requestGitHub<GitHubCompareResponse>(
    githubApi.compare(identity, base, target),
    { signal, ttlMs: 120_000 },
  ).catch((error: unknown) => {
    if (error instanceof GitHubApiError && error.kind === "not_found") {
      throw new GitHubApiError({
        kind: "not_found",
        message:
          "GitHub could not compare those revisions. One may be unavailable or the branches may not share history.",
        status: 404,
        requestPath: error.requestPath,
      });
    }
    throw error;
  });

  if (!isRecord(raw) || !Array.isArray(raw.commits)) {
    throw malformed("GitHub returned an unexpected comparison response.");
  }
  if (
    raw.status !== "diverged" &&
    raw.status !== "ahead" &&
    raw.status !== "behind" &&
    raw.status !== "identical"
  ) {
    throw malformed("GitHub returned an unrecognized comparison status.");
  }
  return normalizeComparison(raw, identity, base, target);
}
