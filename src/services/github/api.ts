import type { RepositoryIdentity } from "../../types/domain";

const enc = encodeURIComponent;

export const githubApi = {
  repository(identity: RepositoryIdentity): string {
    return `/repos/${enc(identity.owner)}/${enc(identity.name)}`;
  },
  branches(identity: RepositoryIdentity, page: number, perPage = 100): string {
    return `${githubApi.repository(identity)}/branches?per_page=${perPage}&page=${page}`;
  },
  tags(identity: RepositoryIdentity, page: number, perPage = 100): string {
    return `${githubApi.repository(identity)}/tags?per_page=${perPage}&page=${page}`;
  },
  commits(
    identity: RepositoryIdentity,
    ref: string,
    page: number,
    perPage = 50,
  ): string {
    return `${githubApi.repository(identity)}/commits?sha=${enc(ref)}&per_page=${perPage}&page=${page}`;
  },
  commit(identity: RepositoryIdentity, ref: string): string {
    return `${githubApi.repository(identity)}/commits/${enc(ref)}`;
  },
  tree(identity: RepositoryIdentity, treeSha: string, recursive: boolean): string {
    return `${githubApi.repository(identity)}/git/trees/${enc(treeSha)}${recursive ? "?recursive=1" : ""}`;
  },
  compare(identity: RepositoryIdentity, base: string, target: string): string {
    return `${githubApi.repository(identity)}/compare/${enc(base)}...${enc(target)}?per_page=100`;
  },
};

export function githubCommitUrl(
  identity: RepositoryIdentity,
  sha: string,
): string {
  return `https://github.com/${identity.owner}/${identity.name}/commit/${sha}`;
}

export function githubRepoUrl(identity: RepositoryIdentity): string {
  return `https://github.com/${identity.owner}/${identity.name}`;
}

export function githubFileUrl(
  identity: RepositoryIdentity,
  sha: string,
  path: string,
): string {
  const encodedPath = path
    .split("/")
    .map((part) => enc(part))
    .join("/");
  return `https://github.com/${identity.owner}/${identity.name}/blob/${sha}/${encodedPath}`;
}

export function githubCompareUrl(
  identity: RepositoryIdentity,
  base: string,
  target: string,
): string {
  return `https://github.com/${identity.owner}/${identity.name}/compare/${base}...${target}`;
}
