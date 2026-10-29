import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  FolderOpen,
  GitCompareArrows,
  Layers3,
  LoaderCircle,
  LocateFixed,
  RotateCcw,
} from "lucide-react";
import type {
  AppError,
  FileChange,
  RepositoryInfo,
  RepositorySnapshot,
  SnapshotStatus,
} from "../../types/domain";
import type {
  CodebaseFileNode,
  CodebaseLayout,
} from "../../features/snapshots/codebaseLayout";
import { formatBytes, formatDateTime, formatNumber, shortSha, truncate } from "../../utils/format";
import { Button, IconButton } from "../ui/Button";
import { CHANGE_DOT, CHANGE_LABEL, CHANGE_COLOR } from "./changeStyles";
import { cn } from "../../utils/cn";

interface FileInspectorProps {
  file: CodebaseFileNode | null;
  layout: CodebaseLayout | null;
  snapshot: RepositorySnapshot | null;
  snapshotStatus: SnapshotStatus;
  snapshotError: AppError | null;
  change: FileChange | null;
  repository: RepositoryInfo;
  selectedSha: string | null;
  isDemo: boolean;
  expandingDirectory: string | null;
  onFocus: () => void;
  onOpenCompare: () => void;
  onExpandDirectory: (path: string, sha: string) => void;
  onSelectFile: (path: string) => void;
  onRetrySnapshot: () => void;
}

export function FileInspector({
  file,
  layout,
  snapshot,
  snapshotStatus,
  snapshotError,
  change,
  repository,
  selectedSha,
  isDemo,
  expandingDirectory,
  onFocus,
  onOpenCompare,
  onExpandDirectory,
  onSelectFile,
  onRetrySnapshot,
}: FileInspectorProps) {
  const unloadedDirectories =
    snapshot?.lazy
      ? snapshot.entries
          .filter(
            (entry) =>
              entry.type === "tree" && !snapshot.loadedDirs.includes(entry.path),
          )
          .slice(0, 12)
      : [];
  const changedFiles = snapshot?.changeFiles.slice(0, 10) ?? [];
  const pathParts = file?.path.split("/") ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line/75 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="panel-kicker">Snapshot inspector</p>
          <div className="flex items-center gap-0.5">
            <IconButton label="Focus file in the 3D landscape" onClick={onFocus} disabled={!file}>
              <LocateFixed size={15} />
            </IconButton>
            {snapshot && !isDemo ? (
              <a
                href={`${repository.htmlUrl}/tree/${snapshot.commitSha}`}
                target="_blank"
                rel="noreferrer noopener"
                className="icon-btn"
                aria-label="Open tree on GitHub"
                title="Open tree on GitHub"
              >
                <ArrowUpRight size={15} />
              </a>
            ) : null}
          </div>
        </div>

        {file ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {pathParts.map((part, index) => (
                <span key={`${part}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight size={10} className="text-faint" /> : null}
                  <span
                    className={cn(
                      "font-mono text-[0.59rem]",
                      index === pathParts.length - 1 ? "text-ink" : "text-faint",
                    )}
                  >
                    {part}
                  </span>
                </span>
              ))}
            </div>
            <h2 className="mt-2 break-all font-mono text-[0.86rem] font-semibold leading-snug text-ink">
              {file.name}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="chip">{file.category}</span>
              <span className="chip">{formatBytes(file.size)}</span>
              {change ? (
                <span className={cn("chip", CHANGE_COLOR[change.status])}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", CHANGE_DOT[change.status])} />
                  {CHANGE_LABEL[change.status]}
                </span>
              ) : (
                <span className="chip">unchanged in this commit</span>
              )}
              {isDemo ? <span className="chip">demo fixture</span> : null}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <h2 className="font-display text-sm font-semibold text-ink">
              {snapshotStatus === "loading"
                ? "Reconstructing tree"
                : snapshotStatus === "deferred"
                  ? "Snapshot paused"
                  : snapshotStatus === "error"
                    ? "Tree unavailable"
                    : "Select a file"}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {snapshotStatus === "loading"
                ? "RepoWarp is fetching this commit's tree and change metadata."
                : snapshotStatus === "deferred"
                  ? "Playback remains smooth by deferring tree reconstruction. Pause playback to load this snapshot."
                  : snapshotStatus === "error"
                    ? "The historical tree could not be loaded for this revision."
                    : "Click a pillar in the codebase landscape to inspect its path, size, type, and diff metadata."}
            </p>
          </div>
        )}

        {snapshotError ? (
          <div className="mt-3 rounded-lg border border-rose/25 bg-rose/[0.06] px-3 py-2.5">
            <p className="text-[0.69rem] font-semibold text-rose">{snapshotError.title}</p>
            <p className="mt-1 text-[0.64rem] leading-relaxed text-muted">{snapshotError.message}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 !px-0 !text-rose"
              icon={<RotateCcw size={12} />}
              onClick={onRetrySnapshot}
            >
              Retry snapshot
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex-1">
        {file ? (
          <div className="border-b border-line/70 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <p className="panel-kicker">Diff in this revision</p>
              {change ? (
                <span className="font-mono text-[0.6rem]">
                  <span className="text-teal">+{change.additions}</span>{" "}
                  <span className="text-rose">−{change.deletions}</span>
                </span>
              ) : null}
            </div>
            {change?.previousPath ? (
              <p className="mt-2 truncate font-mono text-[0.6rem] text-faint">
                Renamed from {change.previousPath}
              </p>
            ) : null}
            {change?.patch ? (
              <pre className="scroll-thin mt-2.5 max-h-64 overflow-auto rounded-lg border border-line/60 bg-base/45 p-2.5 font-mono text-[0.56rem] leading-relaxed text-muted">
                {change.patch}
              </pre>
            ) : (
              <p className="mt-2.5 text-[0.67rem] leading-relaxed text-faint">
                {change
                  ? change.patchAvailable
                    ? "Patch is available in the API response but omitted from this preview."
                    : "No patch text was returned for this file."
                  : "This file is present in the historical tree but was not changed by the selected commit."}
              </p>
            )}
          </div>
        ) : null}

        {snapshot ? (
          <div className="border-b border-line/70 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <p className="panel-kicker">Historical tree</p>
              <span className="font-mono text-[0.59rem] text-faint">
                {snapshot.commitSha === selectedSha ? "current" : "stale"}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-line/60 bg-base/25 px-2.5 py-2">
                <p className="font-mono text-[0.72rem] font-semibold text-ink">
                  {formatNumber(layout?.totalFiles ?? 0)}
                </p>
                <p className="text-[0.57rem] uppercase tracking-wider text-faint">files loaded</p>
              </div>
              <div className="rounded-lg border border-line/60 bg-base/25 px-2.5 py-2">
                <p className="font-mono text-[0.72rem] font-semibold text-ink">
                  {formatNumber(layout?.totalDirectories ?? 0)}
                </p>
                <p className="text-[0.57rem] uppercase tracking-wider text-faint">directories</p>
              </div>
            </div>
            <div className="mt-2.5 space-y-1 text-[0.63rem]">
              <p className="flex justify-between gap-4">
                <span className="text-faint">Commit</span>
                <span className="font-mono text-muted">{shortSha(snapshot.commitSha, 8)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-faint">Tree</span>
                <span className="truncate font-mono text-muted">{shortSha(snapshot.treeSha, 10)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-faint">Fetched</span>
                <span className="text-muted">{formatDateTime(snapshot.fetchedAt)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span className="text-faint">Mode</span>
                <span className="text-muted">{snapshot.lazy ? "lazy / on demand" : "recursive"}</span>
              </p>
            </div>
            {snapshot.partialReason ? (
              <p className="mt-2.5 rounded-lg border border-amber/20 bg-amber/[0.05] px-2.5 py-2 text-[0.62rem] leading-relaxed text-amber/85">
                {snapshot.partialReason}
              </p>
            ) : null}
          </div>
        ) : snapshotStatus === "loading" ? (
          <div className="space-y-2 px-4 py-4" aria-hidden="true">
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-16 rounded-lg" />
          </div>
        ) : null}

        {unloadedDirectories.length > 0 ? (
          <div className="border-b border-line/70 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <FolderOpen size={13} className="text-amber" aria-hidden="true" />
              <p className="panel-kicker">Expand historical tree</p>
            </div>
            <p className="mt-1.5 text-[0.63rem] leading-relaxed text-faint">
              This tree is loaded on demand. Expand directories to add their contents
              to the landscape.
            </p>
            <div className="mt-2 space-y-1">
              {unloadedDirectories.map((directory) => (
                <button
                  key={directory.path}
                  type="button"
                  onClick={() => onExpandDirectory(directory.path, directory.sha)}
                  disabled={expandingDirectory !== null}
                  className="flex w-full items-center gap-2 rounded-lg border border-line/55 bg-base/20 px-2 py-1.5 text-left transition hover:border-amber/30 hover:bg-elevated/40 disabled:cursor-wait disabled:opacity-60"
                >
                  {expandingDirectory === directory.path ? (
                    <LoaderCircle size={12} className="shrink-0 animate-spin text-amber" />
                  ) : (
                    <ChevronRight size={12} className="shrink-0 text-faint" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-[0.6rem] text-muted">
                    {truncate(directory.path, 40)}
                  </span>
                  <span className="text-[0.55rem] uppercase tracking-wider text-faint">load</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {changedFiles.length > 0 ? (
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <p className="panel-kicker">Changed in this commit</p>
              <span className="font-mono text-[0.59rem] text-faint">
                {snapshot?.changeFiles.length ?? 0}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {changedFiles.map((changed) => {
                const available = layout?.files.some((candidate) => candidate.path === changed.path);
                return (
                  <button
                    key={`${changed.status}-${changed.path}`}
                    type="button"
                    onClick={() => available && onSelectFile(changed.path)}
                    disabled={!available}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                      file?.path === changed.path
                        ? "border-aqua/30 bg-aqua/[0.06]"
                        : "border-line/55 bg-base/20 hover:border-line hover:bg-elevated/30",
                      !available && "cursor-default opacity-55",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CHANGE_DOT[changed.status])} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[0.59rem] text-muted">
                      {changed.path}
                    </span>
                    <span className="shrink-0 font-mono text-[0.55rem] text-faint">
                      +{changed.additions} −{changed.deletions}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-line/75 bg-panel/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          <Button
            variant="soft"
            size="sm"
            className="flex-1"
            icon={<GitCompareArrows size={14} />}
            onClick={onOpenCompare}
          >
            Compare revisions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Boxes size={14} />}
            onClick={onFocus}
            disabled={!file}
          >
            Focus
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[0.58rem] text-faint">
          <Layers3 size={11} />
          {snapshot?.lazy
            ? "Directories expand on demand"
            : "Tree reconstructed from one recursive API response"}
        </p>
      </div>
    </div>
  );
}
