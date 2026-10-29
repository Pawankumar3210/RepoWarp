import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitDetails, CommitRecord, RepositoryIdentity } from "../../types/domain";
import { requestGitHub } from "./client";
import {
  EAGER_REPOSITORY_SIZE_KB,
  loadDirectoryChildren,
  loadSnapshotForCommit,
} from "./repositoryApi";

vi.mock("./client", () => ({
  requestGitHub: vi.fn(),
}));

const identity: RepositoryIdentity = {
  owner: "acme",
  name: "rocket",
  fullName: "acme/rocket",
};

const commit: CommitRecord = {
  sha: "commit-sha",
  subject: "Add workspace",
  message: "Add workspace",
  authorName: "Mira Chen",
  authorEmail: "mira@example.com",
  authorLogin: "mirachen",
  authorAvatarUrl: null,
  authoredAt: "2025-01-01T10:00:00Z",
  committedAt: "2025-01-01T10:00:00Z",
  parents: ["parent-sha"],
  treeSha: "tree-sha",
  htmlUrl: "https://github.com/acme/rocket/commit/commit-sha",
  isMerge: false,
  refs: [],
  tags: [],
};

const details: CommitDetails = {
  sha: commit.sha,
  subject: commit.subject,
  message: commit.message,
  authorName: commit.authorName,
  authorEmail: commit.authorEmail,
  authorLogin: commit.authorLogin,
  authorAvatarUrl: commit.authorAvatarUrl,
  authoredAt: commit.authoredAt,
  committedAt: commit.committedAt,
  parents: commit.parents,
  treeSha: commit.treeSha,
  stats: null,
  files: [],
  fileListTruncated: false,
  htmlUrl: commit.htmlUrl,
  isMerge: false,
  patchNote: null,
};

describe("loadDirectoryChildren", () => {
  beforeEach(() => {
    vi.mocked(requestGitHub).mockReset();
  });

  it("loads one directory level and prefixes nested paths", async () => {
    vi.mocked(requestGitHub).mockResolvedValueOnce({
      sha: "directory-sha",
      tree: [
        { path: "session.ts", mode: "100644", type: "blob", sha: "file-sha", size: 42 },
        { path: "nested", mode: "040000", type: "tree", sha: "nested-sha" },
      ],
      truncated: true,
    });

    const result = await loadDirectoryChildren(
      identity,
      "src/workspace/",
      "directory-sha",
    );

    expect(requestGitHub).toHaveBeenCalledWith(
      "/repos/acme/rocket/git/trees/directory-sha",
      { signal: undefined, ttlMs: Number.POSITIVE_INFINITY },
    );
    expect(result.truncated).toBe(true);
    expect(result.entries.map((entry) => entry.path)).toEqual([
      "src/workspace/session.ts",
      "src/workspace/nested",
    ]);
    expect(result.entries[0]?.parentPath).toBe("src/workspace");
    expect(result.entries[1]?.type).toBe("tree");
  });
});

describe("loadSnapshotForCommit", () => {
  beforeEach(() => {
    vi.mocked(requestGitHub).mockReset();
  });

  it("loads a small tree recursively without lazy expansion", async () => {
    vi.mocked(requestGitHub).mockResolvedValueOnce({
      sha: "tree-sha",
      tree: [
        { path: "README.md", mode: "100644", type: "blob", sha: "readme-sha", size: 12 },
      ],
      truncated: false,
    });

    const result = await loadSnapshotForCommit(identity, commit, 100, undefined, details);

    expect(requestGitHub).toHaveBeenCalledWith(
      "/repos/acme/rocket/git/trees/tree-sha?recursive=1",
      { signal: undefined, ttlMs: Number.POSITIVE_INFINITY },
    );
    expect(result.lazy).toBe(false);
    expect(result.entries[0]?.path).toBe("README.md");
    expect(result.changeBaseSha).toBe("parent-sha");
  });

  it("uses root-only loading for large repositories", async () => {
    vi.mocked(requestGitHub).mockResolvedValueOnce({
      sha: "tree-sha",
      tree: [
        { path: "src", mode: "040000", type: "tree", sha: "src-sha" },
      ],
      truncated: false,
    });

    const result = await loadSnapshotForCommit(
      identity,
      commit,
      EAGER_REPOSITORY_SIZE_KB + 1,
      undefined,
      details,
    );

    expect(requestGitHub).toHaveBeenCalledWith(
      "/repos/acme/rocket/git/trees/tree-sha",
      { signal: undefined, ttlMs: Number.POSITIVE_INFINITY },
    );
    expect(result.lazy).toBe(true);
    expect(result.entries.map((entry) => entry.path)).toEqual(["src"]);
    expect(result.partialReason).toContain("large repository");
  });

  it("falls back to the root tree when a recursive response is truncated", async () => {
    vi.mocked(requestGitHub)
      .mockResolvedValueOnce({
        sha: "tree-sha",
        tree: [
          { path: "src", mode: "040000", type: "tree", sha: "src-sha" },
        ],
        truncated: true,
      })
      .mockResolvedValueOnce({
        sha: "tree-sha",
        tree: [
          { path: "src", mode: "040000", type: "tree", sha: "src-sha" },
        ],
        truncated: false,
      });

    const result = await loadSnapshotForCommit(identity, commit, 100, undefined, details);

    expect(requestGitHub).toHaveBeenCalledTimes(2);
    expect(vi.mocked(requestGitHub).mock.calls[1]?.[0]).toBe(
      "/repos/acme/rocket/git/trees/tree-sha",
    );
    expect(result.lazy).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.partialReason).toContain("truncated");
  });
});
