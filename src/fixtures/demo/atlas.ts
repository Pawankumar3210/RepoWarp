import type {
  BranchRef,
  CommitDetails,
  CommitRecord,
  ComparisonResult,
  FileChange,
  RepositoryInfo,
  RepositorySnapshot,
  SnapshotEntry,
  TagRef,
} from "../../types/domain";
import { GitHubApiError } from "../../services/github/errors";

interface DemoAuthor {
  name: string;
  login: string;
  email: string;
}

interface DemoCommitSpec {
  key: string;
  subject: string;
  body?: string;
  date: string;
  author: keyof typeof AUTHORS;
  parents: string[];
  adds: string[];
  removes?: string[];
  renames?: Array<{ from: string; to: string }>;
  modifies?: string[];
  tags?: string[];
}

interface DemoTreeFile {
  sha: string;
  size: number;
  lastModified: string;
}

type DemoTree = Map<string, DemoTreeFile>;

const AUTHORS = {
  mira: {
    name: "Mira Chen",
    login: "mirachen",
    email: "mira@atlas-lens.dev",
  },
  theo: {
    name: "Theo Alvarez",
    login: "theo-alvarez",
    email: "theo@atlas-lens.dev",
  },
  jules: {
    name: "Jules Park",
    login: "julespark",
    email: "jules@atlas-lens.dev",
  },
  nadia: {
    name: "Nadia Okafor",
    login: "nadiaokafor",
    email: "nadia@atlas-lens.dev",
  },
} satisfies Record<string, DemoAuthor>;

const BASE_FILES = [
  ".gitignore",
  "README.md",
  "docs/vision.md",
  "package.json",
  "src/core/legacy-adapter.ts",
  "src/core/types.ts",
  "src/main.tsx",
  "src/ui/LegacyPanel.tsx",
  "tests/smoke.test.ts",
  "tsconfig.json",
];

const SPECS: DemoCommitSpec[] = [
  {
    key: "init",
    subject: "Initialize Atlas Lens workspace",
    body: "Start the spatial observability studio with a small renderer shell and shared telemetry types.\n\nThe initial tree intentionally keeps the surface area small.",
    date: "2025-01-08T09:42:00Z",
    author: "mira",
    parents: [],
    adds: BASE_FILES,
    tags: ["v0.1.0"],
  },
  {
    key: "schema",
    subject: "Add telemetry schema and validation fixtures",
    body: "Define the first stable frame schema and cover decoder expectations with focused tests.",
    date: "2025-01-10T15:18:00Z",
    author: "theo",
    parents: ["init"],
    adds: ["src/core/schema.ts", "tests/schema.test.ts"],
    modifies: ["README.md", "src/core/types.ts", "package.json"],
  },
  {
    key: "ingest",
    subject: "Build snapshot ingest pipeline",
    body: "Decode frame batches, coalesce sparse metrics and expose a deterministic ingest boundary.",
    date: "2025-01-13T11:06:00Z",
    author: "jules",
    parents: ["schema"],
    adds: [
      "src/ingest/decoder.ts",
      "src/ingest/pipeline.ts",
      "tests/ingest.test.ts",
    ],
    modifies: ["package.json"],
    tags: ["v0.2.0"],
  },
  {
    key: "overlay-scaffold",
    subject: "Scaffold the live overlay canvas",
    body: "Introduce a render surface for spatial overlay marks ahead of the first live view.",
    date: "2025-01-14T10:24:00Z",
    author: "nadia",
    parents: ["ingest"],
    adds: ["src/render/overlay.ts", "tests/overlay.test.ts"],
    modifies: ["src/main.tsx"],
  },
  {
    key: "frame-budget",
    subject: "Add frame budget monitor",
    body: "Track render budget pressure so future scene work has a measurable guardrail.",
    date: "2025-01-15T14:51:00Z",
    author: "theo",
    parents: ["ingest"],
    adds: ["src/render/frameBudget.ts", "tests/frameBudget.test.ts"],
    modifies: ["README.md", "package.json"],
  },
  {
    key: "overlay-marks",
    subject: "Render the first overlay marks",
    body: "Draw deterministic anchors and connection strokes with predictable depth ordering.",
    date: "2025-01-16T09:39:00Z",
    author: "nadia",
    parents: ["overlay-scaffold"],
    adds: ["src/render/marks.ts"],
    modifies: ["src/render/overlay.ts", "tests/overlay.test.ts"],
  },
  {
    key: "overlay-controls",
    subject: "Add overlay gesture controls",
    body: "Support pan, focus and mark selection without interrupting the orbit camera.",
    date: "2025-01-18T16:12:00Z",
    author: "nadia",
    parents: ["overlay-marks"],
    adds: ["src/render/overlayControls.ts"],
    modifies: ["src/render/overlay.ts", "tests/overlay.test.ts"],
  },
  {
    key: "replay",
    subject: "Add workspace session replay",
    body: "Capture frame sessions in memory and replay them against the ingest pipeline.",
    date: "2025-01-20T12:45:00Z",
    author: "mira",
    parents: ["frame-budget"],
    adds: [
      "src/workspace/session.ts",
      "src/workspace/replay.ts",
      "tests/replay.test.ts",
    ],
    modifies: ["package.json", "src/main.tsx"],
  },
  {
    key: "merge-overlay",
    subject: "Merge overlay canvas into the live workspace",
    body: "Bring the overlay branch into the replay workspace so marks can respond to stored sessions.",
    date: "2025-01-22T18:03:00Z",
    author: "mira",
    parents: ["replay", "overlay-controls"],
    adds: [
      "src/render/overlay.ts",
      "src/render/marks.ts",
      "src/render/overlayControls.ts",
      "tests/overlay.test.ts",
    ],
    modifies: ["src/main.tsx", "package.json"],
    tags: ["v0.4.0"],
  },
  {
    key: "vector-encoder",
    subject: "Prototype a vector tile encoder",
    body: "Spike a compact tile format for dense spatial traces. This branch remains exploratory.",
    date: "2025-01-24T11:27:00Z",
    author: "theo",
    parents: ["replay"],
    adds: ["src/render/vectorEncoder.ts", "bench/vectorTiles.bench.ts"],
    modifies: ["package.json"],
  },
  {
    key: "palette",
    subject: "Add command palette navigation",
    body: "Expose workspace jumps and history controls through a searchable command surface.",
    date: "2025-01-26T13:14:00Z",
    author: "jules",
    parents: ["merge-overlay"],
    adds: ["src/ui/CommandPalette.tsx", "src/ui/commandRegistry.ts"],
    modifies: ["src/main.tsx", "package.json"],
  },
  {
    key: "vector-bench",
    subject: "Benchmark vector tiles against the JSON tracer",
    body: "Record initial throughput and decode latency findings for the vector tile experiment.",
    date: "2025-01-27T17:02:00Z",
    author: "theo",
    parents: ["vector-encoder"],
    adds: [],
    modifies: ["bench/vectorTiles.bench.ts", "README.md"],
  },
  {
    key: "correlation",
    subject: "Introduce metric correlation panel",
    body: "Surface related signals for a selected spatial anchor with an explicit confidence label.",
    date: "2025-01-29T10:48:00Z",
    author: "nadia",
    parents: ["palette"],
    adds: [
      "src/insights/correlation.ts",
      "src/ui/CorrelationPanel.tsx",
      "tests/correlation.test.ts",
    ],
    modifies: ["src/ui/CommandPalette.tsx"],
  },
  {
    key: "share-scaffold",
    subject: "Add snapshot share link primitives",
    body: "Prepare compact revision links that can be embedded in review notes.",
    date: "2025-02-01T15:35:00Z",
    author: "jules",
    parents: ["correlation"],
    adds: ["src/share/link.ts", "src/share/embed.ts"],
    modifies: ["package.json"],
  },
  {
    key: "timeline-keyboard",
    subject: "Polish timeline keyboard controls",
    body: "Make revision stepping and playback controls usable without a pointer.",
    date: "2025-02-03T09:12:00Z",
    author: "mira",
    parents: ["correlation"],
    adds: ["src/ui/Timeline.tsx"],
    modifies: ["src/main.tsx", "src/ui/CommandPalette.tsx"],
  },
  {
    key: "embed-schema",
    subject: "Add embed schema versioning",
    body: "Version share payloads so older review embeds can be migrated safely.",
    date: "2025-02-05T14:40:00Z",
    author: "jules",
    parents: ["share-scaffold"],
    adds: ["src/share/schema.ts"],
    modifies: ["src/share/embed.ts"],
  },
  {
    key: "merge-share",
    subject: "Merge share-link workflow",
    body: "Combine timeline keyboard work with versioned embed primitives.",
    date: "2025-02-07T18:22:00Z",
    author: "mira",
    parents: ["timeline-keyboard", "embed-schema"],
    adds: ["src/share/link.ts", "src/share/embed.ts", "src/share/schema.ts"],
    modifies: ["src/main.tsx", "src/ui/CommandPalette.tsx", "package.json"],
    tags: ["v0.9.0"],
  },
  {
    key: "export-panel",
    subject: "Add diff legend and visualization export",
    body: "Ship an export surface, document snapshot limits, and retire the legacy adapter panel.",
    date: "2025-02-10T11:16:00Z",
    author: "theo",
    parents: ["merge-share"],
    adds: ["src/ui/ExportPanel.tsx", "docs/snapshot-limitations.md"],
    removes: ["src/core/legacy-adapter.ts", "src/ui/LegacyPanel.tsx"],
    modifies: ["src/main.tsx", "package.json"],
  },
  {
    key: "instancing",
    subject: "Optimize instanced scene rendering",
    body: "Batch node and mark rendering and trim per-frame allocations in dense sessions.",
    date: "2025-02-13T13:58:00Z",
    author: "nadia",
    parents: ["export-panel"],
    adds: ["src/render/instancing.ts"],
    modifies: ["src/render/marks.ts", "src/render/frameBudget.ts"],
  },
  {
    key: "release-docs",
    subject: "Prepare the 1.0 documentation pass",
    body: "Rename the vision document, add a changelog and clarify snapshot completeness in the README.",
    date: "2025-02-16T10:05:00Z",
    author: "jules",
    parents: ["instancing"],
    renames: [{ from: "docs/vision.md", to: "docs/product-vision.md" }],
    adds: ["CHANGELOG.md", "docs/release-checklist.md"],
    modifies: ["README.md", "package.json", "src/core/schema.ts"],
    tags: ["v1.0.0"],
  },
  {
    key: "fix-contrast",
    subject: "Fix light-surface contrast in side panels",
    body: "Raise quiet text contrast and add a tokenized focus treatment for low-light themes.",
    date: "2025-02-18T16:29:00Z",
    author: "nadia",
    parents: ["release-docs"],
    adds: ["src/a11y/focus.ts", "tests/focus.test.ts"],
    modifies: ["src/ui/CommandPalette.tsx"],
  },
  {
    key: "docs-limitations",
    subject: "Document incomplete history boundaries",
    body: "Explain how the explorer distinguishes loaded history from complete repository history.",
    date: "2025-02-19T12:54:00Z",
    author: "jules",
    parents: ["release-docs"],
    adds: ["docs/history-completeness.md"],
    modifies: ["README.md", "docs/snapshot-limitations.md"],
  },
  {
    key: "focus-rings",
    subject: "Refine keyboard focus rings",
    body: "Make focus states visible across both themes without relying on color alone.",
    date: "2025-02-20T09:37:00Z",
    author: "nadia",
    parents: ["fix-contrast"],
    adds: ["src/a11y/focusRing.ts"],
    modifies: ["src/a11y/focus.ts", "tests/focus.test.ts"],
  },
  {
    key: "merge-a11y",
    subject: "Merge accessibility contrast fixes",
    body: "Integrate the contrast branch with the completeness documentation update.",
    date: "2025-02-22T17:11:00Z",
    author: "mira",
    parents: ["docs-limitations", "focus-rings"],
    adds: [
      "src/a11y/focus.ts",
      "src/a11y/focusRing.ts",
      "tests/focus.test.ts",
    ],
    modifies: ["src/ui/CommandPalette.tsx", "package.json"],
  },
  {
    key: "qa-pass",
    subject: "Run the release accessibility and snapshot QA pass",
    body: "Cover keyboard traversal, empty snapshots and truncated comparison messaging.",
    date: "2025-02-25T14:19:00Z",
    author: "theo",
    parents: ["merge-a11y"],
    adds: ["tests/a11y.test.ts"],
    modifies: ["docs/snapshot-limitations.md", "README.md"],
  },
  {
    key: "ship-1-1",
    subject: "Ship Atlas Lens 1.1",
    body: "Finalize the 1.1 surface: accessible panels, versioned shares and bounded snapshot loading.",
    date: "2025-02-28T18:40:00Z",
    author: "mira",
    parents: ["qa-pass"],
    adds: ["docs/release-notes-1.1.md"],
    modifies: ["package.json", "README.md", "src/ui/Timeline.tsx"],
    tags: ["v1.1.0"],
  },
];

const BRANCH_TIPS: Record<string, string> = {
  main: "ship-1-1",
  "feature/overlay": "overlay-controls",
  "experiment/vector-tiles": "vector-bench",
};

const SPEC_BY_KEY = new Map(SPECS.map((spec) => [spec.key, spec]));
const SPEC_BY_SHA = new Map<string, DemoCommitSpec>();

function hashHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function longHash(input: string): string {
  let result = "";
  for (let index = 0; index < 5; index += 1) {
    result += hashHex(`${input}:${index}`);
  }
  return result.slice(0, 40);
}

export function demoShaFor(key: string): string {
  return longHash(`repowarp-atlas:${key}`);
}

const SHA_BY_KEY = new Map(SPECS.map((spec) => [spec.key, demoShaFor(spec.key)]));
for (const spec of SPECS) {
  SPEC_BY_SHA.set(demoShaFor(spec.key), spec);
}

function fileSize(path: string): number {
  const base = 280 + (parseInt(hashHex(path), 16) % 6800);
  if (path.endsWith(".md")) return base + 900;
  if (path.endsWith(".json")) return base + 300;
  if (path.endsWith(".tsx")) return base + 650;
  return base;
}

function fileSha(path: string, revision: string): string {
  return longHash(`${path}@${revision}`);
}

const treeCache = new Map<string, DemoTree>();

function treeFor(key: string): DemoTree {
  const cached = treeCache.get(key);
  if (cached) return cached;

  const spec = SPEC_BY_KEY.get(key);
  if (!spec) throw new Error(`Unknown demo commit: ${key}`);

  const tree: DemoTree = new Map();
  if (spec.parents[0]) {
    for (const [path, file] of treeFor(spec.parents[0])) {
      tree.set(path, { ...file });
    }
  }

  for (const path of spec.removes ?? []) {
    tree.delete(path);
  }

  for (const rename of spec.renames ?? []) {
    const file = tree.get(rename.from);
    if (!file) continue;
    tree.delete(rename.from);
    tree.set(rename.to, {
      sha: fileSha(rename.to, key),
      size: file.size,
      lastModified: SHA_BY_KEY.get(key) ?? key,
    });
  }

  for (const path of spec.adds) {
    tree.set(path, {
      sha: fileSha(path, key),
      size: fileSize(path),
      lastModified: SHA_BY_KEY.get(key) ?? key,
    });
  }

  for (const path of spec.modifies ?? []) {
    const existing = tree.get(path);
    tree.set(path, {
      sha: fileSha(path, key),
      size: existing ? Math.max(120, existing.size + 64) : fileSize(path),
      lastModified: SHA_BY_KEY.get(key) ?? key,
    });
  }

  treeCache.set(key, tree);
  return tree;
}

function demoTreeSha(key: string): string {
  const tree = treeFor(key);
  const material = [...tree.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, file]) => `${path}:${file.sha}`)
    .join("|");
  return longHash(`tree:${key}:${material}`);
}

function patchFor(path: string, addition: boolean, removal: boolean, key: string): string | null {
  if (parseInt(hashHex(`${path}:${key}`), 16) % 5 === 0) return null;
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (removal) {
    return [
      `@@ -1,3 +0,0 @@`,
      `-// ${name} — legacy path retired by Atlas Lens`,
      `-export function legacyAdapter() {`,
      `-  return null;`,
      `-}`,
    ].join("\n");
  }
  if (addition) {
    return [
      `@@ -0,0 +1,4 @@`,
      `+// ${name} — sample file from the RepoWarp demo fixture.`,
      `+export const revision = "${key}";`,
      `+export const surface = "atlas-lens";`,
      `+`,
    ].join("\n");
  }
  return [
    `@@ -1,4 +1,5 @@`,
    ` // ${name}`,
    `-const revision = "previous";`,
    `+const revision = "${key}";`,
    `+const mode = "spatial";`,
    ` `,
  ].join("\n");
}

function statsFor(path: string, status: FileChange["status"], key: string) {
  const seed = parseInt(hashHex(`${path}:${status}:${key}`), 16);
  if (status === "added") {
    const additions = 6 + (seed % 72);
    return { additions, deletions: 0, changes: additions };
  }
  if (status === "removed") {
    const deletions = 4 + (seed % 54);
    return { additions: 0, deletions, changes: deletions };
  }
  const additions = 1 + (seed % 18);
  const deletions = 1 + ((seed >> 4) % 12);
  return { additions, deletions, changes: additions + deletions };
}

function changeFor(
  path: string,
  status: FileChange["status"],
  key: string,
  previousPath?: string,
): FileChange {
  const stats = statsFor(path, status, key);
  const patch = patchFor(path, status === "added", status === "removed", key);
  return {
    path,
    previousPath,
    status,
    ...stats,
    patch: patch ?? undefined,
    patchAvailable: Boolean(patch),
  };
}

const patchIndexCache = new Map<string, CommitDetails>();

function buildDemoDetails(key: string): CommitDetails {
  const cached = patchIndexCache.get(key);
  if (cached) return cached;

  const spec = SPEC_BY_KEY.get(key);
  if (!spec) throw new Error(`Unknown demo commit: ${key}`);
  const author = AUTHORS[spec.author];
  const sha = SHA_BY_KEY.get(key) ?? "";
  const files: FileChange[] = [];

  for (const path of spec.adds) {
    files.push(changeFor(path, "added", key));
  }
  for (const path of spec.removes ?? []) {
    files.push(changeFor(path, "removed", key));
  }
  for (const rename of spec.renames ?? []) {
    files.push(changeFor(rename.to, "renamed", key, rename.from));
  }
  for (const path of spec.modifies ?? []) {
    if (files.some((file) => file.path === path)) continue;
    files.push(changeFor(path, "modified", key));
  }

  const additions = files.reduce((total, file) => total + file.additions, 0);
  const deletions = files.reduce((total, file) => total + file.deletions, 0);
  const missingPatches = files.filter((file) => !file.patchAvailable).length;

  const details: CommitDetails = {
    sha,
    subject: spec.subject,
    message: spec.body ? `${spec.subject}\n\n${spec.body}` : spec.subject,
    authorName: author.name,
    authorEmail: author.email,
    authorLogin: author.login,
    authorAvatarUrl: null,
    authoredAt: spec.date,
    committedAt: spec.date,
    parents: spec.parents.map((parent) => SHA_BY_KEY.get(parent) ?? parent),
    treeSha: demoTreeSha(key),
    stats: { total: additions + deletions, additions, deletions },
    files,
    fileListTruncated: false,
    htmlUrl: "",
    isMerge: spec.parents.length > 1,
    patchNote:
      missingPatches > 0
        ? `Patch content is intentionally absent for ${missingPatches} demo ${
            missingPatches === 1 ? "file" : "files"
          } to demonstrate a missing-patch state.`
        : null,
  };

  patchIndexCache.set(key, details);
  return details;
}

const refsBySha = new Map<string, string[]>();
const tagsBySha = new Map<string, string[]>();

for (const [branchName, tipKey] of Object.entries(BRANCH_TIPS)) {
  const sha = SHA_BY_KEY.get(tipKey);
  if (!sha) continue;
  refsBySha.set(sha, [...(refsBySha.get(sha) ?? []), branchName]);
}

for (const spec of SPECS) {
  for (const tag of spec.tags ?? []) {
    const sha = SHA_BY_KEY.get(spec.key);
    if (!sha) continue;
    tagsBySha.set(sha, [...(tagsBySha.get(sha) ?? []), tag]);
  }
}

export const DEMO_LATEST_KEY = "ship-1-1";
export const DEMO_FEATURED_KEY = "merge-overlay";
export const DEMO_LATEST_SHA = SHA_BY_KEY.get(DEMO_LATEST_KEY) ?? "";
export const DEMO_FEATURED_SHA = SHA_BY_KEY.get(DEMO_FEATURED_KEY) ?? "";

function toCommitRecord(spec: DemoCommitSpec): CommitRecord {
  const author = AUTHORS[spec.author];
  const sha = SHA_BY_KEY.get(spec.key) ?? spec.key;
  return {
    sha,
    subject: spec.subject,
    message: spec.body ? `${spec.subject}\n\n${spec.body}` : spec.subject,
    authorName: author.name,
    authorEmail: author.email,
    authorLogin: author.login,
    authorAvatarUrl: null,
    authoredAt: spec.date,
    committedAt: spec.date,
    parents: spec.parents.map((parent) => SHA_BY_KEY.get(parent) ?? parent),
    treeSha: demoTreeSha(spec.key),
    htmlUrl: "",
    isMerge: spec.parents.length > 1,
    refs: refsBySha.get(sha) ?? [],
    tags: tagsBySha.get(sha) ?? [],
  };
}

export const demoCommits: CommitRecord[] = SPECS.map(toCommitRecord).sort(
  (a, b) => new Date(b.committedAt ?? 0).getTime() - new Date(a.committedAt ?? 0).getTime(),
);

const demoCommitBySha = new Map(demoCommits.map((commit) => [commit.sha, commit]));

export const demoBranches: BranchRef[] = Object.entries(BRANCH_TIPS).map(
  ([name, tipKey]) => ({
    name,
    sha: SHA_BY_KEY.get(tipKey) ?? "",
    protected: name === "main",
  }),
);

export const demoTags: TagRef[] = SPECS.flatMap((spec) =>
  (spec.tags ?? []).map((name) => ({
    name,
    sha: SHA_BY_KEY.get(spec.key) ?? "",
  })),
).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

export const demoRepository: RepositoryInfo = {
  identity: {
    owner: "demo",
    name: "atlas-lens",
    fullName: "demo/atlas-lens",
  },
  description:
    "Atlas Lens is a fictional spatial observability studio, curated to demonstrate RepoWarp's history and snapshot tools. No GitHub requests are made in demo mode.",
  defaultBranch: "main",
  stars: 482,
  forks: 37,
  openIssues: 6,
  language: "TypeScript",
  license: "MIT",
  topics: ["demo-fixture", "spatial", "visualization", "observability"],
  htmlUrl: "",
  ownerAvatarUrl: "",
  updatedAt: "2025-02-28T18:40:00Z",
  pushedAt: "2025-02-28T18:40:00Z",
  archived: false,
  fork: false,
  sizeKb: 420,
  source: "demo",
};

function reachableKeys(tipKey: string): Set<string> {
  const result = new Set<string>();
  const queue = [tipKey];
  while (queue.length > 0) {
    const key = queue.pop();
    if (!key || result.has(key)) continue;
    result.add(key);
    const spec = SPEC_BY_KEY.get(key);
    if (!spec) continue;
    for (const parent of spec.parents) queue.push(parent);
  }
  return result;
}

export function demoRefHistory(refName: string): string[] | null {
  const tipKey = BRANCH_TIPS[refName];
  if (!tipKey) return null;
  const reachable = reachableKeys(tipKey);
  return demoCommits
    .filter((commit) => {
      const spec = SPEC_BY_SHA.get(commit.sha);
      return spec ? reachable.has(spec.key) : false;
    })
    .map((commit) => commit.sha);
}

export function getDemoCommitDetails(sha: string): CommitDetails | null {
  const spec = SPEC_BY_SHA.get(sha);
  if (!spec) return null;
  return buildDemoDetails(spec.key);
}

export function getDemoCommit(sha: string): CommitRecord | null {
  return demoCommitBySha.get(sha) ?? null;
}

function buildEntries(key: string): SnapshotEntry[] {
  const tree = treeFor(key);
  const directories = new Set<string>();
  for (const path of tree.keys()) {
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }

  const entries: SnapshotEntry[] = [];
  for (const path of directories) {
    entries.push({
      path,
      name: path.slice(path.lastIndexOf("/") + 1),
      type: "tree",
      sha: longHash(`dir:${key}:${path}`),
      size: null,
      mode: "040000",
      parentPath: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
      depth: path.split("/").length - 1,
      extension: null,
    });
  }
  for (const [path, file] of tree) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    entries.push({
      path,
      name,
      type: "blob",
      sha: file.sha,
      size: file.size,
      mode: "100644",
      parentPath: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
      depth: path.split("/").length - 1,
      extension: dot > 0 ? name.slice(dot + 1).toLowerCase() : null,
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

const snapshotCache = new Map<string, RepositorySnapshot>();

export function getDemoSnapshot(sha: string): RepositorySnapshot | null {
  const cached = snapshotCache.get(sha);
  if (cached) return cached;
  const spec = SPEC_BY_SHA.get(sha);
  if (!spec) return null;
  const details = buildDemoDetails(spec.key);
  const snapshot: RepositorySnapshot = {
    commitSha: sha,
    treeSha: details.treeSha ?? "",
    entries: buildEntries(spec.key),
    truncated: false,
    lazy: false,
    partialReason: null,
    loadedDirs: [],
    expandedDirs: [],
    changeFiles: details.files,
    changeBaseSha: details.parents[0] ?? null,
    fetchedAt: new Date().toISOString(),
  };
  snapshotCache.set(sha, snapshot);
  return snapshot;
}

export function demoComparison(base: string, target: string): ComparisonResult {
  const baseSpec = SPEC_BY_SHA.get(base);
  const targetSpec = SPEC_BY_SHA.get(target);
  if (!baseSpec || !targetSpec) {
    throw new GitHubApiError({
      kind: "not_found",
      message: "One of the comparison revisions is not part of the demo fixture.",
      status: 404,
    });
  }

  const targetReachable = reachableKeys(targetSpec.key);
  const baseReachable = reachableKeys(baseSpec.key);
  const aheadKeys = [...targetReachable].filter((key) => !baseReachable.has(key));
  const behindKeys = [...baseReachable].filter((key) => !targetReachable.has(key));

  let status: ComparisonResult["status"] = "diverged";
  if (base === target) status = "identical";
  else if (behindKeys.length === 0) status = "ahead";
  else if (aheadKeys.length === 0) status = "behind";

  const commitKeys = status === "behind" ? behindKeys : aheadKeys;
  const commits = demoCommits
    .filter((commit) => {
      const spec = SPEC_BY_SHA.get(commit.sha);
      return spec ? commitKeys.includes(spec.key) : false;
    })
    .reverse();

  const baseTree = treeFor(baseSpec.key);
  const targetTree = treeFor(targetSpec.key);
  const allPaths = new Set([...baseTree.keys(), ...targetTree.keys()]);
  const files: FileChange[] = [];

  for (const path of allPaths) {
    const baseFile = baseTree.get(path);
    const targetFile = targetTree.get(path);
    if (!baseFile && targetFile) {
      files.push(changeFor(path, "added", targetSpec.key));
    } else if (baseFile && !targetFile) {
      files.push(changeFor(path, "removed", baseSpec.key));
    } else if (baseFile && targetFile && baseFile.sha !== targetFile.sha) {
      files.push(changeFor(path, "modified", targetSpec.key));
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    base,
    target,
    status,
    aheadBy: status === "behind" ? 0 : aheadKeys.length,
    behindBy: status === "behind" ? behindKeys.length : status === "diverged" ? behindKeys.length : 0,
    totalCommits: commits.length,
    commits,
    files,
    commitsIncomplete: false,
    filesMayBeIncomplete: false,
    htmlUrl: null,
  };
}

export function demoCommitDateRange(): { first: string; last: string } {
  return {
    first: "2025-01-08",
    last: "2025-02-28",
  };
}

export function getDemoPreviewCommits(): CommitRecord[] {
  const interesting = new Set([
    "merge-overlay",
    "overlay-controls",
    "replay",
    "palette",
    "correlation",
    "timeline-keyboard",
    "merge-share",
    "export-panel",
    "instancing",
    "release-docs",
  ]);
  return demoCommits.filter((commit) => {
    const spec = SPEC_BY_SHA.get(commit.sha);
    return spec ? interesting.has(spec.key) : false;
  });
}
