import { useCallback, useEffect, useRef, useState } from "react";
import type { RepositoryIdentity, RepositorySource, ViewMode } from "../types/domain";
import {
  fetchBranchesPage,
  fetchCommitsPage,
  fetchCommitBySha,
  fetchRepository,
  fetchTagsPage,
} from "../services/github/repositoryApi";
import { isAbortError, toAppError } from "../services/github/errors";
import { useRepositoryStore } from "../store/repositoryStore";
import { usePreferencesStore } from "../store/preferencesStore";
import {
  demoBranches,
  demoCommits,
  demoRefHistory,
  demoRepository,
  demoTags,
} from "../fixtures/demo/atlas";

interface BootstrapOptions {
  owner: string;
  repo: string;
  demo: boolean;
  initialView: ViewMode;
  initialCommit: string | null;
  initialBranch: string | null;
}

function identityFrom(owner: string, repo: string): RepositoryIdentity {
  return { owner, name: repo, fullName: `${owner}/${repo}` };
}

function waitForStage(signal: AbortSignal, duration: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, duration);
    const onAbort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export interface BootstrapResult {
  retry: () => void;
}

export function useRepositoryBootstrap(options: BootstrapOptions): BootstrapResult {
  const [retryNonce, setRetryNonce] = useState(0);
  const initialRef = useRef({
    view: options.initialView,
    commit: options.initialCommit,
    branch: options.initialBranch,
  });

  const retry = useCallback(() => {
    setRetryNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    const source: RepositorySource = options.demo ? "demo" : "github";
    const identity = identityFrom(options.owner, options.repo);
    const initial = initialRef.current;
    const controller = new AbortController();
    let cancelled = false;

    const store = useRepositoryStore.getState();
    store.reset();
    store.beginLoading(source);
    store.setView(initial.view);
    usePreferencesStore.getState().setLastView(initial.view);

    const isStale = () =>
      cancelled ||
      controller.signal.aborted ||
      useRepositoryStore.getState().source !== source;

    if (options.demo) {
      store.setStage("validating", "complete");
      store.setStage("repository", "complete");
      store.setStage("branches", "complete");
      store.setRepository(demoRepository);
      store.setBranches(demoBranches, false, 1);
      store.setTags(demoTags, false, 1);

      const validBranch = initial.branch
        ? demoBranches.find((branch) => branch.name === initial.branch)
        : null;
      const activeRef = validBranch?.name ?? demoRepository.defaultBranch;
      if (initial.branch && !validBranch) {
        store.addWarning(
          `The demo does not include the reference “${initial.branch}”. Showing ${activeRef} instead.`,
        );
      }

      for (const branch of demoBranches) {
        const shas = demoRefHistory(branch.name) ?? [];
        const records = demoCommits.filter((commit) => shas.includes(commit.sha));
        store.ingestCommits({
          ref: branch.name,
          commits: records,
          page: 1,
          hasMore: false,
        });
      }

      store.setStage("history", "complete");
      store.setStage("graph", "complete");
      store.setActiveRef(activeRef);

      let selected = initial.commit;
      if (selected && !demoCommits.some((commit) => commit.sha === selected)) {
        store.addWarning(
          "The linked demo revision was not found. RepoWarp selected the latest curated commit instead.",
        );
        selected = null;
      }
      if (!selected) {
        selected =
          demoBranches.find((branch) => branch.name === activeRef)?.sha ??
          demoCommits[0]?.sha ??
          null;
      }
      if (selected) store.selectCommit(selected);
      store.setStage("ready", "active");
      const readyTimer = window.setTimeout(() => {
        if (!cancelled) store.finishLoading();
      }, 468);

      return () => {
        cancelled = true;
        controller.abort();
        window.clearTimeout(readyTimer);
      };
    }

    // Live GitHub mode.
    store.setStage("validating", "complete");
    store.setStage("repository", "active");

    const run = async () => {
      try {
        if (!(await waitForStage(controller.signal, 252))) return;
        const repository = await fetchRepository(identity, controller.signal);
        if (isStale()) return;
        useRepositoryStore.getState().setRepository(repository);
        useRepositoryStore.getState().setStage("repository", "complete");
        useRepositoryStore.getState().setStage("branches", "active");

        const activeRef = initial.branch || repository.defaultBranch;
        if (!(await waitForStage(controller.signal, 252))) return;

        let branchesResult: Awaited<ReturnType<typeof fetchBranchesPage>> | null = null;
        try {
          branchesResult = await fetchBranchesPage(identity, 1, controller.signal);
        } catch (error) {
          if (isAbortError(error)) return;
          useRepositoryStore.getState().setBranchesStatus("error");
          useRepositoryStore
            .getState()
            .addWarning(`Branch references are unavailable. ${toAppError(error).message}`);
        }
        if (isStale()) return;
        if (branchesResult) {
          useRepositoryStore
            .getState()
            .setBranches(branchesResult.branches, branchesResult.hasMore, 1);
        }

        let tagsResult: Awaited<ReturnType<typeof fetchTagsPage>> | null = null;
        try {
          tagsResult = await fetchTagsPage(identity, 1, controller.signal);
        } catch (error) {
          if (isAbortError(error)) return;
          useRepositoryStore.getState().setTagsStatus("error");
          useRepositoryStore
            .getState()
            .addWarning(`Tag markers are unavailable. ${toAppError(error).message}`);
        }
        if (isStale()) return;
        if (tagsResult) {
          useRepositoryStore
            .getState()
            .setTags(tagsResult.tags, tagsResult.hasMore, 1);
        }

        if (isStale()) return;
        useRepositoryStore.getState().setStage("branches", "complete");
        useRepositoryStore.getState().setStage("history", "active");
        if (!(await waitForStage(controller.signal, 252))) return;
        let page: Awaited<ReturnType<typeof fetchCommitsPage>>;
        try {
          page = await fetchCommitsPage(identity, activeRef, 1, controller.signal);
        } catch (error) {
          if (isAbortError(error)) return;
          useRepositoryStore.getState().setRepositoryError(toAppError(error));
          useRepositoryStore.getState().setStage("history", "error");
          return;
        }
        if (page.commits.length === 0) {
          useRepositoryStore.getState().setRepositoryError({
            kind: "empty_repo",
            title: "No commits available",
            message:
              "This reference has no commits, or GitHub returned an empty history for it.",
          });
          return;
        }

        useRepositoryStore.getState().setStage("history", "complete");
        useRepositoryStore.getState().setStage("graph", "active");
        if (!(await waitForStage(controller.signal, 252))) return;
        useRepositoryStore.getState().setActiveRef(activeRef);
        useRepositoryStore.getState().ingestCommits({
          ref: activeRef,
          commits: page.commits,
          page: 1,
          hasMore: page.hasMore,
        });

        let selectedSha: string | null = null;
        let selectedSource: "loaded" | "detached" = "loaded";

        if (initial.commit) {
          if (useRepositoryStore.getState().commits[initial.commit]) {
            selectedSha = initial.commit;
          } else {
            try {
              const commit = await fetchCommitBySha(identity, initial.commit, controller.signal);
              if (isStale()) return;
              useRepositoryStore.getState().addDetachedCommit(commit);
              selectedSha = commit.sha;
              selectedSource = "detached";
            } catch (error) {
              if (isAbortError(error)) return;
              useRepositoryStore.getState().addWarning(
                `The linked revision ${initial.commit.slice(0, 8)} could not be loaded. ${toAppError(error).message} Showing the latest loaded commit instead.`,
              );
            }
          }
        }

        if (!selectedSha) {
          const state = useRepositoryStore.getState();
          const tip =
            state.branches.find((branch) => branch.name === activeRef)?.sha ??
            state.tags.find((tag) => tag.name === activeRef)?.sha;
          selectedSha =
            (tip && state.commits[tip] ? tip : null) ?? page.commits[0]?.sha ?? null;
        }

        if (selectedSha) {
          useRepositoryStore.getState().selectCommit(selectedSha, selectedSource);
        }
        useRepositoryStore.getState().setStage("graph", "complete");
        useRepositoryStore.getState().setStage("ready", "active");
        if (!(await waitForStage(controller.signal, 468))) return;
        useRepositoryStore.getState().finishLoading();
        usePreferencesStore.getState().setLastView(initial.view);
        usePreferencesStore
          .getState()
          .rememberRepository(repository, selectedSha, initial.view);
      } catch (error) {
        if (isAbortError(error) || isStale()) {
          return;
        }
        useRepositoryStore.getState().setRepositoryError(
          toAppError(error, "The repository could not be opened."),
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [options.owner, options.repo, options.demo, retryNonce]);

  return { retry };
}
