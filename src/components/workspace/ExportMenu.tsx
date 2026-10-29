import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  ImageDown,
  LoaderCircle,
} from "lucide-react";
import type { CommitRecord, Theme, ViewMode } from "../../types/domain";
import type { GraphLayout } from "../../features/history/graphLayout";
import type { CodebaseLayout } from "../../features/snapshots/codebaseLayout";
import { useRepositoryStore } from "../../store/repositoryStore";
import { useToastStore } from "../../store/toastStore";
import {
  buildHistoryCsvExport,
  buildHistoryJsonExport,
  historyExportFilename,
} from "../../features/exports/historyExports";
import { createVisualizationPng } from "../../features/exports/exportImage";
import { captureSceneCanvas } from "../../three/shared/sceneCapture";
import { copyText } from "../../utils/clipboard";
import { downloadBlob, downloadText } from "../../utils/download";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";

type ExportKind = "json" | "csv" | "png" | null;

interface ExportMenuProps {
  view: ViewMode;
  theme: Theme;
  selectedCommit: CommitRecord | null;
  historyLayout: GraphLayout | null;
  codebaseLayout: CodebaseLayout | null;
  historyComplete: boolean;
  shareUrl: string;
  disabled?: boolean;
}

export function ExportMenu({
  view,
  theme,
  selectedCommit,
  historyLayout,
  codebaseLayout,
  historyComplete,
  shareUrl,
  disabled,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pushToast = useToastStore((state) => state.push);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const buildExportState = () => {
    const state = useRepositoryStore.getState();
    if (!state.repository || !state.source) return null;
    return {
      repository: state.repository,
      source: state.source,
      branches: state.branches,
      tags: state.tags,
      commits: Object.values(state.commits),
      details: state.details,
      refHistory: state.refHistory,
      activeRef: state.activeRef,
      selectedCommitSha: state.selectedCommitSha,
    };
  };

  const exportJson = () => {
    const state = buildExportState();
    if (!state) return;
    setBusy("json");
    try {
      const payload = buildHistoryJsonExport(state);
      downloadText(
        JSON.stringify(payload, null, 2),
        historyExportFilename(state.repository, {
          commitCount: payload.completeness.loadedCommitCount,
          complete: payload.completeness.historyComplete,
          extension: "json",
        }),
        "application/json;charset=utf-8",
      );
      pushToast({
        tone: "success",
        title: "History JSON exported",
        message: `${payload.completeness.loadedCommitCount} loaded commits included.`,
      });
      setOpen(false);
    } catch {
      pushToast({ tone: "error", title: "JSON export failed" });
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    const state = buildExportState();
    if (!state) return;
    setBusy("csv");
    try {
      const csv = buildHistoryCsvExport(state);
      downloadText(
        csv,
        historyExportFilename(state.repository, {
          commitCount: state.commits.length,
          complete: historyComplete,
          extension: "csv",
        }),
        "text/csv;charset=utf-8",
      );
      pushToast({
        tone: "success",
        title: "History CSV exported",
        message: `${state.commits.length} loaded commits included.`,
      });
      setOpen(false);
    } catch {
      pushToast({ tone: "error", title: "CSV export failed" });
    } finally {
      setBusy(null);
    }
  };

  const exportPng = async () => {
    const state = buildExportState();
    if (!state) return;
    setBusy("png");
    try {
      const png = await createVisualizationPng({
        sourceCanvas: captureSceneCanvas(),
        mode: view,
        theme,
        repository: state.repository,
        selectedCommit,
        commitCount: state.commits.length,
        historyLayout,
        codebaseLayout,
        historyComplete,
      });
      downloadBlob(
        png.blob,
        historyExportFilename(state.repository, {
          commitCount: state.commits.length,
          complete: historyComplete,
          extension: "png",
        }),
      );
      pushToast({
        tone: "success",
        title: "Visualization PNG exported",
        message: png.usedFallback
          ? "Rendered from a composed map because the WebGL buffer was unavailable."
          : "Captured from the live 3D scene.",
      });
      setOpen(false);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "PNG export failed",
        message: error instanceof Error ? error.message : "The visualization could not be rendered.",
      });
    } finally {
      setBusy(null);
    }
  };

  const copyShare = async () => {
    const ok = await copyText(shareUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      pushToast({
        tone: "success",
        title: "Link copied",
        message: "The URL preserves view, reference, commit, and comparison state.",
      });
    } else {
      pushToast({ tone: "error", title: "Could not copy the link" });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="soft"
        size="sm"
        icon={<Download size={14} />}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export
      </Button>

      {open ? (
        <div
          className="glass absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[19.5rem] overflow-hidden rounded-xl p-1.5"
          role="menu"
          aria-label="Export current visualization"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="font-display text-[0.8rem] font-semibold text-ink">Export current state</p>
            <p className="mt-0.5 text-[0.62rem] leading-relaxed text-faint">
              Only history loaded in this session is included.
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-elevated/70"
            onClick={exportJson}
            disabled={busy !== null}
          >
            {busy === "json" ? (
              <LoaderCircle size={15} className="mt-0.5 animate-spin text-aqua" />
            ) : (
              <FileJson size={15} className="mt-0.5 text-aqua" />
            )}
            <span>
              <span className="block text-[0.72rem] font-semibold text-ink">JSON history</span>
              <span className="block text-[0.6rem] text-faint">Structured commits and completeness</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-elevated/70"
            onClick={exportCsv}
            disabled={busy !== null}
          >
            {busy === "csv" ? (
              <LoaderCircle size={15} className="mt-0.5 animate-spin text-aqua" />
            ) : (
              <FileSpreadsheet size={15} className="mt-0.5 text-teal" />
            )}
            <span>
              <span className="block text-[0.72rem] font-semibold text-ink">CSV history</span>
              <span className="block text-[0.6rem] text-faint">Spreadsheet-friendly commit rows</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-elevated/70"
            onClick={() => void exportPng()}
            disabled={busy !== null}
          >
            {busy === "png" ? (
              <LoaderCircle size={15} className="mt-0.5 animate-spin text-aqua" />
            ) : (
              <ImageDown size={15} className="mt-0.5 text-violet" />
            )}
            <span>
              <span className="block text-[0.72rem] font-semibold text-ink">Visualization PNG</span>
              <span className="block text-[0.6rem] text-faint">1600×900 scene capture</span>
            </span>
          </button>
          <div className="mx-1 my-1 h-px bg-line/70" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-elevated/70"
            onClick={() => void copyShare()}
          >
            {copied ? (
              <Check size={15} className="text-teal" />
            ) : (
              <Copy size={15} className="text-muted" />
            )}
            <span className="text-[0.72rem] font-semibold text-ink">
              {copied ? "Link copied" : "Copy share link"}
            </span>
          </button>
          <p
            className={cn(
              "border-t border-line/60 px-2.5 pb-1 pt-2 text-[0.58rem] leading-relaxed text-faint",
            )}
          >
            {historyComplete
              ? "The active reference is fully loaded. Other branches may be partial."
              : "This export is explicitly marked partial because the active branch has more history."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
