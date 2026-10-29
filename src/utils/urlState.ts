import type { ViewMode } from "../types/domain";
import { normalizeSha } from "./sha";

export interface ExplorationUrlState {
  demo: boolean;
  view: ViewMode;
  commit: string | null;
  branch: string | null;
  base: string | null;
  file: string | null;
}

const BRANCH_PATTERN = /^[\w./@-]{1,255}$/;

export function parseExplorationSearch(search: URLSearchParams): ExplorationUrlState {
  const viewParam = search.get("view");
  const view: ViewMode = viewParam === "codebase" ? "codebase" : "history";
  const commit = normalizeSha(search.get("commit"));
  const base = normalizeSha(search.get("base"));
  const rawBranch = search.get("branch");
  const branch = rawBranch && BRANCH_PATTERN.test(rawBranch) ? rawBranch : null;
  const rawFile = search.get("file");
  const file = rawFile && rawFile.length <= 500 ? rawFile : null;

  return {
    demo: search.get("demo") === "1",
    view,
    commit,
    branch,
    base,
    file,
  };
}

export function buildExplorationSearch(
  current: URLSearchParams,
  state: Partial<ExplorationUrlState>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const view = state.view;
  if (view) next.set("view", view);
  if (state.commit !== undefined) {
    if (state.commit) next.set("commit", state.commit);
    else next.delete("commit");
  }
  if (state.branch !== undefined) {
    if (state.branch) next.set("branch", state.branch);
    else next.delete("branch");
  }
  if (state.base !== undefined) {
    if (state.base) next.set("base", state.base);
    else next.delete("base");
  }
  if (state.file !== undefined) {
    if (state.file) next.set("file", state.file);
    else next.delete("file");
  }
  if (state.demo !== undefined) {
    if (state.demo) next.set("demo", "1");
    else next.delete("demo");
  }
  return next;
}

export function explorationHref(
  owner: string,
  repo: string,
  state: Partial<ExplorationUrlState> & { demo?: boolean },
): string {
  const params = buildExplorationSearch(new URLSearchParams(), state);
  const query = params.toString();
  return `/r/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${query ? `?${query}` : ""}`;
}

export function commitHref(
  owner: string,
  repo: string,
  sha: string,
  view: ViewMode,
  demo = false,
): string {
  return explorationHref(owner, repo, { commit: sha, view, demo });
}

export function demoHref(view: ViewMode = "history", commit?: string): string {
  return explorationHref("demo", "atlas-lens", {
    demo: true,
    view,
    commit: commit ?? null,
  });
}
