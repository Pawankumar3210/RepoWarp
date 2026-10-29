import { describe, expect, it } from "vitest";
import type {
  CommitDetails,
  CommitRecord,
  RefHistoryState,
  RepositoryInfo,
} from "../../types/domain";
import {
  buildHistoryCsvExport,
  buildHistoryJsonExport,
  historyExportFilename,
} from "./historyExports";

const repository: RepositoryInfo = {
  identity: { owner: "demo", name: "atlas-lens", fullName: "demo/atlas-lens" },
  description: "A fixture repository",
  defaultBranch: "main",
  stars: 482,
  forks: 37,
  openIssues: 0,
  language: "TypeScript",
  license: "MIT",
  topics: [],
  htmlUrl: "",
  ownerAvatarUrl: "",
  updatedAt: "2025-03-01T00:00:00Z",
  pushedAt: "2025-03-01T00:00:00Z",
  archived: false,
  fork: false,
  sizeKb: 420,
  source: "demo",
};

function commit(
  sha: string,
  subject: string,
  committedAt: string,
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
    parents: [],
    treeSha: null,
    htmlUrl: "",
    isMerge: false,
    refs: [],
    tags: [],
    ...overrides,
  };
}

const older = commit("aaaa111", "Initial import", "2025-02-01T10:00:00Z", {
  refs: [],
});
const newer = commit("bbbb222", "Add exporter", "2025-02-03T10:00:00Z", {
  parents: [older.sha],
  refs: ["main"],
  tags: ["v1.0.0"],
  authorName: "Theo Alvarez",
  authorLogin: "theo",
});

const details: Record<string, CommitDetails> = {
  [newer.sha]: {
    sha: newer.sha,
    subject: newer.subject,
    message: newer.message,
    authorName: newer.authorName,
    authorEmail: newer.authorEmail,
    authorLogin: newer.authorLogin,
    authorAvatarUrl: null,
    authoredAt: newer.authoredAt,
    committedAt: newer.committedAt,
    parents: newer.parents,
    treeSha: "tree-newer",
    stats: { total: 12, additions: 10, deletions: 2 },
    files: [
      {
        path: "src/export.ts",
        status: "added",
        additions: 10,
        deletions: 0,
        changes: 10,
        patchAvailable: false,
      },
    ],
    fileListTruncated: false,
    htmlUrl: "",
    isMerge: false,
    patchNote: null,
  },
};

const refHistory: Record<string, RefHistoryState> = {
  main: {
    loadedPages: 1,
    loadedShas: [newer.sha, older.sha],
    complete: true,
    loading: false,
    error: null,
    lastLoadedAt: null,
  },
  dev: {
    loadedPages: 1,
    loadedShas: [older.sha],
    complete: false,
    loading: false,
    error: null,
    lastLoadedAt: null,
  },
};

const baseOptions = {
  repository,
  source: "demo" as const,
  branches: [
    { name: "main", sha: newer.sha, protected: true },
    { name: "dev", sha: older.sha, protected: false },
  ],
  tags: [{ name: "v1.0.0", sha: newer.sha }],
  commits: [older, newer],
  details,
  refHistory,
  activeRef: "main",
  selectedCommitSha: newer.sha,
};

describe("buildHistoryJsonExport", () => {
  it("exports sorted commits, details, and completeness metadata", () => {
    const payload = buildHistoryJsonExport(baseOptions);

    expect(payload.schema).toBe("repowarp.history.v1");
    expect(payload.source).toBe("demo");
    expect(payload.repository.fullName).toBe("demo/atlas-lens");
    expect(payload.reference.active).toBe("main");
    expect(payload.reference.selectedCommit).toBe(newer.sha);
    expect(payload.completeness.historyComplete).toBe(true);
    expect(payload.completeness.loadedCommitCount).toBe(2);
    expect(payload.completeness.refs).toEqual({
      main: { loadedPages: 1, loadedCommits: 2, complete: true },
      dev: { loadedPages: 1, loadedCommits: 1, complete: false },
    });
    expect(payload.commits.map((item) => item.sha)).toEqual([newer.sha, older.sha]);
    expect(payload.commits[0]?.stats).toEqual({
      additions: 10,
      deletions: 2,
      filesChanged: 1,
    });
    expect(payload.completeness.note).toContain("active reference");
  });

  it("marks incomplete active history as partial", () => {
    const payload = buildHistoryJsonExport({
      ...baseOptions,
      refHistory: {
        main: {
          ...refHistory.main,
          complete: false,
        } as RefHistoryState,
      },
    });

    expect(payload.completeness.historyComplete).toBe(false);
    expect(payload.completeness.note).toContain("Only the commit pages");
  });
});

describe("buildHistoryCsvExport", () => {
  it("includes a header, BOM, and spreadsheet-safe values", () => {
    const malicious = commit(
      "cccc333",
      "=SUM(1,1)",
      "2025-02-04T10:00:00Z",
      {
        message: 'Fix "quoted" value, with comma',
        authorName: "@malicious",
      },
    );
    const csv = buildHistoryCsvExport({
      ...baseOptions,
      commits: [malicious, newer, older],
      details: {},
    });

    expect(csv.startsWith("\uFEFFsha,short_sha,subject")).toBe(true);
    expect(csv).toContain("'=SUM(1,1)");
    expect(csv).toContain("'@malicious");
    expect(csv).toContain('"Fix ""quoted"" value, with comma"');
    expect(csv).toContain("bbbb222,bbbb222,Add exporter");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("historyExportFilename", () => {
  it("labels complete and partial exports", () => {
    const complete = historyExportFilename(repository, {
      commitCount: 2,
      complete: true,
      extension: "json",
    });
    const partial = historyExportFilename(repository, {
      commitCount: 2,
      complete: false,
      extension: "csv",
    });

    expect(complete).toMatch(
      /^demo-demo-atlas-lens-history-2commits-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(partial).toMatch(
      /^demo-demo-atlas-lens-partial-history-2commits-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});
