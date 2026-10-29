import type { BranchRef, CommitRecord, TagRef } from "../../types/domain";

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function decorateCommitsWithRefs(
  commits: Record<string, CommitRecord>,
  branches: BranchRef[],
  tags: TagRef[],
): Record<string, CommitRecord> {
  const refsBySha = new Map<string, string[]>();
  const tagsBySha = new Map<string, string[]>();

  for (const branch of branches) {
    refsBySha.set(branch.sha, [...(refsBySha.get(branch.sha) ?? []), branch.name]);
  }
  for (const tag of tags) {
    tagsBySha.set(tag.sha, [...(tagsBySha.get(tag.sha) ?? []), tag.name]);
  }

  let changed = false;
  const next: Record<string, CommitRecord> = {};
  for (const [sha, commit] of Object.entries(commits)) {
    const refs = (refsBySha.get(sha) ?? []).sort();
    const commitTags = (tagsBySha.get(sha) ?? []).sort();
    if (sameArray(commit.refs, refs) && sameArray(commit.tags, commitTags)) {
      next[sha] = commit;
    } else {
      changed = true;
      next[sha] = { ...commit, refs, tags: commitTags };
    }
  }
  return changed ? next : commits;
}
