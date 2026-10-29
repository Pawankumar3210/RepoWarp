export interface GitHubOwner {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubOwner;
  html_url: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  language: string | null;
  license: GitHubLicense | null;
  topics?: string[];
  updated_at: string;
  pushed_at: string | null;
  created_at: string;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  size: number;
  visibility: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubGitPerson {
  name: string;
  email: string;
  date: string;
}

export interface GitHubCommitTree {
  sha: string;
  url: string;
}

export interface GitHubCommitSummary {
  sha: string;
  commit: {
    author: GitHubGitPerson | null;
    committer: GitHubGitPerson | null;
    message: string;
    tree?: GitHubCommitTree;
  };
  author: GitHubUser | null;
  committer: GitHubUser | null;
  parents: Array<{ sha: string; url?: string }>;
  html_url?: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GitHubFileChange {
  sha?: string | null;
  filename: string;
  previous_filename?: string;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  blob_url?: string;
  raw_url?: string;
  contents_url?: string;
  patch?: string;
}

export interface GitHubCommitDetail extends GitHubCommitSummary {
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: GitHubFileChange[];
  html_url?: string;
}

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url?: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url?: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

export interface GitHubCompareResponse {
  status: "diverged" | "ahead" | "behind" | "identical";
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  html_url?: string;
  commits: GitHubCommitSummary[];
  files?: GitHubFileChange[];
}

export interface GitHubApiErrorBody {
  message?: string;
  documentation_url?: string;
  errors?: Array<{ resource?: string; field?: string; code?: string; message?: string }>;
}
