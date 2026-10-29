import { describe, expect, it } from "vitest";
import type { SnapshotEntry } from "../../types/domain";
import {
  categorizeFile,
  fileHeightForSize,
  findClusterForPath,
  findFileNode,
  layoutCodebase,
} from "./codebaseLayout";

function tree(path: string): SnapshotEntry {
  return {
    path,
    name: path.slice(path.lastIndexOf("/") + 1),
    type: "tree",
    sha: `tree-${path}`,
    size: null,
    mode: "040000",
    parentPath: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
    depth: path.split("/").length - 1,
    extension: null,
  };
}

function blob(path: string, size: number): SnapshotEntry {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return {
    path,
    name,
    type: "blob",
    sha: `blob-${path}`,
    size,
    mode: "100644",
    parentPath: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
    depth: path.split("/").length - 1,
    extension: dot > 0 ? name.slice(dot + 1).toLowerCase() : null,
  };
}

const ENTRIES: SnapshotEntry[] = [
  tree("docs"),
  tree("src"),
  tree("src/core"),
  tree("tests"),
  blob("README.md", 2200),
  blob("docs/guide.md", 900),
  blob("package.json", 1400),
  blob("src/main.ts", 4200),
  blob("src/styles.css", 1800),
  blob("src/core/types.ts", 3000),
  blob("tests/app.test.ts", 1200),
];

describe("categorizeFile", () => {
  it.each([
    ["src/main.ts", "ts", "code"],
    ["src/styles.css", "css", "style"],
    ["docs/guide.md", "md", "docs"],
    ["package.json", "json", "data"],
    ["pnpm-lock.yaml", "yaml", "config"],
    ["public/logo.svg", "svg", "asset"],
    ["tests/app.test.ts", "ts", "test"],
    ["LICENSE", null, "other"],
  ] as const)("categorizes %s as %s", (path, extension, expected) => {
    expect(categorizeFile(path, extension)).toBe(expected);
  });
});

describe("fileHeightForSize", () => {
  it("keeps heights within the scene bounds", () => {
    expect(fileHeightForSize(null)).toBe(0.36);
    expect(fileHeightForSize(0)).toBe(0.36);
    expect(fileHeightForSize(1_000_000)).toBeLessThanOrEqual(2.8);
    expect(fileHeightForSize(4200)).toBeGreaterThan(fileHeightForSize(900));
  });
});

describe("layoutCodebase", () => {
  it("groups files into directory clusters and preserves file metadata", () => {
    const layout = layoutCodebase(
      ENTRIES,
      new Map([["src/main.ts", "modified"]]),
    );

    expect(layout.totalFiles).toBe(7);
    expect(layout.totalDirectories).toBe(4);
    expect(layout.clusters.map((cluster) => cluster.path)).toEqual(
      expect.arrayContaining(["", "docs", "src", "src/core", "tests"]),
    );

    const root = layout.clusters.find((cluster) => cluster.isRoot);
    const source = layout.clusters.find((cluster) => cluster.path === "src");
    expect(root?.fileCount).toBe(2);
    expect(source?.fileCount).toBe(2);
    expect(source?.descendantFileCount).toBe(3);

    const main = findFileNode(layout, "src/main.ts");
    expect(main).toMatchObject({
      name: "main.ts",
      clusterPath: "src",
      category: "code",
      changeStatus: "modified",
      extension: "ts",
    });
    expect(main?.height).toBeGreaterThan(0);
    expect(findClusterForPath(layout, "src/core")?.name).toBe("core");
    expect(findFileNode(layout, "missing.ts")).toBeNull();
  });

  it("reports useful bounds for camera fitting", () => {
    const layout = layoutCodebase(ENTRIES);

    expect(layout.bounds.minX).toBeLessThan(layout.bounds.maxX);
    expect(layout.bounds.minZ).toBeLessThan(layout.bounds.maxZ);
    expect(layout.bounds.maxHeight).toBeGreaterThan(1);
    expect(layout.files.every((file) => Number.isFinite(file.x))).toBe(true);
    expect(layout.files.every((file) => Number.isFinite(file.z))).toBe(true);
  });

  it("handles an empty tree", () => {
    const layout = layoutCodebase([]);
    expect(layout.totalFiles).toBe(0);
    expect(layout.files).toEqual([]);
    expect(layout.bounds).toEqual({
      minX: -1.6,
      maxX: 1.6,
      minZ: -1.25,
      maxZ: 1.25,
      maxHeight: 1,
    });
  });
});
