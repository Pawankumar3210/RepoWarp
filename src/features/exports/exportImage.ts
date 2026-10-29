import type { CommitRecord, RepositoryInfo, Theme, ViewMode } from "../../types/domain";
import type { GraphLayout } from "../history/graphLayout";
import type { CodebaseLayout } from "../snapshots/codebaseLayout";
import { SCENE_THEMES } from "../../styles/themeTokens";
import { shortSha } from "../../utils/format";

export interface PngExportOptions {
  sourceCanvas: HTMLCanvasElement | null;
  mode: ViewMode;
  theme: Theme;
  repository: RepositoryInfo;
  selectedCommit: CommitRecord | null;
  commitCount: number;
  historyLayout: GraphLayout | null;
  codebaseLayout: CodebaseLayout | null;
  historyComplete: boolean;
}

export interface PngExportResult {
  blob: Blob;
  usedFallback: boolean;
}

const WIDTH = 1600;
const HEIGHT = 900;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  theme: Theme,
): void {
  const colors = SCENE_THEMES[theme];
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.strokeStyle = colors.node;
  ctx.lineWidth = size * 0.075;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.34, -Math.PI * 0.85, Math.PI * 0.35);
  ctx.stroke();
  ctx.strokeStyle = colors.merge;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.22, Math.PI * 0.15, Math.PI * 1.15);
  ctx.stroke();
  ctx.fillStyle = colors.node;
  ctx.beginPath();
  ctx.arc(size * 0.34, -size * 0.08, size * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.tag;
  ctx.beginPath();
  ctx.arc(-size * 0.28, size * 0.14, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${text.slice(0, low)}…`;
}

function drawHistoryFallback(
  ctx: CanvasRenderingContext2D,
  layout: GraphLayout,
  box: { x: number; y: number; width: number; height: number },
  theme: Theme,
): void {
  const colors = SCENE_THEMES[theme];
  const nodes = layout.commitNodes;
  if (nodes.length === 0) return;
  const pad = 50;
  const graphWidth = Math.max(1, layout.bounds.maxX - layout.bounds.minX);
  const graphHeight = Math.max(1, layout.bounds.maxY - layout.bounds.minY);
  const scale = Math.min(
    (box.width - pad * 2) / graphWidth,
    (box.height - pad * 2) / graphHeight,
  );
  const offsetX =
    box.x + box.width / 2 - ((layout.bounds.minX + layout.bounds.maxX) / 2) * scale;
  const offsetY =
    box.y + box.height / 2 + ((layout.bounds.minY + layout.bounds.maxY) / 2) * scale;
  const position = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: offsetX + node.x * scale,
        y: offsetY - node.y * scale,
      },
    ]),
  );

  ctx.save();
  for (const edge of layout.edges) {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    if (!from || !to) continue;
    const laneColor = colors.lanePalette[edge.lane % colors.lanePalette.length] ?? colors.edge;
    ctx.strokeStyle =
      edge.type === "merge"
        ? hexToRgba(colors.mergeEdge, 0.7)
        : edge.type === "boundary"
          ? hexToRgba(colors.boundary, 0.5)
          : hexToRgba(laneColor, 0.55);
    ctx.lineWidth = edge.type === "merge" ? 2.3 : 1.4;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo((from.x + to.x) / 2, from.y, to.x, to.y);
    ctx.stroke();
  }
  for (const node of nodes) {
    const point = position.get(node.id);
    if (!point) continue;
    const laneColor = colors.lanePalette[node.lane % colors.lanePalette.length] ?? colors.node;
    ctx.fillStyle = node.isMerge ? colors.merge : laneColor;
    ctx.beginPath();
    ctx.arc(point.x, point.y, node.isMerge ? 5.4 : 3.8, 0, Math.PI * 2);
    ctx.fill();
    if (node.tags.length > 0) {
      ctx.strokeStyle = colors.tag;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCodebaseFallback(
  ctx: CanvasRenderingContext2D,
  layout: CodebaseLayout,
  box: { x: number; y: number; width: number; height: number },
  theme: Theme,
): void {
  const colors = SCENE_THEMES[theme];
  if (layout.clusters.length === 0) return;
  const pad = 44;
  const width = Math.max(1, layout.bounds.maxX - layout.bounds.minX);
  const depth = Math.max(1, layout.bounds.maxZ - layout.bounds.minZ);
  const scale = Math.min((box.width - pad * 2) / width, (box.height - pad * 2) / depth);
  const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2;
  const centerZ = (layout.bounds.minZ + layout.bounds.maxZ) / 2;
  const project = (x: number, z: number) => ({
    x: box.x + box.width / 2 + (x - centerX) * scale,
    y: box.y + box.height / 2 + (z - centerZ) * scale,
  });

  ctx.save();
  for (const cluster of layout.clusters) {
    const center = project(cluster.x, cluster.z);
    const w = Math.max(18, cluster.width * scale);
    const h = Math.max(18, cluster.depth * scale);
    ctx.fillStyle = hexToRgba(colors.platform, 0.5);
    ctx.strokeStyle = hexToRgba(colors.platformEdge, 0.7);
    ctx.lineWidth = 1;
    roundedRect(ctx, center.x - w / 2, center.y - h / 2, w, h, 8);
    ctx.fill();
    ctx.stroke();
    for (const file of cluster.files) {
      const point = project(file.x, file.z);
      ctx.fillStyle =
        colors.fileCategories[file.category] ?? colors.node;
      const barWidth = Math.max(2, file.width * scale);
      const barHeight = Math.max(2, file.height * scale * 2.2);
      roundedRect(
        ctx,
        point.x - barWidth / 2,
        point.y - barHeight,
        barWidth,
        barHeight,
        1.5,
      );
      ctx.fill();
    }
    if (cluster.isRoot || cluster.level <= 1) {
      ctx.fillStyle = colors.muted;
      ctx.font = '500 15px "Manrope Variable", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(
        fitText(ctx, cluster.name, Math.max(70, w)),
        center.x,
        center.y + h / 2 + 20,
      );
    }
  }
  ctx.restore();
}

async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.ready;
  } catch {
    // Export can proceed with fallback typography.
  }
}

export async function createVisualizationPng(
  options: PngExportOptions,
): Promise<PngExportResult> {
  await waitForFonts();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PNG export is unavailable in this browser.");

  const colors = SCENE_THEMES[options.theme];
  const isDark = options.theme === "dark";
  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, colors.backgroundDeep);
  background.addColorStop(0.55, colors.background);
  background.addColorStop(1, isDark ? "#07131b" : "#dfe9e3");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = isDark ? 0.42 : 0.28;
  ctx.strokeStyle = colors.gridMinor;
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  drawLogo(ctx, 48, 36, 54, options.theme);
  ctx.textAlign = "left";
  ctx.fillStyle = colors.text;
  ctx.font = '700 29px "Space Grotesk Variable", sans-serif';
  ctx.fillText("RepoWarp", 118, 66);
  ctx.fillStyle = colors.muted;
  ctx.font = '500 15px "Manrope Variable", sans-serif';
  ctx.fillText(
    `${options.mode === "history" ? "History Warp" : "Codebase Warp"} · visualization export`,
    118,
    90,
  );

  const modeLabel = options.mode === "history" ? "HISTORY WARP" : "CODEBASE WARP";
  ctx.font = '600 14px "Manrope Variable", sans-serif';
  const modeWidth = ctx.measureText(modeLabel).width + 34;
  ctx.fillStyle = hexToRgba(colors.node, isDark ? 0.15 : 0.12);
  ctx.strokeStyle = hexToRgba(colors.node, 0.45);
  ctx.lineWidth = 1;
  roundedRect(ctx, WIDTH - 48 - modeWidth, 44, modeWidth, 38, 19);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.node;
  ctx.textAlign = "center";
  ctx.fillText(modeLabel, WIDTH - 48 - modeWidth / 2, 68);

  const frame = { x: 48, y: 126, width: WIDTH - 96, height: 566 };
  ctx.save();
  roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, 24);
  ctx.clip();
  ctx.fillStyle = colors.backgroundDeep;
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);

  let usedFallback = true;
  const source = options.sourceCanvas;
  if (source && source.width > 8 && source.height > 8) {
    try {
      const sourceRatio = source.width / source.height;
      const frameRatio = frame.width / frame.height;
      let drawWidth = frame.width;
      let drawHeight = frame.height;
      if (sourceRatio > frameRatio) {
        drawHeight = frame.height;
        drawWidth = drawHeight * sourceRatio;
      } else {
        drawWidth = frame.width;
        drawHeight = drawWidth / sourceRatio;
      }
      ctx.drawImage(
        source,
        frame.x + (frame.width - drawWidth) / 2,
        frame.y + (frame.height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      usedFallback = false;
      ctx.fillStyle = options.theme === "dark" ? "rgba(3, 8, 14, 0.56)" : "rgba(230, 236, 232, 0.72)";
      ctx.fillRect(frame.x, frame.y, frame.width, 108);
    } catch {
      usedFallback = true;
    }
  }

  if (usedFallback) {
    const fallbackGradient = ctx.createRadialGradient(
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
      80,
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
      frame.width * 0.7,
    );
    fallbackGradient.addColorStop(0, hexToRgba(colors.node, isDark ? 0.11 : 0.09));
    fallbackGradient.addColorStop(1, "transparent");
    ctx.fillStyle = fallbackGradient;
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    if (options.mode === "history" && options.historyLayout) {
      drawHistoryFallback(ctx, options.historyLayout, frame, options.theme);
    } else if (options.mode === "codebase" && options.codebaseLayout) {
      drawCodebaseFallback(ctx, options.codebaseLayout, frame, options.theme);
    }
  }

  ctx.fillStyle = options.theme === "dark" ? "rgba(4, 9, 16, 0.62)" : "rgba(234, 240, 236, 0.78)";
  ctx.fillRect(frame.x, frame.y, frame.width, usedFallback ? 70 : 108);
  ctx.textAlign = "left";
  ctx.fillStyle = colors.text;
  ctx.font = '600 22px "Space Grotesk Variable", sans-serif';
  ctx.fillText(
    fitText(
      ctx,
      `${options.repository.identity.owner} / ${options.repository.identity.name}`,
      frame.width - 300,
    ),
    frame.x + 28,
    frame.y + 38,
  );
  ctx.fillStyle = colors.muted;
  ctx.font = '500 14px "JetBrains Mono Variable", monospace';
  ctx.fillText(
    `${options.selectedCommit ? shortSha(options.selectedCommit.sha, 10) : "No commit selected"} · ${options.commitCount} loaded commits`,
    frame.x + 28,
    frame.y + 64,
  );

  const sourceLabel = usedFallback
    ? "STATIC FALLBACK · generated from loaded data"
    : "LIVE WEBGL SCENE";
  ctx.textAlign = "right";
  ctx.fillStyle = usedFallback ? colors.tag : colors.node;
  ctx.font = '600 13px "Manrope Variable", sans-serif';
  ctx.fillText(sourceLabel, frame.x + frame.width - 28, frame.y + 38);

  if (options.selectedCommit) {
    ctx.fillStyle = colors.text;
    ctx.font = '500 16px "Manrope Variable", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(
      fitText(ctx, options.selectedCommit.subject, frame.width - 56),
      frame.x + 28,
      frame.y + 92,
    );
  }
  ctx.restore();

  ctx.strokeStyle = hexToRgba(colors.platformEdge, 0.7);
  ctx.lineWidth = 1.5;
  roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, 24);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = colors.text;
  ctx.font = '600 17px "Manrope Variable", sans-serif';
  const commitInfo = options.selectedCommit
    ? `${shortSha(options.selectedCommit.sha, 12)} · ${options.selectedCommit.authorName ?? "Unknown author"}`
    : "No revision selected";
  ctx.fillText(commitInfo, 48, 736);
  ctx.fillStyle = colors.muted;
  ctx.font = '500 14px "Manrope Variable", sans-serif';
  const date = options.selectedCommit?.committedAt
    ? new Date(options.selectedCommit.committedAt).toLocaleString("en", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Selected date unavailable";
  ctx.fillText(date, 48, 760);

  const legends =
    options.mode === "history"
      ? [
          { color: colors.node, label: "Commit" },
          { color: colors.merge, label: "Merge" },
          { color: colors.tag, label: "Tag" },
          { color: colors.boundary, label: "Unloaded parent" },
        ]
      : [
          { color: colors.fileCategories.code, label: "Source" },
          { color: colors.fileCategories.docs, label: "Docs" },
          { color: colors.fileCategories.data, label: "Data" },
          { color: colors.fileCategories.config, label: "Config" },
        ];

  let legendX = 620;
  for (const legend of legends) {
    ctx.fillStyle = legend.color;
    ctx.beginPath();
    ctx.arc(legendX, 732, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.muted;
    ctx.font = '500 13px "Manrope Variable", sans-serif';
    ctx.fillText(legend.label, legendX + 13, 737);
    legendX += ctx.measureText(legend.label).width + 48;
  }

  ctx.textAlign = "right";
  ctx.fillStyle = colors.muted;
  ctx.font = '500 13px "Manrope Variable", sans-serif';
  ctx.fillText(
    options.repository.source === "demo"
      ? "Curated demo fixture · not live GitHub data"
      : "Public data from the GitHub REST API",
    WIDTH - 48,
    736,
  );
  ctx.fillText(
    `${options.historyComplete ? "Loaded reference followed to its end" : "Partial history · loaded data only"} · ${new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}`,
    WIDTH - 48,
    760,
  );

  ctx.strokeStyle = hexToRgba(colors.platformEdge, 0.5);
  ctx.beginPath();
  ctx.moveTo(48, 790);
  ctx.lineTo(WIDTH - 48, 790);
  ctx.stroke();

  const loadedStart = 48;
  const loadedEnd = WIDTH - 48;
  const progress = Math.min(1, options.commitCount / 60);
  ctx.strokeStyle = hexToRgba(colors.node, 0.24);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(loadedStart, 826);
  ctx.lineTo(loadedEnd, 826);
  ctx.stroke();
  ctx.strokeStyle = colors.node;
  ctx.beginPath();
  ctx.moveTo(loadedStart, 826);
  ctx.lineTo(loadedStart + (loadedEnd - loadedStart) * progress, 826);
  ctx.stroke();
  ctx.fillStyle = colors.muted;
  ctx.textAlign = "left";
  ctx.font = '500 12px "Manrope Variable", sans-serif';
  ctx.fillText("RepoWarp · Travel Through the Evolution of Code", 48, 858);
  ctx.textAlign = "right";
  ctx.fillText(
    "No credentials or source-code contents included",
    WIDTH - 48,
    858,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("The exported image could not be encoded."));
    }, "image/png");
  });

  return { blob, usedFallback };
}
