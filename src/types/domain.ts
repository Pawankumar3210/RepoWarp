export type Theme = "dark" | "light";

export type ViewMode = "history" | "codebase";

export type RepositorySource = "github" | "demo";

export interface RepositoryIdentity {
  owner: string;
  name: string;
  fullName: string;
}

export interface RepositoryInfo {
  identity: RepositoryIdentity;
  description: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  license: string | null;
  topics: string[];
  htmlUrl: string;
  ownerAvatarUrl: string;
  updatedAt: string;
  pushedAt: string | null;
  archived: boolean;
  fork: boolean;
  sizeKb: number;
  source: RepositorySource;
}

export interface BranchRef {
  name: string;
  sha: string;
  protected: boolean;
}

export interface TagRef {
  name: string;
  sha: string;
}

export interface CommitRecord {
  sha: string;
  subject: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  authoredAt: string | null;
  committedAt: string | null;
  parents: string[];
  treeSha: string | null;
  htmlUrl: string;
  isMerge: boolean;
  refs: string[];
  tags: string[];
  detached?: boolean;
}

export type FileChangeStatus =
  | "added"
  | "removed"
  | "modified"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export interface FileChange {
  path: string;
  previousPath?: string;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  patchAvailable: boolean;
}

export interface CommitStats {
  total: number;
  additions: number;
  deletions: number;
}

export interface CommitDetails {
  sha: string;
  subject: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  authoredAt: string | null;
  committedAt: string | null;
  parents: string[];
  treeSha: string | null;
  stats: CommitStats | null;
  files: FileChange[];
  fileListTruncated: boolean;
  htmlUrl: string;
  isMerge: boolean;
  patchNote: string | null;
}

export type TreeEntryType = "blob" | "tree" | "commit";

export interface SnapshotEntry {
  path: string;
  name: string;
  type: TreeEntryType;
  sha: string;
  size: number | null;
  mode: string;
  parentPath: string;
  depth: number;
  extension: string | null;
}

export type SnapshotStatus = "idle" | "loading" | "ready" | "error" | "deferred";

export interface RepositorySnapshot {
  commitSha: string;
  treeSha: string;
  entries: SnapshotEntry[];
  truncated: boolean;
  lazy: boolean;
  partialReason: string | null;
  loadedDirs: string[];
  expandedDirs: string[];
  changeFiles: FileChange[];
  changeBaseSha: string | null;
  fetchedAt: string;
}

export interface ComparisonResult {
  base: string;
  target: string;
  status: "diverged" | "ahead" | "behind" | "identical";
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  commits: CommitRecord[];
  files: FileChange[];
  commitsIncomplete: boolean;
  filesMayBeIncomplete: boolean;
  htmlUrl: string | null;
}

export type LoadStage =
  | "validating"
  | "repository"
  | "branches"
  | "history"
  | "graph"
  | "snapshot"
  | "ready";

export interface StageState {
  id: LoadStage;
  label: string;
  status: "pending" | "active" | "complete" | "error";
}

export type RequestStatus = "idle" | "loading" | "success" | "error";

export interface RefHistoryState {
  loadedPages: number;
  loadedShas: string[];
  complete: boolean;
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
}

export type ApiErrorKind =
  | "invalid_url"
  | "not_found"
  | "forbidden"
  | "rate_limit"
  | "network"
  | "api"
  | "malformed"
  | "truncated"
  | "unsupported"
  | "aborted"
  | "empty_repo"
  | "unknown";

export interface AppError {
  kind: ApiErrorKind;
  title: string;
  message: string;
  status?: number;
  retryAt?: number;
  docsUrl?: string;
  requestPath?: string;
}

export interface RateLimitState {
  limit: number | null;
  remaining: number | null;
  resetAt: number | null;
  blockedUntil: number | null;
  lastUpdated: number | null;
}

export interface RecentRepository {
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  defaultBranch: string;
  lastOpenedAt: number;
  lastCommitSha: string | null;
  lastView: ViewMode;
}

export interface UserPreferences {
  theme: Theme;
  playbackSpeed: number;
  lastView: ViewMode;
  reduceMotion: boolean | "system";
  showSceneGrid: boolean;
}

export interface ToastMessage {
  id: string;
  tone: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  duration?: number;
}

export interface HistoryFilters {
  search: string;
  author: string;
  branch: string;
  fromDate: string;
  toDate: string;
  mergesOnly: boolean;
  taggedOnly: boolean;
}

export interface ExportJsonPayload {
  schema: "repowarp.history.v1";
  source: RepositorySource;
  exportedAt: string;
  repository: {
    owner: string;
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string;
    description: string | null;
    stars: number;
    language: string | null;
  };
  reference: {
    active: string | null;
    selectedCommit: string | null;
    branches: BranchRef[];
    tags: TagRef[];
  };
  completeness: {
    historyComplete: boolean;
    loadedCommitCount: number;
    refs: Record<
      string,
      { loadedPages: number; loadedCommits: number; complete: boolean }
    >;
    note: string;
  };
  commits: Array<{
    sha: string;
    message: string;
    author: {
      name: string | null;
      email: string | null;
      login: string | null;
    };
    authoredAt: string | null;
    committedAt: string | null;
    parents: string[];
    isMerge: boolean;
    refs: string[];
    tags: string[];
    stats?: {
      additions: number;
      deletions: number;
      filesChanged: number;
    };
  }>;
}

export interface FilteredHistory {
  commits: CommitRecord[];
  matchingShas: Set<string>;
  totalLoaded: number;
}
