import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ViewMode } from "../types/domain";
import { useRepositoryStore } from "../store/repositoryStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";
import {
  buildExplorationSearch,
  parseExplorationSearch,
} from "../utils/urlState";
import {
  ensureCommitLoaded,
  loadBranchHistory,
  runComparison,
  selectBranchTip,
} from "../features/repository/loaders";
import { isAbortError, toAppError } from "../services/github/errors";
import { usePlaybackStore } from "../store/playbackStore";

interface RoutingOptions {
  owner: string;
  repo: string;
  ready: boolean;
}

export interface ExplorationRouting {
  file: string | null;
  selectCommit: (sha: string, source?: "loaded" | "detached") => void;
  selectFile: (path: string | null) => void;
  switchView: (view: ViewMode, options?: { push?: boolean }) => void;
  switchBranch: (ref: string) => Promise<void>;
  compare: (base: string, target: string) => Promise<void>;
  clearComparison: () => void;
  shareUrl: () => string;
  refreshUrl: () => void;
}

export function useExplorationRouting(options: RoutingOptions): ExplorationRouting {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCommitSha = useRepositoryStore((state) => state.selectedCommitSha);
  const currentView = useRepositoryStore((state) => state.view);

  const buildSearch = useCallback(
    (overrides: {
      view?: ViewMode;
      commit?: string | null;
      branch?: string | null;
      file?: string | null;
    }) => {
      const state = useRepositoryStore.getState();
      const selected = overrides.commit !== undefined ? overrides.commit : state.selectedCommitSha;
      const view = overrides.view ?? state.view;
      const branch = overrides.branch !== undefined ? overrides.branch : state.activeRef;
      const comparison = state.comparison.result;
      const base =
        comparison && comparison.target === selected ? comparison.base : null;
      const currentFile = parseExplorationSearch(
        new URLSearchParams(location.search),
      ).file;
      const file = overrides.file !== undefined ? overrides.file : currentFile;
      return buildExplorationSearch(new URLSearchParams(), {
        view,
        commit: selected,
        branch,
        demo: state.source === "demo",
        base,
        file,
      }).toString();
    },
    [location.search],
  );

  const pathname = `/r/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}`;

  const navigateState = useCallback(
    (
      overrides: {
        view?: ViewMode;
        commit?: string | null;
        branch?: string | null;
        file?: string | null;
      },
      replace = true,
    ) => {
      const search = buildSearch(overrides);
      navigate({ pathname, search: search ? `?${search}` : "" }, { replace });
    },
    [buildSearch, navigate, pathname],
  );

  const refreshUrl = useCallback(() => {
    navigateState({}, true);
  }, [navigateState]);

  const selectCommit = useCallback(
    (sha: string, source: "loaded" | "detached" = "loaded") => {
      useRepositoryStore.getState().selectCommit(sha, source);
      navigateState({ commit: sha });
    },
    [navigateState],
  );

  const selectFile = useCallback(
    (path: string | null) => {
      navigateState({ file: path });
    },
    [navigateState],
  );

  const switchView = useCallback(
    (view: ViewMode, options: { push?: boolean } = {}) => {
      useRepositoryStore.getState().setView(view);
      usePreferencesStore.getState().setLastView(view);
      navigateState(
        { view, commit: useRepositoryStore.getState().selectedCommitSha },
        !(options.push ?? true),
      );
    },
    [navigateState],
  );

  const switchBranch = useCallback(
    async (ref: string) => {
      const identity = useRepositoryStore.getState().repository?.identity;
      if (!identity) return;
      const state = useRepositoryStore.getState();
      const previousRef = state.activeRef;
      state.setActiveRef(ref);
      try {
        await loadBranchHistory(identity, ref, { selectTip: false });
        await selectBranchTip(identity, ref);
        const latest = useRepositoryStore.getState();
        navigateState({ branch: ref, commit: latest.selectedCommitSha });
      } catch (error) {
        if (isAbortError(error)) return;
        useToastStore.getState().push({
          tone: "error",
          title: "Branch could not be opened",
          message: toAppError(error).message,
        });
        useRepositoryStore.getState().setActiveRef(previousRef);
        useRepositoryStore.getState().addWarning(toAppError(error).message);
        refreshUrl();
      }
    },
    [navigateState, refreshUrl],
  );

  const compare = useCallback(
    async (base: string, target: string) => {
      const repository = useRepositoryStore.getState().repository;
      const identity = repository?.identity;
      if (!identity || !repository) return;
      await runComparison(identity, repository, base, target);
      navigateState({ commit: useRepositoryStore.getState().selectedCommitSha });
    },
    [navigateState],
  );

  const clearComparison = useCallback(() => {
    useRepositoryStore.getState().clearComparison();
    navigateState({});
  }, [navigateState]);

  const shareUrl = useCallback(() => {
    const state = useRepositoryStore.getState();
    const comparison = state.comparison.result;
    const base =
      comparison && comparison.target === state.selectedCommitSha ? comparison.base : null;
    const search = buildExplorationSearch(new URLSearchParams(), {
      view: state.view,
      commit: state.selectedCommitSha,
      branch: state.activeRef,
      demo: state.source === "demo",
      base,
      file: parseExplorationSearch(new URLSearchParams(location.search)).file,
    }).toString();
    return `${window.location.origin}${pathname}${search ? `?${search}` : ""}`;
  }, [location.search, pathname]);

  useEffect(() => {
    if (!options.ready) return;
    const state = useRepositoryStore.getState();
    if (!state.repository) return;

    const searchParams = new URLSearchParams(location.search);
    const parsed = parseExplorationSearch(searchParams);
    const controller = new AbortController();
    let cancelled = false;

    const apply = async () => {
      if (searchParams.has("view") && parsed.view !== state.view) {
        useRepositoryStore.getState().setView(parsed.view);
        usePreferencesStore.getState().setLastView(parsed.view);
      }

      if (parsed.branch && parsed.branch !== useRepositoryStore.getState().activeRef) {
        const identity = useRepositoryStore.getState().repository?.identity;
        if (identity) {
          try {
            await loadBranchHistory(identity, parsed.branch, {
              selectTip: false,
              signal: controller.signal,
            });
          } catch (error) {
            if (isAbortError(error) || cancelled) return;
            useRepositoryStore
              .getState()
              .addWarning(`Reference “${parsed.branch}” could not be loaded. ${toAppError(error).message}`);
            useRepositoryStore.getState().setActiveRef(state.activeRef);
            refreshUrl();
          }
        }
      }

      if (parsed.commit && parsed.commit !== useRepositoryStore.getState().selectedCommitSha) {
        const identity = useRepositoryStore.getState().repository?.identity;
        if (identity) {
          try {
            const commit = await ensureCommitLoaded(identity, parsed.commit, controller.signal);
            if (!commit || cancelled) return;
            const latest = useRepositoryStore.getState();
            useRepositoryStore
              .getState()
              .selectCommit(parsed.commit, latest.commits[parsed.commit]?.detached ? "detached" : "loaded");
          } catch (error) {
            if (isAbortError(error) || cancelled) return;
            useRepositoryStore
              .getState()
              .addWarning(
                `Linked revision ${parsed.commit.slice(0, 8)} could not be opened. ${toAppError(error).message}`,
              );
            refreshUrl();
          }
        }
      } else if (parsed.branch && !parsed.commit) {
        const identity = useRepositoryStore.getState().repository?.identity;
        if (identity) {
          try {
            await selectBranchTip(identity, parsed.branch);
          } catch {
            // The branch itself loaded; tip selection is best-effort.
          }
        }
      }

      if (cancelled) return;

      if (parsed.base) {
        const latest = useRepositoryStore.getState();
        const target = latest.selectedCommitSha;
        if (target && target !== parsed.base) {
          const comparison = latest.comparison;
          const alreadyApplied =
            comparison.result?.base === parsed.base && comparison.result?.target === target;
          if (!alreadyApplied && comparison.status !== "loading") {
            const identity = latest.repository?.identity;
            const repository = latest.repository;
            if (identity && repository) {
              try {
                await runComparison(identity, repository, parsed.base, target, controller.signal);
              } catch {
                // The comparison panel displays the concrete error.
              }
            }
          }
        }
      }
    };

    void apply();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [location.search, options.ready, refreshUrl]);

  useEffect(() => {
    if (!options.ready) return;
    if (!useRepositoryStore.getState().repository) return;
    const timer = window.setTimeout(() => {
      const state = useRepositoryStore.getState();
      if (state.repository) {
        usePreferencesStore
          .getState()
          .updateRecentContext(
            options.owner,
            options.repo,
            state.selectedCommitSha,
            state.view,
          );
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    options.ready,
    options.owner,
    options.repo,
    selectedCommitSha,
    currentView,
  ]);

  useEffect(() => {
    usePlaybackStore.getState().stop();
  }, [location.pathname]);

  return {
    file: parseExplorationSearch(new URLSearchParams(location.search)).file,
    selectCommit,
    selectFile,
    switchView,
    switchBranch,
    compare,
    clearComparison,
    shareUrl,
    refreshUrl,
  };
}
