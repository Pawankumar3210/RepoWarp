import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  GitCompareArrows,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import type { CommitRecord, RepositoryInfo } from "../../types/domain";
import { useRepositoryStore } from "../../store/repositoryStore";
import { useToastStore } from "../../store/toastStore";
import { formatDate, formatNumber, shortSha, truncate } from "../../utils/format";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { CHANGE_COLOR, CHANGE_DOT, CHANGE_LABEL } from "./changeStyles";
import { cn } from "../../utils/cn";

interface ComparisonDialogProps {
  open: boolean;
  onClose: () => void;
  commits: CommitRecord[];
  selectedSha: string | null;
  repository: RepositoryInfo | null;
  onCompare: (base: string, target: string) => Promise<void>;
  onClear: () => void;
}

function revisionLabel(commit: CommitRecord): string {
  return `${shortSha(commit.sha, 8)} · ${formatDate(commit.committedAt)} · ${truncate(commit.subject, 62)}`;
}

export function ComparisonDialog({
  open,
  onClose,
  commits,
  selectedSha,
  repository,
  onCompare,
  onClear,
}: ComparisonDialogProps) {
  const comparison = useRepositoryStore((state) => state.comparison);
  const pushToast = useToastStore((state) => state.push);
  const [base, setBase] = useState("");
  const [target, setTarget] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const wasOpen = useRef(false);
  const sorted = commits
    .slice()
    .sort(
      (a, b) =>
        new Date(b.committedAt ?? b.authoredAt ?? 0).getTime() -
        new Date(a.committedAt ?? a.authoredAt ?? 0).getTime(),
    );

  useEffect(() => {
    if (open && !wasOpen.current) {
      const selected = selectedSha
        ? sorted.find((commit) => commit.sha === selectedSha)
        : undefined;
      const nextTarget = selected?.sha ?? sorted[0]?.sha ?? "";
      const currentResult = useRepositoryStore.getState().comparison.result;
      const currentBase = useRepositoryStore.getState().comparison.base;
      const parent = selected?.parents[0];
      setTarget(nextTarget);
      setBase(
        currentBase && currentResult?.target === nextTarget
          ? currentBase
          : parent ?? sorted.find((commit) => commit.sha !== nextTarget)?.sha ?? "",
      );
      setLocalError(null);
    }
    wasOpen.current = open;
  }, [open, selectedSha, sorted]);

  const targetCommit = sorted.find((commit) => commit.sha === target);
  const resultMatches =
    comparison.result?.base === base && comparison.result?.target === target;
  const result = resultMatches ? comparison.result : null;
  const error = comparison.status === "error" ? comparison.error : null;
  const isLoading = comparison.status === "loading";

  const run = async () => {
    if (!base || !target) {
      setLocalError("Choose both a base and a target revision.");
      return;
    }
    setLocalError(null);
    try {
      await onCompare(base, target);
    } catch (compareError) {
      pushToast({
        tone: "error",
        title: "Comparison failed",
        message:
          compareError instanceof Error
            ? compareError.message
            : "GitHub could not compare these revisions.",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Compare two moments"
      description="GitHub compares base…target. “Ahead” counts commits reachable from the target but not the base."
      size="lg"
      footer={
        <>
          {comparison.result || comparison.status === "error" ? (
            <Button
              variant="ghost"
              onClick={() => {
                onClear();
                setLocalError(null);
              }}
              icon={<RotateCcw size={14} />}
            >
              Clear result
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => void run()}
            loading={isLoading}
            disabled={!base || !target}
            icon={<GitCompareArrows size={15} />}
          >
            Compare revisions
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
        <div>
          <label htmlFor="compare-base" className="panel-kicker mb-1.5 block">
            Base · older reference
          </label>
          <select
            id="compare-base"
            value={base}
            onChange={(event) => {
              setBase(event.target.value);
              setLocalError(null);
            }}
            className="field field-select !min-h-11 text-[0.7rem]"
          >
            <option value="">Choose a revision</option>
            {sorted.map((commit) => (
              <option key={`base-${commit.sha}`} value={commit.sha}>
                {revisionLabel(commit)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="icon-btn mx-auto lg:mb-1"
          onClick={() => {
            setBase(target);
            setTarget(base);
            setLocalError(null);
          }}
          aria-label="Swap base and target"
          title="Swap base and target"
        >
          <ArrowLeftRight size={16} />
        </button>
        <div>
          <label htmlFor="compare-target" className="panel-kicker mb-1.5 block">
            Target · newer reference
          </label>
          <select
            id="compare-target"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setLocalError(null);
            }}
            className="field field-select !min-h-11 text-[0.7rem]"
          >
            <option value="">Choose a revision</option>
            {sorted.map((commit) => (
              <option key={`target-${commit.sha}`} value={commit.sha}>
                {revisionLabel(commit)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {targetCommit?.parents[0] ? (
        <button
          type="button"
          onClick={() => {
            setBase(targetCommit.parents[0] ?? "");
            setLocalError(null);
          }}
          className="mt-2 text-[0.64rem] font-medium text-muted transition hover:text-ink"
        >
          Use target&apos;s first parent ({shortSha(targetCommit.parents[0], 7)}) as base
        </button>
      ) : null}

      {localError ? (
        <p className="mt-3 text-[0.7rem] text-rose">{localError}</p>
      ) : null}

      {isLoading ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-aqua/20 bg-aqua/[0.05] px-3 py-2.5 text-[0.7rem] text-aqua">
          <LoaderCircle size={14} className="animate-spin" />
          Comparing revisions on GitHub…
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-rose/25 bg-rose/[0.06] px-3.5 py-3">
          <p className="text-[0.74rem] font-semibold text-rose">{error.title}</p>
          <p className="mt-1 text-[0.68rem] leading-relaxed text-muted">{error.message}</p>
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["Status", result.status],
              ["Ahead", formatNumber(result.aheadBy)],
              ["Behind", formatNumber(result.behindBy)],
              ["Commits", formatNumber(result.totalCommits)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line/70 bg-base/25 px-3 py-2.5">
                <p className="panel-kicker">{label}</p>
                <p className="mt-1 font-mono text-[0.78rem] font-semibold capitalize text-ink">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[0.62rem] text-faint">
              {shortSha(result.base, 8)} → {shortSha(result.target, 8)}
            </p>
            {result.htmlUrl ? (
              <a
                href={result.htmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-aqua hover:underline"
              >
                Open comparison on GitHub <ArrowUpRight size={12} />
              </a>
            ) : null}
          </div>

          {result.commitsIncomplete ? (
            <p className="rounded-lg border border-amber/20 bg-amber/[0.05] px-3 py-2 text-[0.65rem] leading-relaxed text-amber/85">
              GitHub capped the commit list. Counts remain authoritative, but not every
              commit is listed here.
            </p>
          ) : null}

          {result.files.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="panel-kicker">Files affected</p>
                <span className="font-mono text-[0.6rem] text-faint">
                  {result.files.length}
                  {result.filesMayBeIncomplete ? "+" : ""}
                </span>
              </div>
              <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
                {result.files.slice(0, 80).map((file) => (
                  <div
                    key={`${file.status}-${file.path}`}
                    className="flex items-center gap-2 rounded-lg border border-line/55 bg-base/20 px-2.5 py-1.5"
                  >
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CHANGE_DOT[file.status])} />
                    <span className={cn("w-12 shrink-0 text-[0.58rem]", CHANGE_COLOR[file.status])}>
                      {CHANGE_LABEL[file.status]}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[0.6rem] text-muted">
                      {file.path}
                    </span>
                    <span className="font-mono text-[0.55rem] text-faint">
                      +{file.additions} −{file.deletions}
                    </span>
                  </div>
                ))}
              </div>
              {result.filesMayBeIncomplete ? (
                <p className="mt-1.5 text-[0.62rem] text-amber/80">
                  GitHub may truncate large file lists at 300 entries.
                </p>
              ) : null}
            </div>
          ) : null}

          {result.commits.length > 0 ? (
            <div>
              <p className="panel-kicker mb-2">Commits in the comparison</p>
              <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto pr-1">
                {result.commits.slice(0, 40).map((commit) => (
                  <div
                    key={commit.sha}
                    className="flex items-center gap-2 rounded-lg border border-line/50 bg-base/15 px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[0.57rem] text-aqua">
                      {shortSha(commit.sha, 7)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.65rem] text-muted">
                      {commit.subject}
                    </span>
                    <span className="text-[0.55rem] text-faint">
                      {formatDate(commit.committedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-[0.6rem] leading-relaxed text-faint">
            {repository?.source === "demo"
              ? "This comparison is computed from the curated demo fixture."
              : "Comparison data comes directly from GitHub's compare endpoint. The demo and exports never fabricate revisions."}
          </p>
        </div>
      ) : !isLoading && !error ? (
        <p className="mt-5 text-[0.68rem] leading-relaxed text-faint">
          Choose any two loaded revisions. RepoWarp will request the comparison from
          GitHub and keep the result until you clear it or open another repository.
        </p>
      ) : null}
    </Dialog>
  );
}
