import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { FileChangeStatus } from "../../types/domain";
import { ArrowUpRight, Boxes, Orbit } from "lucide-react";
import { HistoryScene } from "../../three/history/HistoryScene";
import { CodebaseScene } from "../../three/codebase/CodebaseScene";
import {
  DEMO_FEATURED_SHA,
  demoCommits,
  getDemoSnapshot,
} from "../../fixtures/demo/atlas";
import { layoutGraph } from "../../features/history/graphLayout";
import { layoutCodebase } from "../../features/snapshots/codebaseLayout";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { demoHref } from "../../utils/urlState";
import { formatDate, shortSha, truncate } from "../../utils/format";
import { cn } from "../../utils/cn";

export function HeroPreview({ className }: { className?: string }) {
  const [mode, setMode] = useState<"history" | "codebase">("history");
  const theme = usePreferencesStore((state) => state.theme);
  const reduced = useReduceMotion();

  const layout = useMemo(() => layoutGraph(demoCommits), []);
  const snapshot = useMemo(() => getDemoSnapshot(DEMO_FEATURED_SHA), []);
  const changeMap = useMemo(() => {
    const map = new Map<string, FileChangeStatus>();
    for (const file of snapshot?.changeFiles ?? []) map.set(file.path, file.status);
    return map;
  }, [snapshot]);
  const codebaseLayout = useMemo(
    () => (snapshot ? layoutCodebase(snapshot.entries, changeMap) : null),
    [snapshot, changeMap],
  );
  const selectedFile = useMemo(() => {
    if (!snapshot) return null;
    return (
      snapshot.entries.find(
        (entry) =>
          entry.type === "blob" &&
          (entry.path.endsWith("HistoryCanvas.tsx") || entry.path.endsWith(".tsx")),
      ) ??
      snapshot.entries.find((entry) => entry.type === "blob") ??
      null
    );
  }, [snapshot]);

  const featured = demoCommits.find((commit) => commit.sha === DEMO_FEATURED_SHA);

  return (
    <div
      className={cn(
        "stage-shell noise relative h-[24rem] overflow-hidden sm:h-[31rem] lg:h-[37rem]",
        className,
      )}
    >
      <div className="absolute inset-0">
        {mode === "history" ? (
          <HistoryScene
            layout={layout}
            selectedSha={DEMO_FEATURED_SHA}
            theme={theme}
            showGrid={false}
            neutralPreview
            reduceMotion={reduced}
            interactive={false}
            autoRotate
            preview
          />
        ) : codebaseLayout ? (
          <CodebaseScene
            layout={codebaseLayout}
            selectedPath={selectedFile?.path ?? null}
            theme={theme}
            showGrid={false}
            neutralPreview
            reduceMotion={reduced}
            interactive={false}
            autoRotate
            preview
          />
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="glass-soft pointer-events-auto flex items-center gap-2 rounded-lg px-2.5 py-1.5">
            <span className="status-dot animate-pulse-soft" aria-hidden="true" />
            <span className="font-mono text-[0.56rem] uppercase tracking-[0.18em] text-muted">
              Live 3D preview
            </span>
          </div>
          <div className="segmented pointer-events-auto !bg-panel/70 backdrop-blur-xl">
            <button
              type="button"
              data-active={mode === "history"}
              onClick={() => setMode("history")}
              aria-pressed={mode === "history"}
            >
              <Orbit size={13} />
              History
            </button>
            <button
              type="button"
              data-active={mode === "codebase"}
              onClick={() => setMode("codebase")}
              aria-pressed={mode === "codebase"}
            >
              <Boxes size={13} />
              Codebase
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="glass-soft max-w-[19rem] rounded-xl px-3 py-2.5">
            <p className="panel-kicker">
              {mode === "history" ? "Featured revision" : "Selected file"}
            </p>
            {mode === "history" && featured ? (
              <>
                <p className="mt-1 line-clamp-2-safe text-[0.78rem] font-semibold leading-snug text-ink">
                  {truncate(featured.subject, 72)}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.56rem] text-faint">
                  <span className="text-aqua">{shortSha(featured.sha, 7)}</span>
                  <span>{featured.authorName}</span>
                  <span>{formatDate(featured.committedAt)}</span>
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 truncate font-mono text-[0.68rem] font-medium text-ink">
                  {selectedFile?.path ?? "Repository root"}
                </p>
                <p className="mt-1.5 font-mono text-[0.56rem] text-faint">
                  {codebaseLayout?.totalFiles ?? 0} files · {codebaseLayout?.totalDirectories ?? 0}{" "}
                  directories
                </p>
              </>
            )}
          </div>
          <Link
            to={demoHref(mode, mode === "history" ? DEMO_FEATURED_SHA : undefined)}
            className="glass-soft pointer-events-auto hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[0.7rem] font-semibold text-ink transition hover:border-aqua/40 sm:flex"
          >
            Explore demo
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

    </div>
  );
}
