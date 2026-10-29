import { describe, expect, it } from "vitest";
import type { BranchRef, CommitRecord, HistoryFilters } from "../../types/domain";
import {
  filterCommits,
  getAuthorOptions,
  getReachableShas,
  getTimelineCommits,
  layoutGraph,
  neighborsInTimeline,
  sortNewestFirst,
  sortOldestFirst,
} from "./graphLayout";

function commit(
  sha: string,
  subject: string,
  committedAt: string,
  parents: string[] = [],
  overrides: Partial<CommitRecord> = {},
): CommitRecord {
  return {
    sha,
    subject,
    message: subject,
    authorName: "Mira Chen",
    authorEmail: "mira@example.com",
    authorLogin: "mirachen",
    authorAvatarUrl: null,
    authoredAt: committedAt,
    committedAt,
    parents,
    treeSha: null,
    htmlUrl: "",
    isMerge: parents.length > 1,
    refs: [],
    tags: [],
    ...overrides,
  };
}

const OLDEST = commit("aaaa111", "Initial scaffold", "2025-01-01T10:00:00Z");
const MIDDLE = commit("bbbb222", "Add parser", "2025-01-02T10:00:00Z", [
  OLDEST.sha,
]);
const TIP = commit("cccc333", "Fix parser edge cases", "2025-01-03T10:00:00Z", [
  MIDDLE.sha,
], {
  authorName: "Theo Alvarez",
  authorLogin: "theo",
  refs: ["main"],
  tags: ["v1.0.0"],
});

const FILTERS: HistoryFilters = {
  search: "",
  author: "",
  branch: "",
  fromDate: "",
  toDate: "",
  mergesOnly: false,
  taggedOnly: false,
};

describe("commit ordering", () => {
  it("sorts newest and oldest first without mutating the input", () => {
    const input = [MIDDLE, TIP, OLDEST];
    expect(sortNewestFirst(input).map((item) => item.sha)).toEqual([
      TIP.sha,
      MIDDLE.sha,
      OLDEST.sha,
    ]);
    expect(sortOldestFirst(input).map((item) => item.sha)).toEqual([
      OLDEST.sha,
      MIDDLE.sha,
      TIP.sha,
    ]);
    expect(input.map((item) => item.sha)).toEqual([MIDDLE.sha, TIP.sha, OLDEST.sha]);
  });
});

describe("layoutGraph", () => {
  it("lays out a linear branch with one lane and connected edges", () => {
    const layout = layoutGraph([TIP, OLDEST, MIDDLE]);

    expect(layout.commitNodes.map((node) => node.sha)).toEqual([
      TIP.sha,
      MIDDLE.sha,
      OLDEST.sha,
    ]);
    expect(layout.laneCount).toBe(1);
    expect(layout.edges).toHaveLength(2);
    expect(layout.edges.every((edge) => edge.type === "normal")).toBe(true);
    expect(layout.commitNodes[0]?.x).toBeCloseTo(0);
    expect(layout.commitNodes[1]?.x).toBeCloseTo(-2.75);
    expect(layout.commitNodes[2]?.x).toBeCloseTo(-5.5);
    expect(layout.commitsBySha.get(TIP.sha)?.subject).toBe("Fix parser edge cases");
  });

  it("marks missing parents as boundary nodes and boundary edges", () => {
    const layout = layoutGraph([TIP, MIDDLE]);

    expect(layout.boundaryNodes).toHaveLength(1);
    expect(layout.boundaryNodes[0]?.sha).toBe(OLDEST.sha);
    expect(layout.missingParentShas).toEqual([OLDEST.sha]);
    expect(layout.edges.some((edge) => edge.type === "boundary")).toBe(true);
  });

  it("creates merge edges for additional parents", () => {
    const branch = commit("dddd444", "Feature work", "2025-01-02T12:00:00Z", [
      OLDEST.sha,
    ]);
    const merge = commit(
      "eeee555",
      "Merge feature work",
      "2025-01-04T10:00:00Z",
      [TIP.sha, branch.sha],
      { isMerge: true },
    );
    const layout = layoutGraph([merge, TIP, branch, MIDDLE, OLDEST]);

    expect(layout.laneCount).toBeGreaterThan(1);
    expect(layout.edges.filter((edge) => edge.type === "merge")).toHaveLength(1);
    expect(layout.commitNodes.find((node) => node.sha === merge.sha)?.isMerge).toBe(
      true,
    );
  });
});

describe("filterCommits", () => {
  const commits = [TIP, MIDDLE, OLDEST];
  const branches: BranchRef[] = [
    { name: "main", sha: TIP.sha, protected: true },
    { name: "old", sha: OLDEST.sha, protected: false },
  ];

  it("returns all loaded commits when no filters are active", () => {
    const result = filterCommits(commits, FILTERS, branches);
    expect(result.commits).toHaveLength(3);
    expect(result.totalLoaded).toBe(3);
    expect(result.matchingShas.size).toBe(3);
  });

  it("matches subject and message text case-insensitively", () => {
    const result = filterCommits(commits, { ...FILTERS, search: "PARSER" }, branches);
    expect(result.commits.map((item) => item.sha)).toEqual([TIP.sha, MIDDLE.sha]);
  });

  it("matches a short SHA prefix", () => {
    const result = filterCommits(commits, { ...FILTERS, search: "bbbb" }, branches);
    expect(result.commits.map((item) => item.sha)).toEqual([MIDDLE.sha]);
  });

  it("matches author name or login", () => {
    const byName = filterCommits(commits, { ...FILTERS, author: "theo" }, branches);
    const byLogin = filterCommits(commits, { ...FILTERS, author: "mirachen" }, branches);

    expect(byName.commits.map((item) => item.sha)).toEqual([TIP.sha]);
    expect(byLogin.commits.map((item) => item.sha)).toEqual([MIDDLE.sha, OLDEST.sha]);
  });

  it("filters by date range, merges, and tags", () => {
    const dateResult = filterCommits(
      commits,
      { ...FILTERS, fromDate: "2025-01-02", toDate: "2025-01-02" },
      branches,
    );
    const tagResult = filterCommits(commits, { ...FILTERS, taggedOnly: true }, branches);
    const mergeResult = filterCommits(
      [TIP, MIDDLE, OLDEST, commit("ffff666", "Merge", "2025-01-05T10:00:00Z", [
        TIP.sha,
        MIDDLE.sha,
      ])],
      { ...FILTERS, mergesOnly: true },
      branches,
    );

    expect(dateResult.commits.map((item) => item.sha)).toEqual([MIDDLE.sha]);
    expect(tagResult.commits.map((item) => item.sha)).toEqual([TIP.sha]);
    expect(mergeResult.commits.map((item) => item.sha)).toEqual(["ffff666"]);
  });

  it("filters to commits reachable from the selected branch tip", () => {
    const result = filterCommits(commits, { ...FILTERS, branch: "old" }, branches);
    expect(result.commits.map((item) => item.sha)).toEqual([OLDEST.sha]);
    expect(getReachableShas(commits, TIP.sha)).toEqual(
      new Set([TIP.sha, MIDDLE.sha, OLDEST.sha]),
    );
  });
});

describe("timeline helpers", () => {
  it("walks the timeline in chronological order", () => {
    const ascending = getTimelineCommits([TIP, OLDEST, MIDDLE]);
    expect(ascending.map((item) => item.sha)).toEqual([
      OLDEST.sha,
      MIDDLE.sha,
      TIP.sha,
    ]);
    expect(neighborsInTimeline(ascending, MIDDLE.sha, 1)?.sha).toBe(TIP.sha);
    expect(neighborsInTimeline(ascending, MIDDLE.sha, -1)?.sha).toBe(OLDEST.sha);
    expect(neighborsInTimeline(ascending, TIP.sha, 1)).toBeNull();
  });

  it("builds unique sorted author options", () => {
    expect(getAuthorOptions([TIP, MIDDLE, OLDEST])).toEqual([
      { value: "mirachen", label: "Mira Chen", login: "mirachen" },
      { value: "theo", label: "Theo Alvarez", login: "theo" },
    ]);
  });
});
