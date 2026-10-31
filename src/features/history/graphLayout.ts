import type {
  BranchRef,
  CommitRecord,
  HistoryFilters,
} from "../../types/domain";

export const GRAPH_X_GAP = 2.75;
export const GRAPH_LANE_GAP = 3.15;
export const GRAPH_LANE_DEPTH = 0.55;
export const GRAPH_NODE_Y = 0.52;

export interface GraphNode {
  id: string;
  sha: string;
  kind: "commit" | "boundary";
  x: number;
  y: number;
  z: number;
  lane: number;
  commitIndex: number;
  isMerge: boolean;
  refs: string[];
  tags: string[];
  missingParents: string[];
  boundaryFor?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: "normal" | "merge" | "boundary";
  lane: number;
}

export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  commitNodes: GraphNode[];
  boundaryNodes: GraphNode[];
  edges: GraphEdge[];
  bounds: GraphBounds;
  laneCount: number;
  sortedCommits: CommitRecord[];
  commitsBySha: Map<string, CommitRecord>;
  missingParentShas: string[];
}

function timestampOf(commit: CommitRecord): number {
  const raw = commit.committedAt ?? commit.authoredAt;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortNewestFirst(commits: CommitRecord[]): CommitRecord[] {
  return [...commits].sort((a, b) => {
    const delta = timestampOf(b) - timestampOf(a);
    if (delta !== 0) return delta;
    return a.sha.localeCompare(b.sha);
  });
}

export function sortOldestFirst(commits: CommitRecord[]): CommitRecord[] {
  return [...commits].sort((a, b) => {
    const delta = timestampOf(a) - timestampOf(b);
    if (delta !== 0) return delta;
    return a.sha.localeCompare(b.sha);
  });
}

function findFirstFree(lanes: Array<string | null>, currentLane: number): number {
  for (let index = 0; index < lanes.length; index += 1) {
    if (index !== currentLane && lanes[index] === null) return index;
  }
  return lanes.length;
}

function clearExpectation(lanes: Array<string | null>, sha: string, except?: number): void {
  for (let index = 0; index < lanes.length; index += 1) {
    if (index !== except && lanes[index] === sha) lanes[index] = null;
  }
}

export function layoutGraph(commits: CommitRecord[]): GraphLayout {
  const sortedCommits = sortNewestFirst(commits);
  const commitsBySha = new Map(sortedCommits.map((commit) => [commit.sha, commit]));
  const lanes: Array<string | null> = [];
  const laneBySha = new Map<string, number>();

  for (const commit of sortedCommits) {
    let lane = lanes.indexOf(commit.sha);
    if (lane === -1) {
      lane = lanes.findIndex((value) => value === null);
      if (lane === -1) lane = lanes.length;
    }
    lanes[lane] = null;
    laneBySha.set(commit.sha, lane);

    const knownParents: string[] = [];
    for (const parent of commit.parents) {
      if (commitsBySha.has(parent)) knownParents.push(parent);
    }

    if (knownParents.length === 0) {
      lanes[lane] = null;
      continue;
    }

    const firstParent = knownParents[0];
    if (firstParent) {
      clearExpectation(lanes, firstParent, lane);
      lanes[lane] = firstParent;
    }

    for (const parent of knownParents.slice(1)) {
      if (lanes.includes(parent)) continue;
      const extraLane = findFirstFree(lanes, lane);
      lanes[extraLane] = parent;
    }
  }

  const laneCount = Math.max(1, lanes.length);
  const laneOffset = ((laneCount - 1) * GRAPH_LANE_GAP) / 2;
  const depthOffset = ((laneCount - 1) * GRAPH_LANE_DEPTH) / 2;

  const commitNodes: GraphNode[] = sortedCommits.map((commit, index) => {
    const lane = laneBySha.get(commit.sha) ?? 0;
    const missingParents = commit.parents.filter((parent) => !commitsBySha.has(parent));
    return {
      id: commit.sha,
      sha: commit.sha,
      kind: "commit",
      x: -index * GRAPH_X_GAP,
      y: GRAPH_NODE_Y + Math.sin(index * 0.37 + lane) * 0.07,
      z:
        lane * GRAPH_LANE_GAP -
        laneOffset +
        Math.sin(index * 0.42) * 2.05 +
        lane * GRAPH_LANE_DEPTH * 0.15 -
        depthOffset * 0.2,
      lane,
      commitIndex: index,
      isMerge: commit.parents.length > 1,
      refs: commit.refs,
      tags: commit.tags,
      missingParents,
    };
  });

  const nodeBySha = new Map(commitNodes.map((node) => [node.sha, node]));
  const boundaryByParent = new Map<string, GraphNode>();

  for (const node of commitNodes) {
    for (const parent of node.missingParents) {
      if (boundaryByParent.has(parent)) continue;
      boundaryByParent.set(parent, {
        id: `boundary:${parent}`,
        sha: parent,
        kind: "boundary",
        x: node.x - GRAPH_X_GAP * 1.15,
        y: node.y,
        z: node.z,
        lane: node.lane,
        commitIndex: node.commitIndex + 1,
        isMerge: false,
        refs: [],
        tags: [],
        missingParents: [],
        boundaryFor: parent,
      });
    }
  }

  // Pull boundary markers further left when several children share the same
  // unloaded parent, keeping the marker legible.
  for (const boundary of boundaryByParent.values()) {
    const children = commitNodes.filter((node) =>
      node.missingParents.includes(boundary.sha),
    );
    if (children.length > 0) {
      boundary.x = Math.min(...children.map((child) => child.x)) - GRAPH_X_GAP * 1.15;
    }
  }

  const boundaryNodes = [...boundaryByParent.values()];
  const nodes = [...commitNodes, ...boundaryNodes];
  const edges: GraphEdge[] = [];

  for (const commit of sortedCommits) {
    const node = nodeBySha.get(commit.sha);
    if (!node) continue;
    commit.parents.forEach((parent, parentIndex) => {
      const parentNode = nodeBySha.get(parent);
      const type: GraphEdge["type"] =
        parentNode === undefined
          ? "boundary"
          : parentIndex > 0
            ? "merge"
            : "normal";
      const targetId = parentNode?.id ?? `boundary:${parent}`;
      edges.push({
        id: `${node.id}->${targetId}:${parentIndex}`,
        from: node.id,
        to: targetId,
        type,
        lane: node.lane,
      });
    });
  }

  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const zs = nodes.map((node) => node.z);
  const missingParentShas = [...boundaryByParent.keys()];

  return {
    nodes,
    commitNodes,
    boundaryNodes,
    edges,
    bounds: {
      minX: xs.length ? Math.min(...xs) : 0,
      maxX: xs.length ? Math.max(...xs) : 0,
      minY: ys.length ? Math.min(...ys) : 0,
      maxY: ys.length ? Math.max(...ys) : 0,
      minZ: zs.length ? Math.min(...zs) : 0,
      maxZ: zs.length ? Math.max(...zs) : 0,
    },
    laneCount,
    sortedCommits,
    commitsBySha,
    missingParentShas,
  };
}

export function getReachableShas(commits: CommitRecord[], tipSha: string): Set<string> {
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  if (!bySha.has(tipSha)) return new Set();
  const reachable = new Set<string>();
  const queue = [tipSha];
  while (queue.length > 0) {
    const sha = queue.pop();
    if (!sha || reachable.has(sha)) continue;
    reachable.add(sha);
    const commit = bySha.get(sha);
    if (!commit) continue;
    for (const parent of commit.parents) {
      if (bySha.has(parent)) queue.push(parent);
    }
  }
  return reachable;
}

export function branchTips(branches: BranchRef[]): Map<string, string> {
  return new Map(branches.map((branch) => [branch.name, branch.sha]));
}

export interface FilteredHistoryResult {
  commits: CommitRecord[];
  matchingShas: Set<string>;
  totalLoaded: number;
}

export function filterCommits(
  commits: CommitRecord[],
  filters: HistoryFilters,
  branches: BranchRef[],
): FilteredHistoryResult {
  const search = filters.search.trim().toLowerCase();
  const searchLooksLikeSha = /^[0-9a-f]{4,40}$/i.test(search);
  const author = filters.author.trim().toLowerCase();
  const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : null;
  const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`).getTime() : null;

  let branchReachable: Set<string> | null = null;
  if (filters.branch) {
    const tip = branchTips(branches).get(filters.branch);
    branchReachable = tip ? getReachableShas(commits, tip) : new Set();
  }

  const filtered = commits.filter((commit) => {
    if (search) {
      const matchesSha = searchLooksLikeSha && commit.sha.toLowerCase().startsWith(search);
      const matchesMessage =
        commit.subject.toLowerCase().includes(search) ||
        commit.message.toLowerCase().includes(search);
      if (!matchesSha && !matchesMessage) return false;
    }

    if (author) {
      const name = commit.authorName?.toLowerCase() ?? "";
      const login = commit.authorLogin?.toLowerCase() ?? "";
      if (!name.includes(author) && !login.includes(author)) return false;
    }

    if (branchReachable && !branchReachable.has(commit.sha)) return false;

    const timestamp = commit.committedAt
      ? new Date(commit.committedAt).getTime()
      : commit.authoredAt
        ? new Date(commit.authoredAt).getTime()
        : null;
    if (from !== null && (timestamp === null || timestamp < from)) return false;
    if (to !== null && (timestamp === null || timestamp > to)) return false;

    if (filters.mergesOnly && !commit.isMerge) return false;
    if (filters.taggedOnly && commit.tags.length === 0) return false;

    return true;
  });

  return {
    commits: sortNewestFirst(filtered),
    matchingShas: new Set(filtered.map((commit) => commit.sha)),
    totalLoaded: commits.length,
  };
}

export interface AuthorOption {
  value: string;
  label: string;
  login: string | null;
}

export function getAuthorOptions(commits: CommitRecord[]): AuthorOption[] {
  const map = new Map<string, AuthorOption>();
  for (const commit of commits) {
    const value = commit.authorLogin ?? commit.authorName;
    if (!value) continue;
    const key = value.toLowerCase();
    if (map.has(key)) continue;
    map.set(key, {
      value,
      label: commit.authorName ?? commit.authorLogin ?? "Unknown author",
      login: commit.authorLogin,
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function getTimelineCommits(commits: CommitRecord[]): CommitRecord[] {
  return sortOldestFirst(commits);
}

export function neighborsInTimeline(
  commits: CommitRecord[],
  selectedSha: string | null,
  direction: -1 | 1,
): CommitRecord | null {
  if (commits.length === 0) return null;
  const ascending = getTimelineCommits(commits);
  const index = selectedSha
    ? ascending.findIndex((commit) => commit.sha === selectedSha)
    : -1;
  if (index === -1) {
    return direction === 1 ? (ascending[0] ?? null) : (ascending[ascending.length - 1] ?? null);
  }
  const next = ascending[index + direction];
  return next ?? null;
}
