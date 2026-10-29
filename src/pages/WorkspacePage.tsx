import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Boxes,
  GitBranch,
  Orbit,
  Play,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/layout/SiteHeader";
import { RepositoryInput } from "../components/ui/RepositoryInput";
import { IconButton, LinkButton } from "../components/ui/Button";
import { HistoryScene } from "../three/history/HistoryScene";
import { layoutGraph } from "../features/history/graphLayout";
import { DEMO_FEATURED_SHA, demoCommits } from "../fixtures/demo/atlas";
import { usePreferencesStore } from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { demoHref, explorationHref } from "../utils/urlState";
import { formatCompact, formatRelative } from "../utils/format";

const SUGGESTED = [
  {
    owner: "react",
    name: "react",
    label: "React",
    description: "Years of component architecture, concurrent rendering, and release branches.",
    language: "JavaScript",
    tags: ["UI", "framework"],
  },
  {
    owner: "vercel",
    name: "next.js",
    label: "Next.js",
    description: "A fast-moving full-stack framework with a long, deeply branched history.",
    language: "JavaScript",
    tags: ["framework", "web"],
  },
  {
    owner: "rust-lang",
    name: "rust",
    label: "Rust",
    description: "Language evolution at compiler scale, with merges and release trains.",
    language: "Rust",
    tags: ["language", "compiler"],
  },
  {
    owner: "mrdoob",
    name: "three.js",
    label: "Three.js",
    description: "The long arc of real-time 3D on the web, from scenes to shaders.",
    language: "JavaScript",
    tags: ["3D", "graphics"],
  },
  {
    owner: "tailwindlabs",
    name: "tailwindcss",
    label: "Tailwind CSS",
    description: "Utility-first styling and the evolution of a design toolchain.",
    language: "TypeScript",
    tags: ["CSS", "tooling"],
  },
  {
    owner: "honojs",
    name: "hono",
    label: "Hono",
    description: "A compact web framework with a rich, registry-heavy repository.",
    language: "TypeScript",
    tags: ["server", "web"],
  },
];

export function WorkspacePage() {
  useDocumentTitle("Workspace — RepoWarp");
  const recents = usePreferencesStore((state) => state.recentRepositories);
  const removeRecent = usePreferencesStore((state) => state.removeRecent);
  const clearRecents = usePreferencesStore((state) => state.clearRecents);
  const pushToast = useToastStore((state) => state.push);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem]" aria-hidden="true">
        <div className="aurora animate-drift left-[-10rem] top-[-12rem] h-[30rem] w-[30rem] bg-aqua/[0.16]" />
        <div className="aurora right-[8%] top-[-14rem] h-[32rem] w-[32rem] bg-violet/[0.14]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--c-line)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-line)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at 50% 10%, black, transparent 66%)",
          }}
        />
      </div>

      <SiteHeader variant="workspace" />

      <main className="relative z-10 mx-auto max-w-[86rem] px-4 pb-20 pt-8 sm:px-7 sm:pt-12 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="reveal eyebrow">Workspace</p>
          <h1 className="reveal reveal-delay-1 mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-ink sm:text-5xl">
            Choose a repository
            <span className="text-faint"> to warp.</span>
          </h1>
          <p className="reveal reveal-delay-2 mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Paste any public GitHub repository. The first page of its selected
            branch loads immediately; deeper history is available on demand.
          </p>
          <div className="reveal reveal-delay-3 mx-auto mt-7 max-w-2xl">
            <RepositoryInput autoFocus />
          </div>
          <div className="reveal reveal-delay-4 mt-2 flex flex-wrap items-center justify-center gap-2">
            <LinkButton
              to={demoHref("history")}
              variant="soft"
              size="sm"
              icon={<Play size={13} />}
            >
              Open curated demo
            </LinkButton>
            <span className="chip">
              <Sparkles size={11} /> No API requests in demo
            </span>
          </div>
        </div>

        {recents.length > 0 ? (
          <section data-reveal className="mt-14">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Local history</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-ink">
                  Continue where you left off
                </h2>
              </div>
              <button
                type="button"
                className="text-[0.68rem] font-medium text-faint transition hover:text-rose"
                onClick={() => {
                  clearRecents();
                  pushToast({
                    tone: "info",
                    title: "Recent repositories cleared",
                    message: "Only the local list was removed. Your preferences are intact.",
                  });
                }}
              >
                Clear all
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recents.map((recent) => (
                <div
                  key={`${recent.owner}/${recent.name}`}
                  className="group relative overflow-hidden rounded-xl border border-line/80 bg-panel/55 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-aqua/35 hover:bg-panel/75 hover:shadow-[0_16px_45px_rgb(var(--c-aqua)/0.07)]"
                >
                  <Link
                    to={explorationHref(recent.owner, recent.name, {
                      view: recent.lastView,
                      commit: recent.lastCommitSha,
                    })}
                    className="block rounded-lg focus-visible:outline-offset-6"
                  >
                    <div className="flex items-start justify-between gap-6 pr-7">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[0.72rem] text-muted">
                          {recent.owner}/
                          <span className="font-semibold text-ink">{recent.name}</span>
                        </p>
                        <p className="mt-2 line-clamp-2 min-h-8 text-[0.73rem] leading-relaxed text-muted">
                          {recent.description ?? "Public GitHub repository"}
                        </p>
                      </div>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated/60 text-faint transition group-hover:border-aqua/35 group-hover:text-aqua">
                        <ArrowUpRight size={14} />
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="chip !h-6">
                        {recent.lastView === "codebase" ? <Boxes size={10} /> : <Orbit size={10} />}
                        {recent.lastView}
                      </span>
                      {recent.lastCommitSha ? (
                        <span className="chip !h-6 font-mono !text-[0.57rem]">
                          {recent.lastCommitSha.slice(0, 7)}
                        </span>
                      ) : null}
                      <span className="ml-auto text-[0.61rem] text-faint">
                        {formatRelative(new Date(recent.lastOpenedAt).toISOString())}
                      </span>
                    </div>
                  </Link>
                  <IconButton
                    label={`Remove ${recent.owner}/${recent.name} from recents`}
                    className="absolute right-3 top-3 h-7 w-7 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => removeRecent(recent.owner, recent.name)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section
            data-reveal
            className="mt-14 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]"
          >
            <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-panel/45 p-6 sm:p-8">
              <div
                className="aurora right-[-7rem] top-[-8rem] h-56 w-56 bg-violet/[0.1]"
                aria-hidden="true"
              />
              <div className="relative z-10">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-aqua/25 bg-aqua/10 text-aqua">
                  <GitBranch size={19} aria-hidden="true" />
                </span>
                <p className="mt-5 eyebrow">No local trail yet</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-ink">
                  Your recent warps will appear here
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  RepoWarp keeps up to eight recently opened public repositories in
                  this browser. Demo fixtures stay out of your trail, so the list
                  only reflects real exploration.
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["8", "local slots"],
                    ["0", "tokens"],
                    ["1", "browser"],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-line/70 bg-base/30 px-3 py-2.5"
                    >
                      <p className="font-mono text-sm font-semibold text-ink">{value}</p>
                      <p className="mt-0.5 text-[0.57rem] uppercase tracking-[0.12em] text-faint">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <LinkButton
                    to={demoHref("history")}
                    variant="primary"
                    size="sm"
                    icon={<Play size={13} />}
                  >
                    Start with Atlas Lens
                  </LinkButton>
                  <Link
                    to="/#features"
                    className="inline-flex items-center gap-1.5 px-2 text-[0.7rem] font-medium text-faint transition hover:text-ink"
                  >
                    See how it works <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
            <AtlasPreview />
          </section>
        )}

        <section data-reveal className="mt-16">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Suggested starting points</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-ink">
                Repositories with history worth seeing
              </h2>
            </div>
            <span className="hidden chip sm:inline-flex">
              <Star size={10} /> Public · live API
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {SUGGESTED.map((repo, index) => (
              <Link
                key={`${repo.owner}/${repo.name}`}
                data-reveal
                data-reveal-delay={String((index % 3) + 1)}
                to={explorationHref(repo.owner, repo.name, { view: "history" })}
                className="group relative overflow-hidden rounded-xl border border-line/75 bg-panel/40 p-4 transition duration-300 hover:-translate-y-1 hover:border-violet/35 hover:bg-panel/70 hover:shadow-[0_18px_50px_rgb(var(--c-violet)/0.08)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-elevated/50 text-violet">
                      <GitBranch size={13} />
                    </span>
                    <p className="font-mono text-[0.72rem]">
                      <span className="text-faint">{repo.owner}/</span>
                      <span className="font-semibold text-ink">{repo.name}</span>
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="text-faint transition group-hover:text-aqua" />
                </div>
                <p className="mt-3 text-[0.74rem] leading-relaxed text-muted">
                  {repo.description}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {repo.tags.map((tag) => (
                    <span key={tag} className="chip !h-5 !text-[0.54rem]">
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto text-[0.6rem] text-faint">{repo.language}</span>
                </div>
                <div className="pointer-events-none absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-violet/[0.04] blur-2xl transition group-hover:bg-violet/[0.11]" />
              </Link>
            ))}
          </div>
        </section>

        <section data-reveal className="mt-16 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-aqua/20 bg-panel/55 p-6 sm:p-8">
            <div className="aurora right-[-6rem] top-[-8rem] h-64 w-64 bg-aqua/[0.12]" aria-hidden="true" />
            <div className="relative z-10">
              <span className="chip chip-aqua">
                <Sparkles size={11} /> Curated fixture
              </span>
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.035em] text-ink">
                Atlas Lens
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
                A fictional spatial observability studio with 26 connected commits,
                two merges, multiple branches, tags, historical trees, and complete
                comparison data. No GitHub requests, no waiting.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <LinkButton
                  to={demoHref("history")}
                  variant="primary"
                  icon={<Orbit size={15} />}
                >
                  Warp the demo
                </LinkButton>
                <LinkButton
                  to={demoHref("codebase", undefined)}
                  variant="ghost"
                  icon={<Boxes size={15} />}
                >
                  Open codebase lens
                </LinkButton>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line/80 bg-panel/40 p-6">
            <p className="panel-kicker">Request honesty</p>
            <p className="mt-3 text-sm font-semibold text-ink">Anonymous GitHub limits</p>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-muted">
              GitHub allows 60 unauthenticated REST requests per hour per IP. RepoWarp
              batches its initial requests, caches pages, and surfaces rate-limit
              resets. If the limit is reached, live history stops; demo mode keeps
              working.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[0.66rem] text-faint">
              <ShieldBadge />
              No token is requested or stored.
            </div>
          </div>
        </section>

        <section className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.66rem] text-faint">
          <span>{formatCompact(recents.length)} local recents</span>
          <span aria-hidden="true">·</span>
          <span>Deep links preserve view, branch, commit, and comparison</span>
          <span aria-hidden="true">·</span>
          <Link to="/" className="text-muted hover:text-ink">
            About RepoWarp
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function AtlasPreview() {
  const theme = usePreferencesStore((state) => state.theme);
  const showGrid = usePreferencesStore((state) => state.showSceneGrid);
  const reduced = useReduceMotion();
  const layout = useMemo(() => layoutGraph(demoCommits), []);

  return (
    <div className="stage-shell noise relative min-h-[19rem] overflow-hidden rounded-2xl border border-line/80 bg-panel/25">
      <div className="stage-grid opacity-30" aria-hidden="true" />
      <div className="absolute inset-0">
        <HistoryScene
          layout={layout}
          selectedSha={DEMO_FEATURED_SHA}
          theme={theme}
          showGrid={showGrid}
          reduceMotion={reduced}
          interactive={false}
          autoRotate
          preview
          className="h-full w-full"
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="glass rounded-xl px-2.5 py-1.5">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-aqua">
            Atlas Lens
          </p>
          <p className="mt-0.5 text-[0.62rem] text-muted">live fixture preview</p>
        </div>
        <span className="glass rounded-full px-2.5 py-1 font-mono text-[0.55rem] text-faint">
          auto-orbit
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-base/80 via-base/30 to-transparent p-4 pt-14">
        <div className="flex items-center gap-2 text-[0.6rem] text-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-aqua shadow-[0_0_10px_rgb(var(--c-aqua))]" />
          26 commits · 2 merges · 4 tags
        </div>
        <span className="font-mono text-[0.54rem] text-faint">open to explore</span>
      </div>
    </div>
  );
}

function ShieldBadge() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal/25 bg-teal/10 text-teal">
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
        <path
          d="M12 3l7 3v5c0 4.4-2.8 7.8-7 9-4.2-1.2-7-4.6-7-9V6l7-3z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
