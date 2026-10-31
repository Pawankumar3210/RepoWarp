import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Expand,
  GitBranch,
  GitCompareArrows,
  GitFork,
  HelpCircle,
  LoaderCircle,
  LocateFixed,
  Maximize2,
  Minimize2,
  Move,
  Orbit,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import type {
  AppError,
  RepositorySnapshot,
  RequestStatus,
  SnapshotStatus,
  ViewMode,
} from "../types/domain";
import { SiteHeader } from "../components/layout/SiteHeader";
import { Button, IconButton } from "../components/ui/Button";
import { CommitInspector } from "../components/workspace/CommitInspector";
import { ComparisonDialog } from "../components/workspace/ComparisonDialog";
import { ExportMenu } from "../components/workspace/ExportMenu";
import { FileInspector } from "../components/workspace/FileInspector";
import { FiltersPanel } from "../components/workspace/FiltersPanel";
import { HelpDialog } from "../components/workspace/HelpDialog";
import { TimelineDock } from "../components/workspace/TimelineDock";
import { WarningBanner } from "../components/workspace/WarningBanner";
import {
  EmptyHistoryState,
  RepositoryErrorState,
  RepositoryLoading,
} from "../components/workspace/RepositoryStates";
import { HistoryScene } from "../three/history/HistoryScene";
import { CodebaseScene } from "../three/codebase/CodebaseScene";
import { useRepositoryBootstrap } from "../hooks/useRepositoryBootstrap";
import { useExplorationRouting } from "../hooks/useExplorationRouting";
import { usePlayback } from "../hooks/usePlayback";
import { useSelectedCommitDetails } from "../hooks/useSelectedCommitDetails";
import { useSnapshotLoader } from "../hooks/useSnapshotLoader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useRepositoryStore } from "../store/repositoryStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { usePlaybackStore } from "../store/playbackStore";
import { useSceneBus } from "../store/sceneBus";
import { useToastStore } from "../store/toastStore";
import {
  filterCommits,
  getAuthorOptions,
  layoutGraph,
} from "../features/history/graphLayout";
import {
  layoutCodebase,
  type CodebaseLayout,
  type CodebaseFileNode,
} from "../features/snapshots/codebaseLayout";
import {
  loadMoreBranches,
  loadMoreHistory,
} from "../features/repository/loaders";
import { loadDirectoryChildren } from "../services/github/repositoryApi";
import { isAbortError, toAppError } from "../services/github/errors";
import { parseExplorationSearch } from "../utils/urlState";
import { formatCompact, formatRelative } from "../utils/format";
import { cn } from "../utils/cn";

function RepoAvatar({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-11 w-11 shrink-0 rounded-xl border border-line/80 object-cover sm:h-12 sm:w-12"
      />
    );
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-aqua/25 bg-gradient-to-br from-aqua/20 via-panel to-violet/20 font-display text-sm font-semibold text-ink sm:h-12 sm:w-12">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function SceneStatusCard({
  tone,
  title,
  message,
  action,
}: {
  tone: "aqua" | "amber" | "rose";
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="glass panel-enter w-full max-w-sm rounded-2xl px-5 py-5 text-center">
        <span
          className={cn(
            "mx-auto flex h-11 w-11 items-center justify-center rounded-xl border",
            tone === "aqua" && "border-aqua/25 bg-aqua/10 text-aqua",
            tone === "amber" && "border-amber/25 bg-amber/10 text-amber",
            tone === "rose" && "border-rose/25 bg-rose/10 text-rose",
          )}
        >
          {tone === "rose" ? (
            <RotateCcw size={18} />
          ) : tone === "amber" ? (
            <Play size={18} />
          ) : (
            <LoaderCircle size={18} className="animate-spin" />
          )}
        </span>
        <p className="mt-3 font-display text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted">{message}</p>
        {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function RepositoryPage() {
  const params = useParams<{ owner: string; repo: string }>();
  const owner = params.owner ?? "";
  const repo = params.repo ?? "";
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const parsed = parseExplorationSearch(searchParams);
  const demo = parsed.demo;
  const lastView = usePreferencesStore((state) => state.lastView);
  const initialView = searchParams.has("view") ? parsed.view : lastView;
  const hasUrlView = searchParams.has("view");

  const repository = useRepositoryStore((state) => state.repository);
  const source = useRepositoryStore((state) => state.source);
  const repositoryStatus = useRepositoryStore((state) => state.repositoryStatus);
  const repositoryError = useRepositoryStore((state) => state.repositoryError);
  const stages = useRepositoryStore((state) => state.loadStages);
  const branches = useRepositoryStore((state) => state.branches);
  const branchesHasMore = useRepositoryStore((state) => state.branchesHasMore);
  const commits = useRepositoryStore((state) => state.commits);
  const refHistory = useRepositoryStore((state) => state.refHistory);
  const activeRef = useRepositoryStore((state) => state.activeRef);
  const selectedCommitSha = useRepositoryStore((state) => state.selectedCommitSha);
  const view = useRepositoryStore((state) => state.view);
  const filters = useRepositoryStore((state) => state.filters);
  const snapshotState = useRepositoryStore((state) => state.snapshotState);
  const details = useRepositoryStore((state) => state.details);
  const detailStates = useRepositoryStore((state) => state.detailStates);
  const comparison = useRepositoryStore((state) => state.comparison);
  const resetFilters = useRepositoryStore((state) => state.resetFilters);

  const theme = usePreferencesStore((state) => state.theme);
  const reduceMotion = useReduceMotion();
  const pushToast = useToastStore((state) => state.push);
  const requestFit = useSceneBus((state) => state.requestFit);
  const requestReset = useSceneBus((state) => state.requestReset);
  const requestPan = useSceneBus((state) => state.requestPan);
  const requestFocus = useSceneBus((state) => state.requestFocus);
  const workspaceRef = useRef<HTMLElement | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cinematic, setCinematic] = useState(false);
  const cinematicActive = cinematic && !reduceMotion;
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanding, setExpanding] = useState<{ path: string; commitSha: string } | null>(
    null,
  );
  const expandController = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setExpanded(document.fullscreenElement === workspaceRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleExpanded = useCallback(async () => {
    try {
      if (document.fullscreenElement === workspaceRef.current) {
        await document.exitFullscreen();
      } else {
        await workspaceRef.current?.requestFullscreen();
      }
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Expand mode unavailable",
        message: error instanceof Error ? error.message : "The browser could not open full screen.",
      });
    }
  }, [pushToast]);

  const bootstrap = useRepositoryBootstrap({
    owner,
    repo,
    demo,
    initialView,
    initialCommit: parsed.commit,
    initialBranch: parsed.branch,
  });

  const ready = repositoryStatus === "ready";
  const routing = useExplorationRouting({
    owner,
    repo,
    ready,
  });
  const { retry: retryDetails } = useSelectedCommitDetails();
  const { retry: retrySnapshot } = useSnapshotLoader();

  const activeRefState = activeRef ? refHistory[activeRef] : undefined;
  const activeShas = useMemo(
    () => (activeRef ? refHistory[activeRef]?.loadedShas ?? [] : []),
    [activeRef, refHistory],
  );

  const activeCommits = useMemo(() => {
    const seen = new Set<string>();
    const list = [];
    for (const sha of activeShas) {
      const commit = commits[sha];
      if (commit && !seen.has(sha)) {
        seen.add(sha);
        list.push(commit);
      }
    }
    const selected = selectedCommitSha ? commits[selectedCommitSha] : undefined;
    if (selected && !seen.has(selected.sha)) list.push(selected);
    return list;
  }, [activeShas, commits, selectedCommitSha]);

  const filtered = useMemo(
    () => filterCommits(activeCommits, filters, branches),
    [activeCommits, filters, branches],
  );
  const authorOptions = useMemo(() => getAuthorOptions(activeCommits), [activeCommits]);
  const historyLayout = useMemo(() => layoutGraph(filtered.commits), [filtered]);

  const selectedCommit = selectedCommitSha ? commits[selectedCommitSha] ?? null : null;
  const isDemo = repository?.source === "demo" || source === "demo";
  const snapshot: RepositorySnapshot | null =
    snapshotState.data?.commitSha === selectedCommitSha ? snapshotState.data : null;
  const snapshotStatus: SnapshotStatus = snapshotState.status;

  const codebaseLayout: CodebaseLayout | null = useMemo(() => {
    if (!snapshot) return null;
    const changeMap = new Map(
      snapshot.changeFiles.map((change) => [change.path, change.status]),
    );
    return layoutCodebase(snapshot.entries, changeMap);
  }, [snapshot]);

  const selectedFile: CodebaseFileNode | null = routing.file
    ? codebaseLayout?.files.find((file) => file.path === routing.file) ?? null
    : null;
  const selectedChange =
    snapshot?.changeFiles.find((change) => change.path === routing.file) ?? null;
  const selectedDetails = selectedCommitSha ? details[selectedCommitSha] ?? null : null;
  const detailState = selectedCommitSha ? detailStates[selectedCommitSha] : undefined;
  const detailStatus: RequestStatus = selectedDetails
    ? "success"
    : detailState?.status ?? "idle";
  const detailError: AppError | null = detailState?.error ?? null;

  const hiddenByFilters = Boolean(
    selectedCommitSha && !filtered.matchingShas.has(selectedCommitSha),
  );
  const activeFilterCount = [
    filters.search,
    filters.author,
    filters.fromDate,
    filters.toDate,
    filters.mergesOnly,
    filters.taggedOnly,
    filters.branch,
  ].filter(Boolean).length;

  const historyComplete = Boolean(activeRefState?.complete);
  const canLoadMore =
    !isDemo &&
    Boolean(activeRef) &&
    Boolean(activeRefState) &&
    !activeRefState?.complete &&
    !activeRefState?.loading;
  const loadedTotal = activeCommits.length;
  const filteredTotal = filtered.commits.length;

  const playback = usePlayback({
    commits: filtered.commits,
    selectedSha: selectedCommitSha,
    onSelect: routing.selectCommit,
  });

  useEffect(() => {
    if (playback.isPlaying && hiddenByFilters) playback.pause();
  }, [hiddenByFilters, playback]);

  useEffect(() => {
    expandController.current?.abort();
  }, [selectedCommitSha, repository?.identity.fullName]);

  useEffect(
    () => () => {
      expandController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (filtersOpen || compareOpen || helpOpen) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName))
      ) {
        return;
      }

      const key = event.key;
      if (event.shiftKey && (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown")) {
        event.preventDefault();
        if (key === "ArrowLeft") requestPan(-1, 0);
        if (key === "ArrowRight") requestPan(1, 0);
        if (key === "ArrowUp") requestPan(0, 1);
        if (key === "ArrowDown") requestPan(0, -1);
        return;
      }
      if (key === " ") {
        event.preventDefault();
        playback.toggle();
        return;
      }
      if (key === "ArrowLeft") {
        event.preventDefault();
        playback.step(-1);
        return;
      }
      if (key === "ArrowRight") {
        event.preventDefault();
        playback.step(1);
        return;
      }
      if (key === "1" && view !== "history") {
        playback.pause();
        routing.switchView("history");
        return;
      }
      if (key === "2" && view !== "codebase") {
        playback.pause();
        routing.switchView("codebase");
        return;
      }
      if (key.toLowerCase() === "f") {
        event.preventDefault();
        setFiltersOpen(true);
        return;
      }
      if (key.toLowerCase() === "c") {
        event.preventDefault();
        setCompareOpen(true);
        return;
      }
      if (key.toLowerCase() === "o") {
        event.preventDefault();
        if (!reduceMotion) setCinematic((active) => !active);
        return;
      }
      if (key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [compareOpen, filtersOpen, helpOpen, playback, reduceMotion, requestPan, routing, view]);

  const handleLoadMore = useCallback(async () => {
    if (!repository || isDemo) return;
    setLoadingMore(true);
    try {
      await loadMoreHistory(repository.identity);
      pushToast({
        tone: "success",
        title: "Older history loaded",
        message: "The graph and timeline now include the next page of commits.",
      });
    } catch (error) {
      if (isAbortError(error)) return;
      const appError = toAppError(error, "Older history could not be loaded.");
      pushToast({
        tone: "error",
        title: "Could not load more history",
        message: appError.message,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [isDemo, pushToast, repository]);

  const handleExpandDirectory = useCallback(
    async (path: string, sha: string) => {
      if (!repository || isDemo) return;
      expandController.current?.abort();
      const controller = new AbortController();
      expandController.current = controller;
      setExpanding(selectedCommitSha ? { path, commitSha: selectedCommitSha } : null);
      try {
        const result = await loadDirectoryChildren(
          repository.identity,
          path,
          sha,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        useRepositoryStore
          .getState()
          .mergeSnapshotDirectory(path, result.entries, result.truncated);
        pushToast({
          tone: "success",
          title: "Directory expanded",
          message: `${result.entries.length} ${result.entries.length === 1 ? "entry" : "entries"} added from ${path}.`,
        });
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) return;
        pushToast({
          tone: "error",
          title: "Directory could not be loaded",
          message: toAppError(error, "GitHub did not return this directory.").message,
        });
      } finally {
        if (expandController.current === controller) {
          expandController.current = null;
          setExpanding((current) =>
            current?.commitSha === selectedCommitSha ? null : current,
          );
        }
      }
    },
    [isDemo, pushToast, repository, selectedCommitSha],
  );

  const handleCompare = useCallback(
    async (base: string, target: string) => {
      if (commits[target]) routing.selectCommit(target);
      await routing.compare(base, target);
    },
    [commits, routing],
  );

  const handleFocus = useCallback(() => {
    if (view === "history") {
      if (selectedCommitSha) {
        requestFocus("history", selectedCommitSha);
      } else {
        pushToast({ tone: "info", title: "Select a commit to focus first" });
      }
    } else if (routing.file) {
      requestFocus("codebase", routing.file);
    } else {
      pushToast({ tone: "info", title: "Select a file to focus first" });
    }
  }, [pushToast, requestFocus, routing.file, selectedCommitSha, view]);

  const switchView = useCallback(
    (nextView: ViewMode) => {
      if (nextView === view) return;
      usePlaybackStore.getState().stop();
      routing.switchView(nextView);
    },
    [routing, view],
  );

  const loadBranchesMore = useCallback(async () => {
    if (!repository) return;
    try {
      await loadMoreBranches(repository.identity);
    } catch (error) {
      if (isAbortError(error)) return;
      pushToast({
        tone: "error",
        title: "Branches could not be loaded",
        message: toAppError(error).message,
      });
    }
  }, [pushToast, repository]);

  useDocumentTitle(
    repository
      ? `${repository.identity.fullName} — RepoWarp`
      : `${owner}/${repo} — RepoWarp`,
  );

  if (!owner || !repo) {
    return (
      <RepositoryErrorState
        owner={owner || "unknown"}
        repo={repo || "repository"}
        error={{
          kind: "invalid_url",
          title: "Invalid repository path",
          message: "The URL does not include a valid owner and repository name.",
        }}
        onRetry={() => window.location.assign("/workspace")}
      />
    );
  }

  if (repositoryError && (!repository || repositoryStatus === "error")) {
    return (
      <div className="relative min-h-svh">
        <SiteHeader variant="workspace" />
        <RepositoryErrorState
          owner={owner}
          repo={repo}
          error={repositoryError}
          onRetry={bootstrap.retry}
        />
      </div>
    );
  }

  if (!repository || repositoryStatus !== "ready") {
    return (
      <div className="relative min-h-svh">
        <SiteHeader variant="workspace" />
        <RepositoryLoading owner={owner} repo={repo} demo={demo} stages={stages} />
      </div>
    );
  }

  const showHistoryScene = view === "history" && filtered.commits.length > 0;
  const canUseScene =
    showHistoryScene || (view === "codebase" && Boolean(codebaseLayout));
  const sourceLabel = isDemo ? "curated demo" : "live GitHub";
  const branchOptions = branches;
  const expandingDirectory =
    expanding && expanding.commitSha === selectedCommitSha ? expanding.path : null;

  return (
    <div className="relative min-h-svh overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem]" aria-hidden="true">
        <div className="aurora left-[-14rem] top-[-16rem] h-[32rem] w-[32rem] bg-aqua/[0.12]" />
        <div className="aurora right-[-8%] top-[-18rem] h-[34rem] w-[34rem] bg-violet/10" />
      </div>

      <SiteHeader variant="workspace" />
      <WarningBanner />

      <main
        ref={workspaceRef}
        className={cn(
          "workspace-main relative z-10 mx-auto max-w-[100rem] px-3 pb-10 pt-4 sm:px-5 sm:pt-6",
          expanded && "mx-0 min-h-svh max-w-none overflow-y-auto bg-base",
        )}
      >
        <nav className="mb-3 flex items-center gap-1.5 text-[0.65rem] text-faint" aria-label="Breadcrumb">
          <Link to="/workspace" className="transition hover:text-ink">
            Workspace
          </Link>
          <ChevronRight size={11} />
          <span className="font-mono text-muted">{repository.identity.owner}</span>
          <ChevronRight size={11} />
          <span className="font-mono text-ink">{repository.identity.name}</span>
        </nav>

        <section className="glass rounded-2xl px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <RepoAvatar url={repository.ownerAvatarUrl} name={repository.identity.name} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="break-words font-display text-xl font-semibold tracking-[-0.035em] text-ink sm:text-2xl">
                    {repository.identity.name}
                  </h1>
                  <span className="chip !h-5 !text-[0.55rem]">{sourceLabel}</span>
                  {repository.archived ? (
                    <span className="chip chip-amber !h-5 !text-[0.55rem]">archived</span>
                  ) : null}
                  {repository.fork ? (
                    <span className="chip !h-5 !text-[0.55rem]">
                      <GitFork size={9} /> fork
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-[0.64rem] text-faint">
                  {repository.identity.owner}
                  <span className="mx-1 text-faint/60">/</span>
                  {repository.identity.name}
                </p>
                {repository.description ? (
                  <p className="mt-2 max-w-2xl text-[0.76rem] leading-relaxed text-muted">
                    {repository.description}
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="chip">
                    <Star size={10} /> {formatCompact(repository.stars)}
                  </span>
                  <span className="chip">
                    <GitFork size={10} /> {formatCompact(repository.forks)}
                  </span>
                  {repository.language ? <span className="chip">{repository.language}</span> : null}
                  <span className="chip">
                    <GitBranch size={10} /> {repository.defaultBranch}
                  </span>
                  <span className="text-[0.6rem] text-faint">
                    pushed {formatRelative(repository.pushedAt ?? repository.updatedAt)}
                  </span>
                  {expanded ? (
                    <Button
                      size="sm"
                      variant="soft"
                      icon={<Minimize2 size={13} />}
                      onClick={() => void toggleExpanded()}
                      className="!h-8"
                    >
                      Exit expanded view
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!isDemo ? (
                <a
                  href={repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-outline !min-h-9 !px-3 !text-[0.72rem]"
                >
                  GitHub <ArrowUpRight size={13} />
                </a>
              ) : (
                <span className="chip">
                  <Sparkles size={10} /> fixture data
                </span>
              )}
              <IconButton
                label="Open guide and appearance settings"
                className="border border-line/70 bg-panel/40"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle size={16} />
              </IconButton>
            </div>
          </div>
        </section>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented" role="group" aria-label="Visualization mode">
              <button
                type="button"
                data-active={view === "history"}
                onClick={() => switchView("history")}
              >
                <Orbit size={14} /> History
              </button>
              <button
                type="button"
                data-active={view === "codebase"}
                onClick={() => switchView("codebase")}
              >
                <Boxes size={14} /> Codebase
              </button>
            </div>

            <label className="sr-only" htmlFor="active-reference">
              Active branch
            </label>
            <select
              id="active-reference"
              value={activeRef ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "__more__") {
                  void loadBranchesMore();
                  return;
                }
                if (value) void routing.switchBranch(value);
              }}
              className="field field-select !min-h-9 w-[11.5rem] !py-1.5 text-[0.68rem] sm:w-[13rem]"
              title="Switch branch"
            >
              {branchOptions.length === 0 ? <option value="">Loading branches…</option> : null}
              {branchOptions.map((branch) => (
                <option key={`branch-${branch.name}`} value={branch.name}>
                  {branch.name}
                </option>
              ))}
              {branchesHasMore ? <option value="__more__">Load more branches…</option> : null}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              icon={<SlidersHorizontal size={14} />}
              onClick={() => setFiltersOpen(true)}
              className={cn(activeFilterCount > 0 && "!text-aqua")}
            >
              Filters
              {activeFilterCount > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-aqua/15 px-1 font-mono text-[0.55rem] text-aqua">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<GitCompareArrows size={14} />}
              onClick={() => setCompareOpen(true)}
              className={cn(comparison.result && "!text-violet")}
            >
              Compare
            </Button>
            <ExportMenu
              view={view}
              theme={theme}
              selectedCommit={selectedCommit}
              historyLayout={historyLayout}
              codebaseLayout={codebaseLayout}
              historyComplete={historyComplete}
              shareUrl={routing.shareUrl()}
              disabled={activeCommits.length === 0}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0">
            <section
              className="stage-shell noise scene-stage group/stage relative overflow-hidden rounded-2xl"
            >
              <div
                className={cn(
                  "relative h-[clamp(23rem,52svh,42rem)]",
                  expanded && "h-[calc(100svh-19rem)] min-h-[28rem]",
                )}
              >
                <div key={view} className="scene-view-enter absolute inset-0">
                  {showHistoryScene ? (
                    <HistoryScene
                      layout={historyLayout}
                      selectedSha={selectedCommitSha}
                      onSelect={routing.selectCommit}
                      theme={theme}
                      reduceMotion={reduceMotion}
                      interactive
                      autoRotate={cinematicActive}
                      capture
                    />
                  ) : null}
                  {view === "codebase" && codebaseLayout && snapshot ? (
                    <CodebaseScene
                      layout={codebaseLayout}
                      selectedPath={routing.file}
                      onSelect={routing.selectFile}
                      theme={theme}
                      reduceMotion={reduceMotion}
                      interactive
                      autoRotate={cinematicActive}
                      capture
                    />
                  ) : null}
                </div>

                {view === "history" && filtered.commits.length === 0 ? (
                  <EmptyHistoryState filtered={activeFilterCount > 0} />
                ) : null}

                {view === "codebase" && !codebaseLayout ? (
                  <div className="absolute inset-0">
                    {snapshotStatus === "deferred" ? (
                      <SceneStatusCard
                        tone="amber"
                        title="Snapshot paused during playback"
                        message="Tree reconstruction is deferred so playback stays smooth. Pause time travel to load this revision's files."
                        action={
                          <Button
                            size="sm"
                            variant="soft"
                            icon={<Play size={13} />}
                            onClick={() => playback.pause()}
                          >
                            Pause playback
                          </Button>
                        }
                      />
                    ) : snapshotStatus === "error" ? (
                      <SceneStatusCard
                        tone="rose"
                        title="Tree unavailable"
                        message={
                          snapshotState.error?.message ??
                          "GitHub did not return the historical tree for this revision."
                        }
                        action={
                          <Button
                            size="sm"
                            variant="soft"
                            icon={<RotateCcw size={13} />}
                            onClick={retrySnapshot}
                          >
                            Retry snapshot
                          </Button>
                        }
                      />
                    ) : (
                      <SceneStatusCard
                        tone="aqua"
                        title={selectedCommitSha ? "Reconstructing tree" : "Select a revision"}
                        message={
                          selectedCommitSha
                            ? "Fetching the selected commit's tree and change metadata. History remains visible in the timeline below."
                            : "Choose a commit to reconstruct its historical file landscape."
                        }
                      />
                    )}
                  </div>
                ) : null}

                {view === "codebase" &&
                codebaseLayout &&
                snapshot &&
                codebaseLayout.totalFiles === 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center px-4">
                    <span className="glass rounded-full px-3 py-1.5 text-[0.62rem] text-amber/90">
                      This tree contains no files at its loaded depth. Expand directories in the inspector.
                    </span>
                  </div>
                ) : null}

                <div className="hud-enter pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="glass flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.61rem] font-semibold text-ink">
                      {view === "history" ? <Orbit size={12} className="text-aqua" /> : <Boxes size={12} className="text-violet" />}
                      {view === "history" ? "History Warp" : "Codebase Warp"}
                    </span>
                    <span className="glass rounded-lg px-2 py-1 font-mono text-[0.57rem] text-muted">
                      {view === "history"
                        ? `${filteredTotal} commits · ${historyLayout.laneCount} ${historyLayout.laneCount === 1 ? "lane" : "lanes"}`
                        : snapshot
                          ? `${codebaseLayout?.totalFiles ?? 0} files · ${codebaseLayout?.totalDirectories ?? 0} dirs`
                          : "tree pending"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="soft"
                    icon={expanded ? <Minimize2 size={15} /> : <Expand size={15} />}
                    onClick={() => void toggleExpanded()}
                    className="pointer-events-auto absolute left-1/2 top-3 !h-[2.3rem] -translate-x-1/2 !px-3 text-[0.68rem] font-semibold"
                  >
                    {expanded ? "Exit" : "Expand"}
                  </Button>
                </div>

                {canUseScene ? (
                  <div className="hud-enter-up absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
                    <div className="glass flex items-center gap-0.5 rounded-xl p-0.5">
                      <IconButton
                        label="Fit the scene to the viewport"
                        className="!h-8 !w-8"
                        onClick={requestFit}
                      >
                        <Maximize2 size={14} />
                      </IconButton>
                      <IconButton
                        label="Reset the camera"
                        className="!h-8 !w-8"
                        onClick={requestReset}
                      >
                        <RotateCcw size={14} />
                      </IconButton>
                      <IconButton
                        label="Focus the selected item"
                        className="!h-8 !w-8"
                        onClick={handleFocus}
                        disabled={view === "history" ? !selectedCommitSha : !routing.file}
                      >
                        <LocateFixed size={14} />
                      </IconButton>
                      <IconButton
                        label={
                          reduceMotion
                            ? "Cinematic orbit is off while reduced motion is enabled"
                            : cinematicActive
                              ? "Stop cinematic orbit (O)"
                              : "Start cinematic orbit (O)"
                        }
                        className={cn(
                          "!h-8 !w-8",
                          cinematicActive && "!border-aqua/35 !bg-aqua/10 !text-aqua",
                        )}
                        onClick={() => setCinematic((active) => !active)}
                        disabled={reduceMotion}
                        aria-pressed={cinematicActive}
                      >
                        <Orbit
                          size={14}
                          className={
                            cinematicActive ? "animate-spin [animation-duration:5s]" : ""
                          }
                        />
                      </IconButton>
                    </div>
                    <div
                      className="glass grid grid-cols-3 gap-0.5 rounded-xl p-0.5"
                      role="group"
                      aria-label="Pan the camera"
                    >
                      <span aria-hidden="true" />
                      <IconButton
                        label="Pan up (Shift+ArrowUp)"
                        className="!h-7 !w-7"
                        onClick={() => requestPan(0, 1)}
                      >
                        <ArrowUp size={12} />
                      </IconButton>
                      <span aria-hidden="true" />
                      <IconButton
                        label="Pan left (Shift+ArrowLeft)"
                        className="!h-7 !w-7"
                        onClick={() => requestPan(-1, 0)}
                      >
                        <ArrowLeft size={12} />
                      </IconButton>
                      <span className="flex h-7 w-7 items-center justify-center text-faint/60" aria-hidden="true">
                        <Move size={11} />
                      </span>
                      <IconButton
                        label="Pan right (Shift+ArrowRight)"
                        className="!h-7 !w-7"
                        onClick={() => requestPan(1, 0)}
                      >
                        <ArrowRight size={12} />
                      </IconButton>
                      <span aria-hidden="true" />
                      <IconButton
                        label="Pan down (Shift+ArrowDown)"
                        className="!h-7 !w-7"
                        onClick={() => requestPan(0, -1)}
                      >
                        <ArrowDown size={12} />
                      </IconButton>
                      <span aria-hidden="true" />
                    </div>
                    <div
                      className="glass hidden max-w-[min(42rem,calc(100%-1.5rem))] items-center rounded-xl border border-line/70 bg-panel/85 px-3 py-1.5 text-left shadow-lg shadow-black/10 backdrop-blur-md md:flex"
                      role="note"
                      aria-label="3D navigation controls"
                    >
                      <span className="text-[0.58rem] leading-relaxed text-muted">
                        <strong className="font-semibold text-ink">How to move:</strong>{" "}
                        drag with the left button to move · right-drag to look around ·
                        {" "}middle-drag to move closer or farther · one-finger swipe to move ·
                        {" "}two fingers to zoom or turn
                      </span>
                    </div>
                  </div>
                ) : null}

                {canUseScene ? (
                  <span className="glass pointer-events-none absolute bottom-3 right-3 z-10 rounded-full px-2.5 py-1 font-mono text-[0.54rem] text-faint sm:hidden">
                    drag · pinch · pan
                  </span>
                ) : null}

                <div className="hud-enter-up pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-2 sm:flex">
                  {view === "history" ? (
                    <>
                      <LegendDot color="bg-aqua" label="commit" />
                      <LegendDot color="bg-violet" label="merge" />
                      <LegendDot color="bg-amber" label="tag" />
                      <LegendDot color="bg-faint" label="boundary" />
                    </>
                  ) : (
                    <>
                      <LegendDot color="bg-aqua" label="code" />
                      <LegendDot color="bg-violet" label="data" />
                      <LegendDot color="bg-amber" label="docs" />
                      <LegendDot color="bg-rose" label="style" />
                    </>
                  )}
                </div>
              </div>
            </section>

            <TimelineDock
              commits={filtered.commits}
              selectedSha={selectedCommitSha}
              onSelect={routing.selectCommit}
              playback={playback}
              view={view}
              snapshotStatus={snapshotStatus}
              canLoadMore={canLoadMore}
              loadingMore={loadingMore}
              historyComplete={historyComplete}
              loadedTotal={loadedTotal}
              filteredTotal={filteredTotal}
              onLoadMore={() => void handleLoadMore()}
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[0.59rem] text-faint">
              <span>
                {hasUrlView
                  ? "View restored from the URL."
                  : `View initialized from your last preference (${initialView}).`}
              </span>
              <span>
                {isDemo
                  ? "Curated fixture · no GitHub requests"
                  : "Only loaded pages are visualized · anonymous API limits apply"}
              </span>
            </div>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-3 xl:self-start">
            <div className="glass glass-inspector panel-enter h-[min(72svh,46rem)] overflow-hidden rounded-2xl xl:h-[calc(100svh-22rem)] xl:min-h-[28rem]">
              {view === "history" ? (
                <CommitInspector
                  commit={selectedCommit}
                  details={selectedDetails}
                  detailStatus={detailStatus}
                  detailError={detailError}
                  hiddenByFilters={hiddenByFilters}
                  isDemo={isDemo}
                  onRetryDetails={retryDetails}
                  onFocus={handleFocus}
                  onOpenCommit={routing.selectCommit}
                  onOpenCompare={() => setCompareOpen(true)}
                  onClearFilters={resetFilters}
                />
              ) : (
                <FileInspector
                  file={selectedFile}
                  layout={codebaseLayout}
                  snapshot={snapshot}
                  snapshotStatus={snapshotStatus}
                  snapshotError={snapshotState.error}
                  change={selectedChange}
                  repository={repository}
                  selectedSha={selectedCommitSha}
                  isDemo={isDemo}
                  expandingDirectory={expandingDirectory}
                  onFocus={handleFocus}
                  onOpenCompare={() => setCompareOpen(true)}
                  onExpandDirectory={(path, sha) => void handleExpandDirectory(path, sha)}
                  onSelectFile={routing.selectFile}
                  onRetrySnapshot={retrySnapshot}
                />
              )}
            </div>
          </aside>
        </div>
      </main>

      <FiltersPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        authors={authorOptions}
        loadedCount={loadedTotal}
        visibleCount={filteredTotal}
      />
      <ComparisonDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        commits={activeCommits}
        selectedSha={selectedCommitSha}
        repository={repository}
        onCompare={handleCompare}
        onClear={routing.clearComparison}
      />
      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        view={view}
        onFilters={() => {
          setHelpOpen(false);
          setFiltersOpen(true);
        }}
        onCompare={() => {
          setHelpOpen(false);
          setCompareOpen(true);
        }}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="glass flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.54rem] text-faint">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      {label}
    </span>
  );
}
