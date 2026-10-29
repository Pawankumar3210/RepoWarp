import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  GitCompareArrows,
  GitFork,
  GitMerge,
  LoaderCircle,
  LocateFixed,
  RotateCcw,
  Tag,
  User,
} from "lucide-react";
import type {
  AppError,
  CommitDetails,
  CommitRecord,
  RequestStatus,
} from "../../types/domain";
import { copyText } from "../../utils/clipboard";
import { formatDate, formatDateTime, formatNumber, shortSha, truncate } from "../../utils/format";
import { useToastStore } from "../../store/toastStore";
import { Button, IconButton } from "../ui/Button";
import { CHANGE_COLOR, CHANGE_DOT, CHANGE_LABEL } from "./changeStyles";
import { cn } from "../../utils/cn";

interface CommitInspectorProps {
  commit: CommitRecord | null;
  details: CommitDetails | null;
  detailStatus: RequestStatus;
  detailError: AppError | null;
  hiddenByFilters: boolean;
  isDemo: boolean;
  onRetryDetails: () => void;
  onFocus: () => void;
  onOpenCommit: (sha: string) => void;
  onOpenCompare: () => void;
  onClearFilters: () => void;
}

function Avatar({
  name,
  url,
  size = 34,
}: {
  name: string | null;
  url: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="rounded-full border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-gradient-to-br from-aqua/20 to-violet/20 font-mono text-[0.6rem] font-semibold text-ink"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials || <User size={13} />}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-4 space-y-2.5" aria-label="Loading commit details" role="status">
      <div className="skeleton h-14 rounded-lg" />
      <div className="skeleton h-24 rounded-lg" />
      <div className="skeleton h-16 rounded-lg" />
    </div>
  );
}

export function CommitInspector({
  commit,
  details,
  detailStatus,
  detailError,
  hiddenByFilters,
  isDemo,
  onRetryDetails,
  onFocus,
  onOpenCommit,
  onOpenCompare,
  onClearFilters,
}: CommitInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const pushToast = useToastStore((state) => state.push);

  if (!commit) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-elevated/60">
          <LocateFixed size={20} className="text-faint" aria-hidden="true" />
        </span>
        <p className="mt-4 font-display text-sm font-semibold text-ink">No revision selected</p>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
          Select a node in the graph or a point on the timeline to inspect its
          message, author, and changed files.
        </p>
      </div>
    );
  }

  const files = details?.files ?? [];
  const visibleFiles = showAllFiles ? files : files.slice(0, 24);
  const additions = details?.stats?.additions ?? null;
  const deletions = details?.stats?.deletions ?? null;
  const totalChanged = (additions ?? 0) + (deletions ?? 0);
  const additionsWidth = totalChanged > 0 ? ((additions ?? 0) / totalChanged) * 100 : 0;

  const copySha = async () => {
    const ok = await copyText(commit.sha);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      pushToast({ tone: "error", title: "Could not copy the commit SHA" });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line/75 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="panel-kicker">Commit inspector</p>
          <div className="flex items-center gap-0.5">
            <IconButton label="Focus commit in the 3D graph" onClick={onFocus}>
              <LocateFixed size={15} />
            </IconButton>
            {commit.htmlUrl ? (
              <a
                href={commit.htmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="icon-btn"
                aria-label="Open commit on GitHub"
                title="Open commit on GitHub"
              >
                <ArrowUpRight size={15} />
              </a>
            ) : null}
          </div>
        </div>

        {hiddenByFilters ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber/25 bg-amber/[0.07] px-2.5 py-2">
            <p className="text-[0.66rem] leading-snug text-amber/90">
              This revision is hidden by the active filters.
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="shrink-0 text-[0.62rem] font-semibold text-amber underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>
        ) : null}

        <h2 className="mt-3 font-display text-[1.02rem] font-semibold leading-snug tracking-[-0.02em] text-ink">
          {commit.subject}
        </h2>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {commit.isMerge ? (
            <span className="chip chip-violet">
              <GitMerge size={10} /> merge
            </span>
          ) : null}
          {commit.detached ? (
            <span className="chip chip-amber">
              <GitFork size={10} /> detached
            </span>
          ) : null}
          {commit.refs.map((ref) => (
            <span key={`ref-${ref}`} className="chip chip-aqua">
              <GitFork size={10} /> {truncate(ref, 22)}
            </span>
          ))}
          {commit.tags.map((tag) => (
            <span key={`tag-${tag}`} className="chip chip-amber">
              <Tag size={10} /> {truncate(tag, 18)}
            </span>
          ))}
          {isDemo ? <span className="chip">demo fixture</span> : null}
        </div>
      </div>

      <div className="flex-1">
        <div className="border-b border-line/70 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={commit.authorName} url={commit.authorAvatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.78rem] font-semibold text-ink">
                {commit.authorName ?? commit.authorLogin ?? "Unknown author"}
              </p>
              <p className="mt-0.5 truncate text-[0.64rem] text-faint">
                {commit.authorLogin ? `@${commit.authorLogin} · ` : ""}
                {formatDateTime(commit.committedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={copySha}
              className="chip shrink-0 font-mono transition hover:border-aqua/35 hover:text-aqua"
              aria-label={`Copy commit SHA ${commit.sha}`}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {shortSha(commit.sha, 8)}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[0.67rem]">
            <span className="text-faint">Authored</span>
            <span className="text-muted">{formatDateTime(commit.authoredAt)}</span>
            <span className="text-faint">Tree</span>
            <span className="truncate font-mono text-muted">
              {details?.treeSha ?? commit.treeSha ?? "unavailable"}
            </span>
            <span className="text-faint">Parents</span>
            <span className="flex flex-wrap gap-1">
              {commit.parents.length === 0 ? (
                <span className="text-muted">root commit</span>
              ) : (
                commit.parents.map((parent) => (
                  <button
                    key={parent}
                    type="button"
                    onClick={() => onOpenCommit(parent)}
                    className="rounded border border-line/70 bg-elevated/50 px-1.5 py-0.5 font-mono text-[0.6rem] text-muted transition hover:border-aqua/35 hover:text-aqua"
                    title={`Open parent ${parent}`}
                  >
                    {shortSha(parent, 7)}
                  </button>
                ))
              )}
            </span>
          </div>
        </div>

        <div className="border-b border-line/70 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <p className="panel-kicker">Change footprint</p>
            {detailStatus === "loading" ? (
              <span className="flex items-center gap-1.5 text-[0.61rem] text-faint">
                <LoaderCircle size={11} className="animate-spin" /> loading
              </span>
            ) : null}
          </div>

          {detailStatus === "error" && detailError ? (
            <div className="mt-3 rounded-lg border border-rose/25 bg-rose/[0.06] px-3 py-2.5">
              <p className="text-[0.69rem] font-semibold text-rose">{detailError.title}</p>
              <p className="mt-1 text-[0.65rem] leading-relaxed text-muted">{detailError.message}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 !px-0 !text-rose"
                icon={<RotateCcw size={12} />}
                onClick={onRetryDetails}
              >
                Retry details
              </Button>
            </div>
          ) : !details && detailStatus === "loading" ? (
            <DetailSkeleton />
          ) : details ? (
            <>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-line/65 bg-base/25 px-2.5 py-2">
                  <p className="font-mono text-[0.7rem] font-semibold text-teal">
                    +{formatNumber(additions ?? 0)}
                  </p>
                  <p className="mt-0.5 text-[0.58rem] uppercase tracking-wider text-faint">added</p>
                </div>
                <div className="rounded-lg border border-line/65 bg-base/25 px-2.5 py-2">
                  <p className="font-mono text-[0.7rem] font-semibold text-rose">
                    −{formatNumber(deletions ?? 0)}
                  </p>
                  <p className="mt-0.5 text-[0.58rem] uppercase tracking-wider text-faint">deleted</p>
                </div>
                <div className="rounded-lg border border-line/65 bg-base/25 px-2.5 py-2">
                  <p className="font-mono text-[0.7rem] font-semibold text-ink">
                    {formatNumber(details.files.length)}
                  </p>
                  <p className="mt-0.5 text-[0.58rem] uppercase tracking-wider text-faint">files</p>
                </div>
              </div>
              <div className="mt-2.5 flex h-1 overflow-hidden rounded-full bg-line/70">
                <span className="bg-teal" style={{ width: `${additionsWidth}%` }} />
                <span className="bg-rose" style={{ width: `${100 - additionsWidth}%` }} />
              </div>
              {details.patchNote ? (
                <p className="mt-2 text-[0.62rem] leading-relaxed text-faint">{details.patchNote}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
              Details were not loaded for this revision yet.
            </p>
          )}
        </div>

        {details ? (
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <p className="panel-kicker">Changed files</p>
              <span className="font-mono text-[0.6rem] text-faint">
                {details.fileListTruncated ? `${files.length}+` : files.length}
              </span>
            </div>
            {details.fileListTruncated ? (
              <p className="mt-1 text-[0.62rem] text-amber/80">
                GitHub truncated this file list.
              </p>
            ) : null}
            {files.length === 0 ? (
              <p className="mt-3 text-[0.68rem] text-faint">
                No file changes were reported for this revision.
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {visibleFiles.map((file) => (
                  <details
                    key={`${file.status}-${file.path}`}
                    className="group rounded-lg border border-line/60 bg-base/20 open:bg-base/35"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[0.67rem] [&::-webkit-details-marker]:hidden">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          CHANGE_DOT[file.status],
                        )}
                        aria-hidden="true"
                      />
                      <span className={cn("w-11 shrink-0 text-[0.59rem]", CHANGE_COLOR[file.status])}>
                        {CHANGE_LABEL[file.status]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[0.61rem] text-muted">
                        {file.path}
                      </span>
                      <span className="shrink-0 font-mono text-[0.56rem] text-faint">
                        +{file.additions} −{file.deletions}
                      </span>
                    </summary>
                    <div className="border-t border-line/50 px-2.5 pb-2.5 pt-2">
                      {file.previousPath ? (
                        <p className="mb-1.5 truncate font-mono text-[0.56rem] text-faint">
                          from {file.previousPath}
                        </p>
                      ) : null}
                      {file.patch ? (
                        <pre className="scroll-thin max-h-44 overflow-auto rounded-md border border-line/50 bg-base/50 p-2 font-mono text-[0.55rem] leading-relaxed text-muted">
                          {file.patch}
                        </pre>
                      ) : (
                        <p className="text-[0.6rem] leading-relaxed text-faint">
                          {file.patchAvailable
                            ? "Patch is available in the API response but too large for this preview."
                            : "GitHub omitted this patch (binary, large, or metadata-only change)."}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
            {files.length > 24 ? (
              <button
                type="button"
                onClick={() => setShowAllFiles((value) => !value)}
                className="mt-2 text-[0.64rem] font-semibold text-muted transition hover:text-ink"
              >
                {showAllFiles ? "Show fewer files" : `Show all ${files.length} files`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-line/75 bg-panel/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button
            variant="soft"
            size="sm"
            className="flex-1"
            icon={<GitCompareArrows size={14} />}
            onClick={onOpenCompare}
          >
            Compare revision
          </Button>
          {commit.htmlUrl ? (
            <a
              href={commit.htmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-outline min-h-8 rounded-[0.65rem] px-3 text-[0.76rem]"
            >
              GitHub
              <ArrowUpRight size={13} />
            </a>
          ) : null}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[0.58rem] text-faint">
          <span>Committed {formatDate(commit.committedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>Patches appear when GitHub provides them</span>
        </p>
      </div>
    </div>
  );
}
