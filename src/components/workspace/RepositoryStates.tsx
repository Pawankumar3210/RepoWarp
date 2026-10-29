import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  GitBranch,
  GitCompareArrows,
  LoaderCircle,
  RotateCcw,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import type { AppError, LoadStage, StageState } from "../../types/domain";
import { formatDateTime } from "../../utils/format";
import { Button, LinkButton } from "../ui/Button";
import { RepoWarpLogo } from "../brand/RepoWarpLogo";
import { cn } from "../../utils/cn";

const STAGE_ORDER: LoadStage[] = [
  "validating",
  "repository",
  "branches",
  "history",
  "graph",
  "ready",
];

export function RepositoryLoading({
  owner,
  repo,
  demo,
  stages,
}: {
  owner: string;
  repo: string;
  demo: boolean;
  stages: StageState[];
}) {
  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  const activeIndex = STAGE_ORDER.findIndex(
    (id) => byId.get(id)?.status === "active",
  );
  const progress =
    activeIndex === -1
      ? 8
      : Math.max(8, ((activeIndex + 0.35) / STAGE_ORDER.length) * 100);

  return (
    <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:px-7 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <LoaderCircle size={12} className="animate-spin" />
            {demo ? "Opening curated demo" : "Warping repository"}
          </p>
          <h1 className="mt-3 break-words font-display text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
            {owner}
            <span className="text-faint">/</span>
            {repo}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            {demo
              ? "No network requests. RepoWarp is assembling the curated graph and historical trees."
              : "Fetching public metadata, references, and the first page of commit history from GitHub. No account or token is used."}
          </p>

          <div className="mt-6 h-1 overflow-hidden rounded-full bg-line/70">
            <span
              className="progress-flow block h-full rounded-full bg-gradient-to-r from-aqua via-teal to-violet transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ol className="mt-5 space-y-1.5" aria-live="polite">
            {STAGE_ORDER.map((id, index) => {
              const stage = byId.get(id);
              const status = stage?.status ?? (index === 0 ? "active" : "pending");
              return (
                <li
                  key={id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-[0.68rem] transition",
                    status === "active"
                      ? "border-aqua/25 bg-aqua/[0.05] text-ink"
                      : "border-transparent text-faint",
                  )}
                >
                  {status === "complete" ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal/15 text-teal">
                      <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                        <path
                          d="M2.5 6.3l2.1 2.1 4.9-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : status === "active" ? (
                    <LoaderCircle size={14} className="animate-spin text-aqua" />
                  ) : status === "error" ? (
                    <AlertTriangle size={14} className="text-rose" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-line" />
                    </span>
                  )}
                  <span className={status === "active" ? "font-semibold" : ""}>
                    {stage?.label ?? id}
                  </span>
                  <span className="ml-auto font-mono text-[0.52rem] uppercase tracking-wider text-faint/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="stage-shell scene-stage relative min-h-[23rem] overflow-hidden rounded-2xl border border-line/80 p-5">
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute left-[18%] top-[24%] h-2 w-2 rounded-full bg-aqua shadow-[0_0_18px_rgb(var(--c-aqua)/0.8)]" />
            <div className="absolute left-[55%] top-[18%] h-1.5 w-1.5 rounded-full bg-violet shadow-[0_0_16px_rgb(var(--c-violet)/0.7)]" />
            <div className="absolute left-[72%] top-[56%] h-2.5 w-2.5 rounded-full bg-teal shadow-[0_0_20px_rgb(var(--c-teal)/0.7)]" />
            <div className="absolute left-[35%] top-[68%] h-1.5 w-1.5 rounded-full bg-amber shadow-[0_0_16px_rgb(var(--c-amber)/0.7)]" />
            <svg
              viewBox="0 0 400 300"
              className="absolute inset-0 h-full w-full text-aqua/20"
              fill="none"
              aria-hidden="true"
            >
              <path d="M80 70 C150 70 140 140 215 140 S290 100 330 155" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
              <path d="M80 70 C130 120 160 190 145 225" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 7" />
              <path d="M215 140 C260 175 275 210 300 235" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 7" />
            </svg>
          </div>
          <div className="relative flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
            <span className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-aqua/20 bg-panel/70 shadow-glow">
              <span className="absolute inset-[-0.7rem] animate-pulse-soft rounded-[2rem] border border-aqua/10" />
              <span className="loading-ring" aria-hidden="true" />
              <RepoWarpLogo size={42} compact />
            </span>
            <p className="mt-6 font-display text-sm font-semibold text-ink">
              {demo ? "Curated history" : "Anonymous public API"}
            </p>
            <p className="mt-1.5 max-w-[15rem] text-[0.68rem] leading-relaxed text-faint">
              {demo
                ? "26 commits, branches, tags, merges, snapshots, and comparisons."
                : "History arrives newest-first. Deeper pages load only when requested."}
            </p>
            <div className="mt-6 grid w-full max-w-[15rem] gap-2">
              <div className="skeleton h-8 rounded-lg" />
              <div className="skeleton h-8 rounded-lg opacity-75" />
              <div className="skeleton h-8 rounded-lg opacity-50" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function RepositoryErrorState({
  error,
  owner,
  repo,
  onRetry,
}: {
  error: AppError;
  owner: string;
  repo: string;
  onRetry: () => void;
}) {
  const isRateLimit = error.kind === "rate_limit" || error.kind === "forbidden";
  return (
    <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-7">
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl border",
          isRateLimit
            ? "border-amber/30 bg-amber/10 text-amber"
            : "border-rose/30 bg-rose/10 text-rose",
        )}
      >
        {isRateLimit ? <Clock3 size={23} /> : <SearchX size={23} />}
      </span>
      <p className="eyebrow mt-5">{isRateLimit ? "Request paused" : "Repository unavailable"}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-ink sm:text-3xl">
        {error.title}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{error.message}</p>

      <div className="mt-6 w-full max-w-xl rounded-xl border border-line/75 bg-panel/45 p-4 text-left">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-faint" />
          <p className="font-mono text-[0.67rem] text-ink">
            {owner}/{repo}
          </p>
          {error.status ? (
            <span className="ml-auto chip !h-5 font-mono !text-[0.55rem]">HTTP {error.status}</span>
          ) : null}
        </div>
        {error.retryAt ? (
          <p className="mt-2 flex items-start gap-1.5 text-[0.67rem] leading-relaxed text-amber/90">
            <Clock3 size={12} className="mt-0.5 shrink-0" />
            Anonymous requests can resume after {formatDateTime(new Date(error.retryAt).toISOString())}.
          </p>
        ) : null}
        {error.requestPath ? (
          <p className="mt-2 truncate font-mono text-[0.58rem] text-faint">{error.requestPath}</p>
        ) : null}
        {error.docsUrl ? (
          <a
            href={error.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block text-[0.64rem] font-semibold text-aqua hover:underline"
          >
            GitHub API documentation
          </a>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onClick={onRetry} icon={<RotateCcw size={14} />}>
          Try again
        </Button>
        <LinkButton
          to="/workspace"
          variant="outline"
          icon={<ArrowLeft size={14} />}
        >
          Choose another repository
        </LinkButton>
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-[0.62rem] text-faint">
        {isRateLimit ? (
          <>
            <ShieldCheck size={12} /> Demo mode remains available without GitHub requests.
          </>
        ) : (
          <>
            <GitCompareArrows size={12} /> Confirm the repository is public and the URL is exact.
          </>
        )}
      </p>
    </main>
  );
}

export function EmptyHistoryState({ filtered }: { filtered: boolean }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-base/35 p-6 backdrop-blur-[2px]">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-panel/80">
          <SearchX size={20} className="text-faint" />
        </span>
        <p className="mt-4 font-display text-base font-semibold text-ink">
          {filtered ? "No revisions match" : "No commits to show"}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {filtered
            ? "Relax or reset the filters to bring the loaded graph back."
            : "Load more history or return to another reference."}
        </p>
      </div>
    </div>
  );
}
