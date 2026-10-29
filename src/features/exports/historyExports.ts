import type {
  BranchRef,
  CommitDetails,
  CommitRecord,
  ExportJsonPayload,
  RefHistoryState,
  RepositoryInfo,
  RepositorySource,
  TagRef,
} from "../../types/domain";
import { shortSha } from "../../utils/format";
import { sanitizeFilename } from "../../utils/download";
import { toCsv } from "../../utils/csv";

interface BuildExportOptions {
  repository: RepositoryInfo;
  source: RepositorySource;
  branches: BranchRef[];
  tags: TagRef[];
  commits: CommitRecord[];
  details: Record<string, CommitDetails>;
  refHistory: Record<string, RefHistoryState>;
  activeRef: string | null;
  selectedCommitSha: string | null;
}

export function buildHistoryJsonExport(options: BuildExportOptions): ExportJsonPayload {
  const loadedRefs: ExportJsonPayload["completeness"]["refs"] = {};
  for (const [ref, state] of Object.entries(options.refHistory)) {
    loadedRefs[ref] = {
      loadedPages: state.loadedPages,
      loadedCommits: state.loadedShas.length,
      complete: state.complete,
    };
  }

  const activeState = options.activeRef
    ? options.refHistory[options.activeRef]
    : undefined;
  const allRefs = Object.values(options.refHistory);
  const historyComplete = options.activeRef
    ? Boolean(activeState?.complete)
    : allRefs.length > 0 && allRefs.every((ref) => ref.complete);

  const note = historyComplete
    ? "The active reference's loaded history has been followed to the end. Other branch histories may not be fully loaded."
    : "Only the commit pages loaded in this session are included. This is not a complete export of every branch in the repository.";

  const commits = [...options.commits]
    .sort((a, b) => {
      const aTime = new Date(a.committedAt ?? a.authoredAt ?? 0).getTime();
      const bTime = new Date(b.committedAt ?? b.authoredAt ?? 0).getTime();
      return bTime - aTime;
    })
    .map((commit) => {
      const details = options.details[commit.sha];
      const base = {
        sha: commit.sha,
        message: commit.message,
        author: {
          name: commit.authorName,
          email: commit.authorEmail,
          login: commit.authorLogin,
        },
        authoredAt: commit.authoredAt,
        committedAt: commit.committedAt,
        parents: commit.parents,
        isMerge: commit.isMerge,
        refs: commit.refs,
        tags: commit.tags,
      };
      if (!details) return base;
      return {
        ...base,
        stats: {
          additions: details.stats?.additions ?? 0,
          deletions: details.stats?.deletions ?? 0,
          filesChanged: details.files.length,
        },
      };
    });

  return {
    schema: "repowarp.history.v1",
    source: options.source,
    exportedAt: new Date().toISOString(),
    repository: {
      owner: options.repository.identity.owner,
      name: options.repository.identity.name,
      fullName: options.repository.identity.fullName,
      url: options.repository.htmlUrl,
      defaultBranch: options.repository.defaultBranch,
      description: options.repository.description,
      stars: options.repository.stars,
      language: options.repository.language,
    },
    reference: {
      active: options.activeRef,
      selectedCommit: options.selectedCommitSha,
      branches: options.branches,
      tags: options.tags,
    },
    completeness: {
      historyComplete,
      loadedCommitCount: options.commits.length,
      refs: loadedRefs,
      note,
    },
    commits,
  };
}

export function buildHistoryCsvExport(options: BuildExportOptions): string {
  const headers = [
    "sha",
    "short_sha",
    "subject",
    "message",
    "author_name",
    "author_email",
    "author_login",
    "authored_at",
    "committed_at",
    "parents",
    "is_merge",
    "refs",
    "tags",
    "additions",
    "deletions",
    "files_changed",
  ];

  const rows = [...options.commits]
    .sort((a, b) => {
      const aTime = new Date(a.committedAt ?? a.authoredAt ?? 0).getTime();
      const bTime = new Date(b.committedAt ?? b.authoredAt ?? 0).getTime();
      return bTime - aTime;
    })
    .map((commit) => {
      const details = options.details[commit.sha];
      return [
        commit.sha,
        shortSha(commit.sha),
        commit.subject,
        commit.message,
        commit.authorName,
        commit.authorEmail,
        commit.authorLogin,
        commit.authoredAt,
        commit.committedAt,
        commit.parents.join(" "),
        commit.isMerge ? "true" : "false",
        commit.refs.join(" "),
        commit.tags.join(" "),
        details?.stats?.additions ?? "",
        details?.stats?.deletions ?? "",
        details?.files.length ?? "",
      ];
    });

  return toCsv(headers, rows);
}

export function historyExportFilename(
  repository: RepositoryInfo,
  options: {
    commitCount: number;
    complete: boolean;
    extension: "json" | "csv" | "png";
  },
): string {
  const date = new Date().toISOString().slice(0, 10);
  const scope = options.complete ? "history" : "partial-history";
  const demo = repository.source === "demo" ? "demo-" : "";
  return sanitizeFilename(
    `${demo}${repository.identity.owner}-${repository.identity.name}-${scope}-${options.commitCount}commits-${date}.${options.extension}`,
  );
}
