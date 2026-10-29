import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pause,
  Play,
} from "lucide-react";
import type { CommitRecord, ViewMode } from "../../types/domain";
import type { PlaybackControls } from "../../hooks/usePlayback";
import { getTimelineCommits } from "../../features/history/graphLayout";
import { formatDate, shortSha, truncate } from "../../utils/format";
import { IconButton } from "../ui/Button";
import { cn } from "../../utils/cn";

interface TimelineDockProps {
  commits: CommitRecord[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
  playback: PlaybackControls;
  view: ViewMode;
  snapshotStatus: string;
  canLoadMore: boolean;
  loadingMore: boolean;
  historyComplete: boolean;
  loadedTotal: number;
  filteredTotal: number;
  onLoadMore: () => void;
}

export function TimelineDock({
  commits,
  selectedSha,
  onSelect,
  playback,
  view,
  snapshotStatus,
  canLoadMore,
  loadingMore,
  historyComplete,
  loadedTotal,
  filteredTotal,
  onLoadMore,
}: TimelineDockProps) {
  const ascending = useMemo(() => getTimelineCommits(commits), [commits]);
  const index = selectedSha
    ? ascending.findIndex((commit) => commit.sha === selectedSha)
    : -1;
  const selected = index >= 0 ? ascending[index] : null;
  const first = ascending[0] ?? null;
  const last = ascending[ascending.length - 1] ?? null;
  const progress =
    ascending.length > 1 && index >= 0 ? (index / (ascending.length - 1)) * 100 : 0;
  const disabled = ascending.length === 0;

  const status =
    view === "codebase" && playback.isPlaying
      ? {
          tone: "amber" as const,
          text: "Tree reconstruction pauses during playback",
        }
      : view === "codebase" && snapshotStatus === "loading"
        ? { tone: "aqua" as const, text: "Reconstructing the selected tree" }
        : view === "codebase" && snapshotStatus === "deferred"
          ? { tone: "amber" as const, text: "Pause playback to load this snapshot" }
          : view === "codebase" && snapshotStatus === "error"
            ? { tone: "rose" as const, text: "Snapshot unavailable for this revision" }
            : historyComplete
              ? { tone: "teal" as const, text: "End of loaded branch history" }
              : { tone: "faint" as const, text: "More history available on demand" };

  return (
    <div className="glass-soft panel-enter mt-3 rounded-xl px-3 py-2.5">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Previous revision (older)"
            onClick={() => playback.step(-1)}
            disabled={!playback.canGoOlder}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <button
            type="button"
            onClick={playback.toggle}
            disabled={disabled}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-aqua to-teal text-[#031113] shadow-[0_0_26px_rgb(var(--c-aqua)/0.28)] transition hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={playback.isPlaying ? "Pause time travel" : "Play time travel"}
          >
            {playback.isPlaying ? (
              <Pause size={17} fill="currentColor" />
            ) : (
              <Play size={17} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <IconButton
            label="Next revision (newer)"
            onClick={() => playback.step(1)}
            disabled={!playback.canGoNewer}
          >
            <ChevronRight size={18} />
          </IconButton>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[0.69rem] font-medium text-ink">
              {selected ? (
                <>
                  <span className="font-mono text-[0.6rem] text-aqua">
                    {shortSha(selected.sha, 7)}
                  </span>
                  <span className="mx-1.5 text-faint" aria-hidden="true">·</span>
                  <span>{truncate(selected.subject, 72)}</span>
                </>
              ) : (
                "No revision selected"
              )}
            </p>
            <span className="shrink-0 font-mono text-[0.59rem] text-faint">
              {selected ? formatDate(selected.committedAt) : "—"}
            </span>
          </div>
          <input
            type="range"
            className="range mt-1.5"
            min={0}
            max={Math.max(0, ascending.length - 1)}
            step={1}
            value={index >= 0 ? index : 0}
            disabled={disabled}
            onChange={(event) => {
              const next = ascending[Number(event.target.value)];
              if (next) onSelect(next.sha);
            }}
            style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
            aria-label="Commit timeline"
            aria-valuetext={
              selected
                ? `${formatDate(selected.committedAt)}, ${selected.subject}`
                : "No commit selected"
            }
          />
          <div className="mt-0.5 flex items-center justify-between font-mono text-[0.54rem] uppercase tracking-[0.12em] text-faint">
            <span>{first ? formatDate(first.committedAt) : "older"}</span>
            <span>
              {ascending.length > 0
                ? `${index >= 0 ? index + 1 : "–"} / ${ascending.length}${filteredTotal < loadedTotal ? " filtered" : ""}`
                : "no commits"}
            </span>
            <span>{last ? formatDate(last.committedAt) : "newer"}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="icon-btn hidden sm:inline-flex"
            onClick={() => playback.setDirection(playback.direction === 1 ? -1 : 1)}
            aria-label={`Playback direction: ${playback.direction === 1 ? "forward" : "backward"} in time. Click to reverse.`}
            title={playback.direction === 1 ? "Forward in time" : "Backward in time"}
          >
            {playback.direction === 1 ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
          </button>
          <label className="sr-only" htmlFor="playback-speed">
            Playback speed
          </label>
          <select
            id="playback-speed"
            value={playback.speed}
            onChange={(event) => playback.setSpeed(Number(event.target.value))}
            className="field field-select !min-h-8 w-[4.4rem] !py-1 text-[0.67rem]"
          >
            {playback.speeds.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
          {canLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="btn btn-outline !min-h-8 !px-2.5 !text-[0.68rem]"
            >
              {loadingMore ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <ChevronLeft size={13} />
              )}
              Load more
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line/55 pt-1.5 text-[0.58rem] text-faint">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              status.tone === "teal" && "bg-teal",
              status.tone === "aqua" && "bg-aqua",
              status.tone === "amber" && "bg-amber",
              status.tone === "rose" && "bg-rose",
              status.tone === "faint" && "bg-faint",
            )}
            aria-hidden="true"
          />
          {status.text}
        </span>
        <span className="font-mono">
          {loadedTotal} loaded
          {filteredTotal !== loadedTotal ? ` · ${filteredTotal} visible` : ""}
          {!historyComplete ? " · partial branch history" : ""}
        </span>
      </div>
    </div>
  );
}
