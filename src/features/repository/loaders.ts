import type {
  CommitRecord,
  ComparisonResult,
  RepositoryIdentity,
  RepositoryInfo,
} from "../../types/domain";
import { isAbortError, toAppError } from "../../services/github/errors";
import {
  compareRevisions,
  fetchBranchesPage,
  fetchCommitsPage,
  fetchCommitBySha,
  fetchTagsPage,
} from "../../services/github/repositoryApi";
import {
  getDemoCommit,
  demoComparison,
} from "../../fixtures/demo/atlas";
import { useRepositoryStore } from "../../store/repositoryStore";

function stillCurrent(identity: RepositoryIdentity): boolean {
  const repository = useRepositoryStore.getState().repository;
  if (!repository) return true;
  return (
    repository.identity.owner.toLowerCase() === identity.owner.toLowerCase() &&
    repository.identity.name.toLowerCase() === identity.name.toLowerCase()
  );
}

export async function loadBranchHistory(
  identity: RepositoryIdentity,
  ref: string,
  options: { selectTip?: boolean; signal?: AbortSignal } = {},
): Promise<void> {
  const store = useRepositoryStore.getState();
  store.setActiveRef(ref);

  const current = store.refHistory[ref];
  const source = store.source;
  if (source === "demo") {
    if (options.selectTip) {
      const tip = store.branches.find((branch) => branch.name === ref)?.sha;
      if (tip) useRepositoryStore.getState().selectCommit(tip);
    }
    return;
  }

  if (current?.loading) return;

  if (!current || current.loadedPages === 0) {
    useRepositoryStore.getState().setRefLoading(ref);
    try {
      const page = await fetchCommitsPage(identity, ref, 1, options.signal);
      if (!stillCurrent(identity)) return;
      if (page.commits.length === 0) {
        throw new Error("This reference has no commits in the loaded range.");
      }
      useRepositoryStore.getState().ingestCommits({
        ref,
        commits: page.commits,
        page: 1,
        hasMore: page.hasMore,
      });
    } catch (error) {
      if (isAbortError(error)) return;
      const appError = toAppError(error, "The branch history could not be loaded.");
      useRepositoryStore.getState().setRefError(ref, appError.message);
      throw appError;
    }
  }

  if (options.selectTip) {
    const state = useRepositoryStore.getState();
    const tip =
      state.branches.find((branch) => branch.name === ref)?.sha ??
      state.tags.find((tag) => tag.name === ref)?.sha;
    if (tip && state.commits[tip]) {
      state.selectCommit(tip);
    } else if (tip) {
      try {
        const commit = await ensureCommitLoaded(identity, tip, options.signal);
        if (commit) useRepositoryStore.getState().selectCommit(tip, "detached");
      } catch {
        // The branch itself is loaded; failing to auto-select the tip is nonfatal.
      }
    }
  }
}

export async function loadMoreHistory(
  identity: RepositoryIdentity,
  signal?: AbortSignal,
): Promise<void> {
  const state = useRepositoryStore.getState();
  const ref = state.activeRef;
  if (!ref || state.source === "demo") return;
  const current = state.refHistory[ref];
  if (!current || current.loading || current.complete) return;
  const nextPage = current.loadedPages + 1;
  state.setRefLoading(ref);
  try {
    const page = await fetchCommitsPage(identity, ref, nextPage, signal);
    if (!stillCurrent(identity)) return;
    useRepositoryStore.getState().ingestCommits({
      ref,
      commits: page.commits,
      page: nextPage,
      hasMore: page.hasMore,
    });
  } catch (error) {
    if (isAbortError(error)) return;
    const appError = toAppError(error, "Older commits could not be loaded.");
    useRepositoryStore.getState().setRefError(ref, appError.message);
    throw appError;
  }
}

export async function loadMoreBranches(
  identity: RepositoryIdentity,
  signal?: AbortSignal,
): Promise<void> {
  const state = useRepositoryStore.getState();
  if (!state.branchesHasMore || state.branchesStatus === "loading") return;
  state.setBranchesStatus("loading");
  try {
    const page = await fetchBranchesPage(identity, state.branchesPage + 1, signal);
    if (!stillCurrent(identity)) return;
    useRepositoryStore
      .getState()
      .appendBranches(page.branches, page.hasMore, state.branchesPage + 1);
  } catch (error) {
    if (isAbortError(error)) return;
    useRepositoryStore.getState().setBranchesStatus("error");
    throw error;
  }
}

export async function loadMoreTags(
  identity: RepositoryIdentity,
  signal?: AbortSignal,
): Promise<void> {
  const state = useRepositoryStore.getState();
  if (!state.tagsHasMore || state.tagsStatus === "loading") return;
  state.setTagsStatus("loading");
  try {
    const page = await fetchTagsPage(identity, state.tagsPage + 1, signal);
    if (!stillCurrent(identity)) return;
    const merged = [...state.tags, ...page.tags];
    const seen = new Set<string>();
    const tags = merged.filter((tag) => {
      if (seen.has(tag.name)) return false;
      seen.add(tag.name);
      return true;
    });
    useRepositoryStore
      .getState()
      .setTags(tags, page.hasMore, state.tagsPage + 1);
  } catch (error) {
    if (isAbortError(error)) return;
    useRepositoryStore.getState().setTagsStatus("error");
    throw error;
  }
}

export async function ensureCommitLoaded(
  identity: RepositoryIdentity,
  sha: string,
  signal?: AbortSignal,
): Promise<CommitRecord | null> {
  const state = useRepositoryStore.getState();
  if (state.commits[sha]) return state.commits[sha] ?? null;
  if (state.source === "demo") {
    const commit = getDemoCommit(sha);
    if (commit) useRepositoryStore.getState().addDetachedCommit(commit);
    return commit;
  }
  const commit = await fetchCommitBySha(identity, sha, signal);
  if (!stillCurrent(identity)) return null;
  useRepositoryStore.getState().addDetachedCommit(commit);
  return commit;
}

export async function selectBranchTip(
  identity: RepositoryIdentity,
  ref: string,
): Promise<void> {
  const state = useRepositoryStore.getState();
  const tip =
    state.branches.find((branch) => branch.name === ref)?.sha ??
    state.tags.find((tag) => tag.name === ref)?.sha;
  if (!tip) return;
  if (state.commits[tip]) {
    state.selectCommit(tip);
    return;
  }
  try {
    await ensureCommitLoaded(identity, tip);
    useRepositoryStore.getState().selectCommit(tip, "detached");
  } catch {
    // Selecting a branch should not fail solely because its tip could not be selected.
  }
}

export async function runComparison(
  identity: RepositoryIdentity,
  repository: RepositoryInfo,
  base: string,
  target: string,
  signal?: AbortSignal,
): Promise<ComparisonResult | null> {
  useRepositoryStore.getState().setComparisonLoading(base, target);
  try {
    let result: ComparisonResult;
    if (repository.source === "demo") {
      result = demoComparison(base, target);
    } else if (base === target) {
      result = {
        base,
        target,
        status: "identical",
        aheadBy: 0,
        behindBy: 0,
        totalCommits: 0,
        commits: [],
        files: [],
        commitsIncomplete: false,
        filesMayBeIncomplete: false,
        htmlUrl: null,
      };
    } else {
      result = await compareRevisions(identity, base, target, signal);
    }
    useRepositoryStore.getState().setComparisonSuccess(result);
    return result;
  } catch (error) {
    if (isAbortError(error)) return null;
    const appError = toAppError(error, "The comparison could not be completed.");
    useRepositoryStore.getState().setComparisonError(appError);
    throw appError;
  }
}

export function isDemoIdentity(identity: RepositoryIdentity): boolean {
  return identity.owner.toLowerCase() === "demo" && identity.name.toLowerCase() === "atlas-lens";
}
