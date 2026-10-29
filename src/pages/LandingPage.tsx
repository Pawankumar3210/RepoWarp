import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Clock3,
  Download,
  FileCode2,
  GitBranch,
  GitCompareArrows,
  GitMerge,
  Layers3,
  Orbit,
  Play,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/layout/SiteHeader";
import { HeroPreview } from "../components/landing/HeroPreview";
import { RepositoryInput } from "../components/ui/RepositoryInput";
import { LinkButton } from "../components/ui/Button";
import { usePreferencesStore } from "../store/preferencesStore";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { demoHref, explorationHref } from "../utils/urlState";
import { formatCompact, formatRelative } from "../utils/format";

const EXAMPLES = [
  {
    owner: "react",
    name: "react",
    label: "React",
    note: "The UI library that reshaped component thinking.",
  },
  {
    owner: "vercel",
    name: "next.js",
    label: "Next.js",
    note: "A deep history of the full-stack React framework.",
  },
  {
    owner: "rust-lang",
    name: "rust",
    label: "Rust",
    note: "A decade of language and compiler evolution.",
  },
  {
    owner: "mrdoob",
    name: "three.js",
    label: "Three.js",
    note: "The 3D web, commit by commit.",
  },
];

const FEATURES = [
  {
    icon: Orbit,
    title: "History Warp",
    body: "Commit lanes become a traversable 3D spine. Branch refs, merges, tags, and unloaded boundaries stay legible while you scrub through time.",
  },
  {
    icon: Boxes,
    title: "Codebase Warp",
    body: "Pause on any commit to reconstruct its tree as a floating city of directories and files, color-coded by type and annotated with what changed.",
  },
  {
    icon: Clock3,
    title: "Honest time travel",
    body: "Playback, next-parent navigation, and comparisons only use what was actually loaded. Missing history is stated, never invented.",
  },
  {
    icon: Download,
    title: "Take it with you",
    body: "Share deep links, copy the current state, or export loaded history as JSON, CSV, or a composed PNG of the active visualization.",
  },
];

function HistoryMini() {
  return (
    <svg viewBox="0 0 340 130" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="landing-history-line" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="rgb(var(--c-aqua))" />
          <stop offset="1" stopColor="rgb(var(--c-violet))" />
        </linearGradient>
      </defs>
      <path d="M12 88 C72 88 78 42 138 42 S206 88 264 88 314 26 330 26" fill="none" stroke="url(#landing-history-line)" strokeWidth="1.7" opacity="0.8" />
      <path className="mini-history-dash" d="M12 58 C70 58 96 92 156 92 S218 50 264 50 314 72 330 72" fill="none" stroke="rgb(var(--c-violet))" strokeWidth="1.2" opacity="0.45" strokeDasharray="4 5" />
      {[
        [12, 88],
        [72, 70],
        [138, 42],
        [198, 66],
        [264, 88],
        [300, 52],
        [330, 26],
      ].map(([x, y], index) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={index === 2 ? 5.5 : 3.4} fill={index === 2 ? "rgb(var(--c-aqua))" : "rgb(var(--c-violet))"} />
          <circle cx={x} cy={y} r="11" fill="none" stroke="rgb(var(--c-aqua))" opacity={index === 2 ? 0.35 : 0.08} />
        </g>
      ))}
      <g opacity="0.5">
        <line x1="12" y1="112" x2="330" y2="112" stroke="rgb(var(--c-line))" strokeWidth="1" />
        <text x="12" y="126" fill="rgb(var(--c-faint))" fontSize="7" fontFamily="monospace">OLDER</text>
        <text x="296" y="126" fill="rgb(var(--c-faint))" fontSize="7" fontFamily="monospace">NEWER</text>
      </g>
    </svg>
  );
}

function CodebaseMini() {
  const bars = [
    [18, 34],
    [34, 62],
    [48, 44],
    [62, 78],
    [78, 54],
    [92, 96],
    [110, 66],
    [126, 82],
    [142, 46],
    [158, 104],
    [174, 72],
    [190, 56],
    [206, 90],
    [222, 64],
    [238, 38],
    [254, 80],
    [270, 60],
    [286, 92],
    [302, 46],
  ] as Array<[number, number]>;
  return (
    <svg viewBox="0 0 340 130" className="h-full w-full" aria-hidden="true">
      <ellipse cx="170" cy="112" rx="146" ry="15" fill="rgb(var(--c-platform))" opacity="0.6" />
      {bars.map(([x, h], index) => (
        <g key={x}>
          <rect
            className="mini-bar"
            x={x}
            y={112 - h}
            width={8}
            height={h}
            rx="2"
            style={{
              transformBox: "fill-box",
              transformOrigin: "bottom",
              transitionDelay: `${index * 16}ms`,
            }}
            fill={
              index % 4 === 0
                ? "rgb(var(--c-amber))"
                : index % 5 === 0
                  ? "rgb(var(--c-violet))"
                  : "rgb(var(--c-aqua))"
            }
            opacity={0.38 + (index % 4) * 0.14}
          />
          <rect x={x} y={112 - h} width={8} height="2" rx="1" fill="rgb(var(--c-ink))" opacity="0.28" />
        </g>
      ))}
      <g opacity="0.55" stroke="rgb(var(--c-line))">
        <line x1="8" y1="112" x2="332" y2="112" />
        <line x1="8" y1="92" x2="332" y2="92" strokeDasharray="2 6" />
      </g>
    </svg>
  );
}

export function LandingPage() {
  useDocumentTitle("RepoWarp — Travel Through the Evolution of Code");
  const recents = usePreferencesStore((state) => state.recentRepositories);

  return (
    <div className="landing-space relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[54rem] overflow-hidden" aria-hidden="true">
      </div>

      <SiteHeader />

      <main className="relative z-10">
        <section className="mx-auto max-w-[86rem] px-4 pb-14 pt-10 sm:px-7 sm:pt-16 lg:px-10 lg:pb-20">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="reveal reveal-delay-1 font-display text-[2.65rem] font-bold leading-[0.96] tracking-[-0.055em] text-ink sm:text-6xl lg:text-[5.1rem]">
              Travel through the
              <br />
              <span className="text-gradient">evolution</span> of code.
            </h1>
            <p className="reveal reveal-delay-2 mx-auto mt-5 max-w-2xl text-[0.95rem] leading-relaxed text-muted sm:text-[1.04rem]">
              Turn any public GitHub repository into a navigable 3D atlas. Walk its
              commit history, pause inside a moment, and explore the codebase exactly
              as it existed then.
            </p>
          </div>

          <div className="reveal reveal-delay-3 mx-auto mt-8 max-w-2xl sm:mt-9">
            <RepositoryInput />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <LinkButton
                to={demoHref("history")}
                variant="soft"
                size="sm"
                icon={<Play size={13} />}
              >
                Try the curated demo
              </LinkButton>
              <LinkButton
                to="/workspace"
                variant="ghost"
                size="sm"
                icon={<ArrowUpRight size={13} />}
              >
                Open workspace
              </LinkButton>
              <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
              {EXAMPLES.slice(0, 3).map((example) => (
                <Link
                  key={example.label}
                  to={explorationHref(example.owner, example.name, { view: "history" })}
                  className="font-mono text-[0.63rem] text-faint transition hover:text-aqua"
                >
                  {example.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="reveal reveal-delay-4 relative mx-auto mt-10 max-w-6xl sm:mt-12">
            <div
              className="absolute -inset-8 rounded-[3rem] bg-black/[0.12] blur-3xl"
              aria-hidden="true"
            />
            <HeroPreview />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <p className="flex items-center gap-2 text-[0.67rem] text-faint">
                <ShieldCheck size={13} className="text-teal" aria-hidden="true" />
                Public GitHub data only. No account, backend, or stored credentials.
              </p>
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-faint">
                Drag · orbit · zoom · pause
              </p>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line/80 bg-line/60 sm:grid-cols-4">
            {[
              ["02", "synchronized lenses"],
              ["50", "commits per GitHub page"],
              ["0", "accounts or tokens"],
              ["1", "URL that holds your view"],
            ].map(([value, label]) => (
              <div key={label} className="bg-panel/70 px-4 py-5 text-center sm:px-6">
                <p className="font-display text-2xl font-semibold tracking-tight text-ink">
                  {value}
                </p>
                <p className="mt-1 text-[0.65rem] leading-snug text-faint">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="features"
          data-reveal
          className="relative mx-auto max-w-[86rem] px-4 py-16 sm:px-7 lg:px-10 lg:py-24"
        >
          <div className="mb-10 flex flex-col gap-4 sm:mb-14 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Two lenses, one timeline</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.06] tracking-[-0.045em] text-ink sm:text-4xl lg:text-[3.2rem]">
                See history as a place,
                <br className="hidden sm:block" /> not a list.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              RepoWarp keeps the commit you selected when you move between spatial
              history and historical code. The timeline is the constant.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <article
              data-reveal
              data-reveal-delay="1"
              className="group relative overflow-hidden rounded-[1.4rem] border border-line/80 bg-panel/55 p-5 transition duration-300 hover:-translate-y-1 hover:border-aqua/35 hover:bg-panel/75 hover:shadow-[0_22px_70px_rgb(var(--c-aqua)/0.08)] sm:p-7 lg:col-span-7"
            >
              <div className="relative z-10 max-w-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-aqua/25 bg-aqua/10 text-aqua">
                  <Orbit size={19} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                  History Warp
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  Follow a glowing commit spine through lanes, merges, and tags. Select
                  any revision, inspect its changes, and continue forward or backward
                  through loaded history.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="chip">
                    <GitMerge size={11} /> merge lanes
                  </span>
                  <span className="chip">
                    <Waypoints size={11} /> parent paths
                  </span>
                  <span className="chip">
                    <GitBranch size={11} /> ref markers
                  </span>
                </div>
              </div>
              <div className="relative z-10 mt-7 h-32 opacity-80 transition duration-500 group-hover:opacity-100">
                <HistoryMini />
              </div>
              <div className="absolute -right-20 -top-24 h-60 w-60 rounded-full bg-aqua/[0.07] blur-3xl transition group-hover:bg-aqua/[0.12]" aria-hidden="true" />
            </article>

            <article
              data-reveal
              data-reveal-delay="2"
              className="group relative overflow-hidden rounded-[1.4rem] border border-line/80 bg-panel/55 p-5 transition duration-300 hover:-translate-y-1 hover:border-violet/35 hover:bg-panel/75 hover:shadow-[0_22px_70px_rgb(var(--c-violet)/0.08)] sm:p-7 lg:col-span-5"
            >
              <div className="relative z-10">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet/25 bg-violet/10 text-violet">
                  <Boxes size={19} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                  Codebase Warp
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  Pause on a commit and the tree materializes as a code city.
                  Directories become platforms, files become pillars, and the diff
                  glows at the top of what changed.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="chip chip-violet">
                    <FileCode2 size={11} /> file pillars
                  </span>
                  <span className="chip chip-violet">
                    <Layers3 size={11} /> change markers
                  </span>
                </div>
              </div>
              <div className="relative z-10 mt-6 h-32 opacity-80 transition duration-500 group-hover:opacity-100">
                <CodebaseMini />
              </div>
              <div className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-violet/[0.07] blur-3xl transition group-hover:bg-violet/[0.13]" aria-hidden="true" />
            </article>

            {FEATURES.slice(2).map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  data-reveal
                  data-reveal-delay={index === 0 ? "1" : "2"}
                  className="group relative overflow-hidden rounded-[1.25rem] border border-line/80 bg-panel/45 p-5 transition duration-300 hover:-translate-y-1 hover:border-line hover:bg-panel/70 hover:shadow-[0_18px_55px_rgb(var(--c-ink)/0.05)] sm:p-6 lg:col-span-6"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        index === 0
                          ? "border-amber/25 bg-amber/10 text-amber"
                          : "border-teal/25 bg-teal/10 text-teal"
                      }`}
                    >
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold tracking-[-0.025em] text-ink">
                        {feature.title}
                      </h3>
                      <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted">
                        {feature.body}
                      </p>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-4 right-4 opacity-[0.07] transition group-hover:opacity-[0.13]">
                    <Icon size={84} aria-hidden="true" />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="how-it-works"
          data-reveal
          className="relative border-y border-line/60 bg-panel/25"
        >
          <div className="mx-auto max-w-[86rem] px-4 py-16 sm:px-7 lg:px-10 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">From URL to atlas</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
                Three moves. No setup.
              </h2>
            </div>
            <div className="relative mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
              <div className="absolute left-[16.6%] right-[16.6%] top-6 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" aria-hidden="true" />
              {[
                {
                  number: "01",
                  title: "Drop a public repository",
                  body: "Paste a GitHub URL or owner/name. RepoWarp validates it and requests only public metadata.",
                },
                {
                  number: "02",
                  title: "Warp into the graph",
                  body: "The latest page of branch history is loaded and laid out as an explorable commit spine.",
                },
                {
                  number: "03",
                  title: "Pause, inspect, compare",
                  body: "Travel through time, reconstruct a tree, compare revisions, and export exactly what you see.",
                },
              ].map((step, index) => (
                <div
                  key={step.number}
                  data-reveal
                  data-reveal-delay={String(index + 1)}
                  className="relative rounded-2xl border border-line/75 bg-base/30 p-5 transition duration-300 hover:-translate-y-1 hover:border-aqua/30 sm:p-6"
                >
                  <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-aqua/30 bg-base font-mono text-[0.66rem] font-semibold text-aqua shadow-[0_0_30px_rgb(var(--c-aqua)/0.12)]">
                    {step.number}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-[-0.025em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.82rem] leading-relaxed text-muted">{step.body}</p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-[0.7rem] leading-relaxed text-faint">
              Live repositories are subject to GitHub&apos;s anonymous API limits.
              RepoWarp shows rate-limit state and incomplete data instead of hiding it.
            </p>
          </div>
        </section>

        {recents.length > 0 ? (
          <section data-reveal className="mx-auto max-w-[86rem] px-4 py-14 sm:px-7 lg:px-10">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Continue exploring</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-ink sm:text-3xl">
                  Your recent repositories
                </h2>
              </div>
              <Link to="/workspace" className="text-[0.72rem] font-semibold text-muted transition hover:text-ink">
                Workspace
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recents.slice(0, 3).map((recent) => (
                <Link
                  key={`${recent.owner}/${recent.name}`}
                  to={explorationHref(recent.owner, recent.name, {
                    view: recent.lastView,
                    commit: recent.lastCommitSha,
                  })}
                  className="group rounded-xl border border-line/80 bg-panel/45 p-4 transition hover:border-aqua/35 hover:bg-panel/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-mono text-[0.75rem] font-medium text-ink">
                      {recent.owner}/{recent.name}
                    </p>
                    <ArrowUpRight size={14} className="text-faint transition group-hover:text-aqua" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[0.74rem] leading-relaxed text-muted">
                    {recent.description ?? "Public GitHub repository"}
                  </p>
                  <p className="mt-3 flex items-center gap-3 font-mono text-[0.58rem] text-faint">
                    <span>{recent.language ?? "Unknown language"}</span>
                    <span>{formatCompact(recent.stars)} stars</span>
                    <span>{formatRelative(new Date(recent.lastOpenedAt).toISOString())}</span>
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section
          data-reveal
          className="mx-auto max-w-[86rem] px-4 py-14 sm:px-7 lg:px-10 lg:py-20"
        >
          <div className="relative overflow-hidden rounded-[1.6rem] border border-aqua/20 bg-panel/60 px-5 py-10 sm:px-10 sm:py-12 lg:px-14">
            <div className="relative z-10 flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <p className="eyebrow flex items-center gap-2">
                  <Sparkles size={12} className="text-aqua" /> Start somewhere real
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.06] tracking-[-0.045em] text-ink sm:text-4xl">
                  Open a repository you know.
                  <br />
                  Watch it become unfamiliar.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                  Or step into Atlas Lens, a fully curated fictional repository built
                  to demonstrate merges, tags, comparisons, and historical trees
                  without spending a single API request.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                <LinkButton
                  to={demoHref("history")}
                  variant="primary"
                  size="lg"
                  icon={<Play size={16} />}
                >
                  Enter the demo
                </LinkButton>
                <LinkButton
                  to="/workspace"
                  variant="outline"
                  size="lg"
                  icon={<ArrowRight size={16} />}
                >
                  Open workspace
                </LinkButton>
              </div>
            </div>
          </div>
        </section>

        <section
          data-reveal
          className="mx-auto max-w-[86rem] px-4 pb-16 sm:px-7 lg:px-10"
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow">Public repositories worth wandering</p>
            <Link to="/workspace" className="text-[0.7rem] font-medium text-muted hover:text-ink">
              More in workspace
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EXAMPLES.map((example) => (
              <Link
                key={`${example.owner}/${example.name}`}
                to={explorationHref(example.owner, example.name, { view: "history" })}
                className="group rounded-xl border border-line/70 bg-panel/35 p-4 transition hover:border-violet/35 hover:bg-panel/60"
              >
                <div className="flex items-center gap-2">
                  <GitBranch size={13} className="text-violet" aria-hidden="true" />
                  <span className="font-mono text-[0.68rem] text-muted">
                    {example.owner}/
                  </span>
                  <span className="font-mono text-[0.72rem] font-semibold text-ink">
                    {example.name}
                  </span>
                </div>
                <p className="mt-2 text-[0.73rem] leading-relaxed text-faint">{example.note}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[0.65rem] font-medium text-aqua opacity-0 transition group-hover:opacity-100">
                  Warp in <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section
          data-reveal
          className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-7"
        >
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-panel/60">
            <GitCompareArrows size={20} className="text-aqua" aria-hidden="true" />
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl">
            Built for curiosity, not surveillance.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            RepoWarp runs entirely in your browser. Your theme, playback speed, and
            recent repositories stay in local storage. Your shared view lives in the
            URL. There is no RepoWarp account and no server collecting your trail.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
