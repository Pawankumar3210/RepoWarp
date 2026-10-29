import { create } from "zustand";
import type {
  AppError,
  BranchRef,
  CommitDetails,
  CommitRecord,
  ComparisonResult,
  HistoryFilters,
  RateLimitState,
  RefHistoryState,
  RepositoryInfo,
  RepositorySnapshot,
  RepositorySource,
  RequestStatus,
  SnapshotEntry,
  SnapshotStatus,
  StageState,
  TagRef,
  ViewMode,
} from "../types/domain";
import { decorateCommitsWithRefs } from "../features/repository/commitRefs";

export const DEFAULT_FILTERS: HistoryFilters = {
  search: "",
  author: "",
  branch: "",
  fromDate: "",
  toDate: "",
  mergesOnly: false,
  taggedOnly: false,
};

export const LOAD_STAGES: StageState[] = [
  { id: "validating", label: "Validating repository", status: "pending" },
  { id: "repository", label: "Loading repository information", status: "pending" },
  { id: "branches", label: "Loading branches and tags", status: "pending" },
  { id: "history", label: "Loading commit history", status: "pending" },
  { id: "graph", label: "Building the history graph", status: "pending" },
  { id: "ready", label: "Ready to explore", status: "pending" },
];

export type CommitSource = "loaded" | "detached";

interface DetailState {
  status: RequestStatus;
  error: AppError | null;
}

interface SnapshotState {
  status: SnapshotStatus;
  data: RepositorySnapshot | null;
  error: AppError | null;
  requestedSha: string | null;
}

interface ComparisonState {
  base: string | null;
  target: string | null;
  status: RequestStatus;
  result: ComparisonResult | null;
  error: AppError | null;
}

interface RepositoryStore {
  source: RepositorySource | null;
  repository: RepositoryInfo | null;
  repositoryStatus: "idle" | "loading" | "ready" | "error";
  repositoryError: AppError | null;
  loadStages: StageState[];
  branches: BranchRef[];
  branchesStatus: RequestStatus;
  branchesHasMore: boolean;
  branchesPage: number;
  tags: TagRef[];
  tagsStatus: RequestStatus;
  tagsHasMore: boolean;
  tagsPage: number;
  commits: Record<string, CommitRecord>;
  commitCount: number;
  refHistory: Record<string, RefHistoryState>;
  activeRef: string | null;
  selectedCommitSha: string | null;
  selectedCommitSource: CommitSource | null;
  view: ViewMode;
  filters: HistoryFilters;
  warnings: string[];
  rateLimit: RateLimitState;
  details: Record<string, CommitDetails>;
  detailStates: Record<string, DetailState>;
  snapshotState: SnapshotState;
  comparison: ComparisonState;

  reset: () => void;
  beginLoading: (source: RepositorySource) => void;
  setStage: (id: StageState["id"], status: StageState["status"]) => void;
  setRepository: (repository: RepositoryInfo) => void;
  setRepositoryError: (error: AppError) => void;
  finishLoading: () => void;
  setBranches: (branches: BranchRef[], hasMore: boolean, page: number) => void;
  appendBranches: (branches: BranchRef[], hasMore: boolean, page: number) => void;
  setBranchesStatus: (status: RequestStatus) => void;
  setTags: (tags: TagRef[], hasMore: boolean, page: number) => void;
  setTagsStatus: (status: RequestStatus) => void;
  ingestCommits: (params: {
    ref: string;
    commits: CommitRecord[];
    page: number;
    hasMore: boolean;
  }) => void;
  addDetachedCommit: (commit: CommitRecord) => void;
  setActiveRef: (ref: string | null) => void;
  setRefLoading: (ref: string) => void;
  setRefError: (ref: string, message: string) => void;
  selectCommit: (sha: string | null, source?: CommitSource) => void;
  setView: (view: ViewMode) => void;
  setFilters: (partial: Partial<HistoryFilters>) => void;
  resetFilters: () => void;
  setWarning: (warning: string | null) => void;
  addWarning: (warning: string) => void;
  setRateLimit: (rateLimit: RateLimitState) => void;
  setDetailLoading: (sha: string) => void;
  setDetailSuccess: (details: CommitDetails) => void;
  setDetailError: (sha: string, error: AppError) => void;
  setSnapshotLoading: (sha: string) => void;
  setSnapshotDeferred: (sha: string) => void;
  setSnapshotSuccess: (snapshot: RepositorySnapshot) => void;
  setSnapshotError: (sha: string, error: AppError) => void;
  mergeSnapshotDirectory: (
    directoryPath: string,
    entries: SnapshotEntry[],
    truncated: boolean,
  ) => void;
  setComparisonLoading: (base: string, target: string) => void;
  setComparisonSuccess: (result: ComparisonResult) => void;
  setComparisonError: (error: AppError) => void;
  clearComparison: () => void;
  setComparisonBase: (base: string | null) => void;
}

const EMPTY_SNAPSHOT: SnapshotState = {
  status: "idle",
  data: null,
  error: null,
  requestedSha: null,
};

const EMPTY_COMPARISON: ComparisonState = {
  base: null,
  target: null,
  status: "idle",
  result: null,
  error: null,
};

function ensureRef(
  refHistory: Record<string, RefHistoryState>,
  ref: string,
): RefHistoryState {
  return (
    refHistory[ref] ?? {
      loadedPages: 0,
      loadedShas: [],
      complete: false,
      loading: false,
      error: null,
      lastLoadedAt: null,
    }
  );
}

export const useRepositoryStore = create<RepositoryStore>((set) => ({
  source: null,
  repository: null,
  repositoryStatus: "idle",
  repositoryError: null,
  loadStages: LOAD_STAGES.map((stage) => ({ ...stage })),
  branches: [],
  branchesStatus: "idle",
  branchesHasMore: false,
  branchesPage: 0,
  tags: [],
  tagsStatus: "idle",
  tagsHasMore: false,
  tagsPage: 0,
  commits: {},
  commitCount: 0,
  refHistory: {},
  activeRef: null,
  selectedCommitSha: null,
  selectedCommitSource: null,
  view: "history",
  filters: { ...DEFAULT_FILTERS },
  warnings: [],
  rateLimit: {
    limit: null,
    remaining: null,
    resetAt: null,
    blockedUntil: null,
    lastUpdated: null,
  },
  details: {},
  detailStates: {},
  snapshotState: EMPTY_SNAPSHOT,
  comparison: EMPTY_COMPARISON,

  reset: () =>
    set({
      source: null,
      repository: null,
      repositoryStatus: "idle",
      repositoryError: null,
      loadStages: LOAD_STAGES.map((stage) => ({ ...stage })),
      branches: [],
      branchesStatus: "idle",
      branchesHasMore: false,
      branchesPage: 0,
      tags: [],
      tagsStatus: "idle",
      tagsHasMore: false,
      tagsPage: 0,
      commits: {},
      commitCount: 0,
      refHistory: {},
      activeRef: null,
      selectedCommitSha: null,
      selectedCommitSource: null,
      view: "history",
      filters: { ...DEFAULT_FILTERS },
      warnings: [],
      details: {},
      detailStates: {},
      snapshotState: EMPTY_SNAPSHOT,
      comparison: EMPTY_COMPARISON,
    }),

  beginLoading: (source) =>
    set({
      source,
      repository: null,
      repositoryStatus: "loading",
      repositoryError: null,
      loadStages: LOAD_STAGES.map((stage, index) => ({
        ...stage,
        status: index === 0 ? "active" : "pending",
      })),
      branches: [],
      branchesStatus: "loading",
      branchesHasMore: false,
      branchesPage: 0,
      tags: [],
      tagsStatus: "loading",
      tagsHasMore: false,
      tagsPage: 0,
      commits: {},
      commitCount: 0,
      refHistory: {},
      activeRef: null,
      selectedCommitSha: null,
      selectedCommitSource: null,
      filters: { ...DEFAULT_FILTERS },
      warnings: [],
      details: {},
      detailStates: {},
      snapshotState: EMPTY_SNAPSHOT,
      comparison: EMPTY_COMPARISON,
    }),

  setStage: (id, status) =>
    set((state) => ({
      loadStages: state.loadStages.map((stage) =>
        stage.id === id ? { ...stage, status } : stage,
      ),
    })),

  setRepository: (repository) => set({ repository }),

  setRepositoryError: (error) =>
    set((state) => ({
      repositoryStatus: "error",
      repositoryError: error,
      loadStages: state.loadStages.map((stage) =>
        stage.status === "active" ? { ...stage, status: "error" } : stage,
      ),
    })),

  finishLoading: () =>
    set((state) => ({
      repositoryStatus: "ready",
      repositoryError: null,
      loadStages: state.loadStages.map((stage) => ({ ...stage, status: "complete" })),
    })),

  setBranches: (branches, hasMore, page) =>
    set((state) => ({
      branches,
      branchesHasMore: hasMore,
      branchesPage: page,
      branchesStatus: "success",
      commits: decorateCommitsWithRefs(state.commits, branches, state.tags),
    })),

  appendBranches: (branches, hasMore, page) =>
    set((state) => {
      const existing = new Map(state.branches.map((branch) => [branch.name, branch]));
      for (const branch of branches) existing.set(branch.name, branch);
      const merged = [...existing.values()];
      return {
        branches: merged,
        branchesHasMore: hasMore,
        branchesPage: page,
        branchesStatus: "success",
        commits: decorateCommitsWithRefs(state.commits, merged, state.tags),
      };
    }),

  setBranchesStatus: (status) => set({ branchesStatus: status }),

  setTags: (tags, hasMore, page) =>
    set((state) => ({
      tags,
      tagsHasMore: hasMore,
      tagsPage: page,
      tagsStatus: "success",
      commits: decorateCommitsWithRefs(state.commits, state.branches, tags),
    })),

  setTagsStatus: (status) => set({ tagsStatus: status }),

  ingestCommits: ({ ref, commits, page, hasMore }) =>
    set((state) => {
      const nextCommits = { ...state.commits };
      for (const commit of commits) {
        const existing = nextCommits[commit.sha];
        nextCommits[commit.sha] =
          existing && existing.refs.length + existing.tags.length > 0
            ? { ...commit, refs: existing.refs, tags: existing.tags }
            : commit;
      }
      const decorated = decorateCommitsWithRefs(nextCommits, state.branches, state.tags);
      const current = ensureRef(state.refHistory, ref);
      const loadedShas = [...current.loadedShas];
      const seen = new Set(loadedShas);
      for (const commit of commits) {
        if (!seen.has(commit.sha)) {
          seen.add(commit.sha);
          loadedShas.push(commit.sha);
        }
      }
      return {
        commits: decorated,
        commitCount: Object.keys(decorated).length,
        refHistory: {
          ...state.refHistory,
          [ref]: {
            ...current,
            loadedPages: Math.max(current.loadedPages, page),
            loadedShas,
            complete: !hasMore,
            loading: false,
            error: null,
            lastLoadedAt: Date.now(),
          },
        },
      };
    }),

  addDetachedCommit: (commit) =>
    set((state) => {
      const commits = { ...state.commits, [commit.sha]: { ...commit, detached: true } };
      const decorated = decorateCommitsWithRefs(commits, state.branches, state.tags);
      return { commits: decorated, commitCount: Object.keys(decorated).length };
    }),

  setActiveRef: (ref) => set({ activeRef: ref }),

  setRefLoading: (ref) =>
    set((state) => {
      const current = ensureRef(state.refHistory, ref);
      return {
        refHistory: {
          ...state.refHistory,
          [ref]: { ...current, loading: true, error: null },
        },
      };
    }),

  setRefError: (ref, message) =>
    set((state) => {
      const current = ensureRef(state.refHistory, ref);
      return {
        refHistory: {
          ...state.refHistory,
          [ref]: { ...current, loading: false, error: message },
        },
      };
    }),

  selectCommit: (sha, source = "loaded") =>
    set((state) => ({
      selectedCommitSha: sha,
      selectedCommitSource: sha ? source : null,
      snapshotState:
        state.snapshotState.data && state.snapshotState.data.commitSha === sha
          ? state.snapshotState
          : {
              ...state.snapshotState,
              status: "idle",
              error: null,
              requestedSha: sha,
            },
    })),

  setView: (view) => set({ view }),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setWarning: (warning) => set({ warnings: warning ? [warning] : [] }),

  addWarning: (warning) =>
    set((state) => ({
      warnings: state.warnings.includes(warning)
        ? state.warnings
        : [...state.warnings, warning],
    })),

  setRateLimit: (rateLimit) => set({ rateLimit }),

  setDetailLoading: (sha) =>
    set((state) => ({
      detailStates: {
        ...state.detailStates,
        [sha]: { status: "loading", error: null },
      },
    })),

  setDetailSuccess: (details) =>
    set((state) => ({
      details: { ...state.details, [details.sha]: details },
      detailStates: {
        ...state.detailStates,
        [details.sha]: { status: "success", error: null },
      },
    })),

  setDetailError: (sha, error) =>
    set((state) => ({
      detailStates: {
        ...state.detailStates,
        [sha]: { status: "error", error },
      },
    })),

  setSnapshotLoading: (sha) =>
    set((state) => ({
      snapshotState: {
        status: "loading",
        data: state.snapshotState.data,
        error: null,
        requestedSha: sha,
      },
    })),

  setSnapshotDeferred: (sha) =>
    set({
      snapshotState: {
        status: "deferred",
        data: null,
        error: null,
        requestedSha: sha,
      },
    }),

  setSnapshotSuccess: (snapshot) =>
    set((state) =>
      state.selectedCommitSha !== snapshot.commitSha
        ? state
        : {
            snapshotState: {
              status: "ready",
              data: snapshot,
              error: null,
              requestedSha: snapshot.commitSha,
            },
          },
    ),

  setSnapshotError: (sha, error) =>
    set((state) =>
      state.selectedCommitSha !== sha
        ? state
        : {
            snapshotState: {
              status: "error",
              data:
                state.snapshotState.data?.commitSha === sha
                  ? state.snapshotState.data
                  : null,
              error,
              requestedSha: sha,
            },
          },
    ),

  mergeSnapshotDirectory: (directoryPath, entries, truncated) =>
    set((state) => {
      const snapshot = state.snapshotState.data;
      if (!snapshot) return state;
      const byPath = new Map(snapshot.entries.map((entry) => [entry.path, entry]));
      for (const entry of entries) byPath.set(entry.path, entry);
      const expandedDirs = snapshot.expandedDirs.includes(directoryPath)
        ? snapshot.expandedDirs
        : [...snapshot.expandedDirs, directoryPath];
      const loadedDirs = snapshot.loadedDirs.includes(directoryPath)
        ? snapshot.loadedDirs
        : [...snapshot.loadedDirs, directoryPath];
      return {
        snapshotState: {
          ...state.snapshotState,
          data: {
            ...snapshot,
            entries: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
            expandedDirs,
            loadedDirs,
            truncated: snapshot.truncated || truncated,
            partialReason: truncated
              ? "GitHub returned a truncated directory listing. Some entries may be unavailable."
              : snapshot.partialReason,
          },
        },
      };
    }),

  setComparisonLoading: (base, target) =>
    set({
      comparison: {
        base,
        target,
        status: "loading",
        result: null,
        error: null,
      },
    }),

  setComparisonSuccess: (result) =>
    set({
      comparison: {
        base: result.base,
        target: result.target,
        status: "success",
        result,
        error: null,
      },
    }),

  setComparisonError: (error) =>
    set((state) => ({
      comparison: { ...state.comparison, status: "error", error },
    })),

  clearComparison: () => set({ comparison: EMPTY_COMPARISON }),

  setComparisonBase: (base) =>
    set((state) => ({
      comparison: { ...state.comparison, base },
    })),
}));
