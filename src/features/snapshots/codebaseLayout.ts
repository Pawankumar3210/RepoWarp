import type { FileChangeStatus, SnapshotEntry } from "../../types/domain";

export const FILE_CELL = 0.64;
export const FILE_WIDTH = 0.26;
export const CLUSTER_GAP_X = 9;
export const CLUSTER_GAP_Z = 9.5;

export type FileCategory =
  | "code"
  | "style"
  | "docs"
  | "data"
  | "config"
  | "asset"
  | "test"
  | "other";

export interface CodebaseFileNode {
  path: string;
  name: string;
  clusterPath: string;
  x: number;
  y: number;
  z: number;
  height: number;
  width: number;
  depth: number;
  size: number | null;
  extension: string | null;
  category: FileCategory;
  changeStatus: FileChangeStatus | null;
}

export interface CodebaseCluster {
  path: string;
  name: string;
  parentPath: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  fileCount: number;
  descendantFileCount: number;
  childCount: number;
  level: number;
  files: CodebaseFileNode[];
  isRoot: boolean;
}

export interface CodebaseLayout {
  clusters: CodebaseCluster[];
  files: CodebaseFileNode[];
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    maxHeight: number;
  };
  totalFiles: number;
  totalDirectories: number;
}

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "cs",
  "rb",
  "php",
  "swift",
  "kt",
  "kts",
  "scala",
  "lua",
  "ex",
  "exs",
  "dart",
  "vue",
  "svelte",
]);

const STYLE_EXTENSIONS = new Set([
  "css",
  "scss",
  "sass",
  "less",
  "styl",
  "postcss",
]);

const DOC_EXTENSIONS = new Set(["md", "mdx", "txt", "rst", "adoc", "org"]);

const DATA_EXTENSIONS = new Set([
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "xml",
  "csv",
  "tsv",
  "sql",
  "graphql",
  "gql",
  "avro",
  "parquet",
]);

const CONFIG_EXTENSIONS = new Set([
  "lock",
  "ini",
  "conf",
  "config",
  "env",
  "properties",
  "gitignore",
  "dockerignore",
  "editorconfig",
]);

const ASSET_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "mp4",
  "webm",
  "glb",
  "gltf",
  "wasm",
]);

export function categorizeFile(path: string, extension: string | null): FileCategory {
  const lowerPath = path.toLowerCase();
  const name = lowerPath.slice(lowerPath.lastIndexOf("/") + 1);
  if (
    lowerPath.includes("/test/") ||
    lowerPath.includes("/tests/") ||
    lowerPath.includes("__tests__") ||
    /\.(test|spec)\.[a-z0-9]+$/.test(name)
  ) {
    return "test";
  }
  if (
    name.startsWith(".env") ||
    name.startsWith(".git") ||
    name.includes("lock") ||
    name === "dockerfile" ||
    name === "makefile"
  ) {
    return "config";
  }
  const ext = extension?.toLowerCase() ?? "";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  if (STYLE_EXTENSIONS.has(ext)) return "style";
  if (DOC_EXTENSIONS.has(ext)) return "docs";
  if (DATA_EXTENSIONS.has(ext)) return "data";
  if (CONFIG_EXTENSIONS.has(ext)) return "config";
  if (ASSET_EXTENSIONS.has(ext)) return "asset";
  return "other";
}

export function fileHeightForSize(size: number | null): number {
  if (size === null || size <= 0) return 0.36;
  const height = 0.32 + Math.log2(size + 1) * 0.16;
  return Math.min(2.8, Math.max(0.36, height));
}

function pathDepth(path: string): number {
  if (!path) return 0;
  return path.split("/").length;
}

function baseName(path: string): string {
  if (!path) return "root";
  return path.slice(path.lastIndexOf("/") + 1);
}

function parentOf(path: string): string {
  if (!path) return "";
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

function descendantCount(
  directory: string,
  filesByDirectory: Map<string, SnapshotEntry[]>,
): number {
  let total = filesByDirectory.get(directory)?.length ?? 0;
  const prefix = directory ? `${directory}/` : "";
  for (const other of filesByDirectory.keys()) {
    if (other === directory) continue;
    if (!directory || other.startsWith(prefix)) {
      total += filesByDirectory.get(other)?.length ?? 0;
    }
  }
  return total;
}

export function layoutCodebase(
  entries: SnapshotEntry[],
  changeStatusByPath: Map<string, FileChangeStatus> = new Map(),
): CodebaseLayout {
  const files = entries.filter((entry) => entry.type === "blob");
  const directories = new Set<string>([""]);
  for (const entry of entries) {
    if (entry.type === "tree") directories.add(entry.path);
    if (entry.type === "blob" && entry.parentPath) directories.add(entry.parentPath);
  }

  const filesByDirectory = new Map<string, SnapshotEntry[]>();
  for (const dir of directories) filesByDirectory.set(dir, []);
  for (const file of files) {
    const list = filesByDirectory.get(file.parentPath) ?? [];
    list.push(file);
    filesByDirectory.set(file.parentPath, list);
  }
  for (const list of filesByDirectory.values()) {
    list.sort((a, b) => a.path.localeCompare(b.path));
  }

  const sortedDirs = [...directories].sort((a, b) => {
    if (!a) return -1;
    if (!b) return 1;
    const depthDelta = pathDepth(a) - pathDepth(b);
    return depthDelta !== 0 ? depthDelta : a.localeCompare(b);
  });

  const levels = new Map<number, string[]>();
  for (const dir of sortedDirs) {
    const level = pathDepth(dir);
    const list = levels.get(level) ?? [];
    list.push(dir);
    levels.set(level, list);
  }

  const clusterPositions = new Map<string, { x: number; z: number }>();
  clusterPositions.set("", { x: 0, z: 0 });

  for (const [level, dirs] of [...levels.entries()].sort(([a], [b]) => a - b)) {
    if (level === 0) continue;
    const columns = Math.min(7, Math.max(1, Math.ceil(Math.sqrt(dirs.length))));
    for (let index = 0; index < dirs.length; index += 1) {
      const dir = dirs[index];
      if (!dir) continue;
      const row = Math.floor(index / columns);
      const col = index % columns;
      const countInRow = Math.min(columns, dirs.length - row * columns);
      const x = (col - (countInRow - 1) / 2) * CLUSTER_GAP_X;
      const z = 12 + level * CLUSTER_GAP_Z + row * CLUSTER_GAP_Z;
      clusterPositions.set(dir, { x, z });
    }
  }

  const clusterFiles = new Map<string, CodebaseFileNode[]>();
  const clusters: CodebaseCluster[] = [];

  for (const dir of sortedDirs) {
    const directFiles = filesByDirectory.get(dir) ?? [];
    const count = directFiles.length;
    const fileColumns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count)))));
    const fileRows = Math.max(1, Math.ceil(Math.max(1, count) / fileColumns));
    const platformWidth = Math.max(
      2.5,
      fileColumns * FILE_CELL + 1.5,
      Math.min(7.2, 2.5 + Math.sqrt(Math.max(1, count)) * 0.7),
    );
    const platformDepth = Math.max(2.5, fileRows * FILE_CELL + 1.5);
    const position = clusterPositions.get(dir) ?? { x: 0, z: 0 };
    const fileNodes: CodebaseFileNode[] = [];

    directFiles.forEach((file, index) => {
      const row = Math.floor(index / fileColumns);
      const col = index % fileColumns;
      const columnsInRow = Math.min(fileColumns, directFiles.length - row * fileColumns);
      const x = position.x + (col - (columnsInRow - 1) / 2) * FILE_CELL;
      const z = position.z + (row - (fileRows - 1) / 2) * FILE_CELL;
      const height = fileHeightForSize(file.size);
      const category = categorizeFile(file.path, file.extension);
      fileNodes.push({
        path: file.path,
        name: file.name,
        clusterPath: dir,
        x,
        y: height / 2 + 0.1,
        z,
        height,
        width: FILE_WIDTH,
        depth: FILE_WIDTH,
        size: file.size,
        extension: file.extension,
        category,
        changeStatus: changeStatusByPath.get(file.path) ?? null,
      });
    });

    clusterFiles.set(dir, fileNodes);
    clusters.push({
      path: dir,
      name: baseName(dir),
      parentPath: parentOf(dir),
      x: position.x,
      z: position.z,
      width: platformWidth,
      depth: platformDepth,
      fileCount: count,
      descendantFileCount: descendantCount(dir, filesByDirectory),
      childCount: sortedDirs.filter(
        (candidate) => candidate !== dir && parentOf(candidate) === dir,
      ).length,
      level: pathDepth(dir),
      files: fileNodes,
      isRoot: dir === "",
    });
  }

  const allFiles = [...clusterFiles.values()].flat();
  const xs = clusters.flatMap((cluster) => [
    cluster.x - cluster.width / 2,
    cluster.x + cluster.width / 2,
  ]);
  const zs = clusters.flatMap((cluster) => [
    cluster.z - cluster.depth / 2,
    cluster.z + cluster.depth / 2,
  ]);

  return {
    clusters,
    files: allFiles,
    bounds: {
      minX: xs.length ? Math.min(...xs) : 0,
      maxX: xs.length ? Math.max(...xs) : 0,
      minZ: zs.length ? Math.min(...zs) : 0,
      maxZ: zs.length ? Math.max(...zs) : 0,
      maxHeight: Math.max(1, ...allFiles.map((file) => file.height)),
    },
    totalFiles: files.length,
    totalDirectories: Math.max(0, directories.size - 1),
  };
}

export function findClusterForPath(
  layout: CodebaseLayout,
  path: string,
): CodebaseCluster | null {
  return layout.clusters.find((cluster) => cluster.path === path) ?? null;
}

export function findFileNode(
  layout: CodebaseLayout,
  path: string,
): CodebaseFileNode | null {
  return layout.files.find((file) => file.path === path) ?? null;
}

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  code: "Source",
  style: "Styles",
  docs: "Docs",
  data: "Data",
  config: "Config",
  asset: "Assets",
  test: "Tests",
  other: "Other",
};
