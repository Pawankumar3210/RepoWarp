import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Play } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/layout/SiteHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { demoHref } from "../utils/urlState";

export function NotFoundPage() {
  useDocumentTitle("Page not found — RepoWarp");

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="aurora left-[12%] top-[-12rem] h-[30rem] w-[30rem] bg-aqua/10" />
        <div className="aurora right-[10%] top-[-8rem] h-[24rem] w-[24rem] bg-violet/10" />
        <div className="stage-grid absolute inset-0 opacity-30" />
      </div>

      <SiteHeader variant="workspace" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-panel/60 text-aqua">
          <Compass size={27} />
        </span>
        <p className="eyebrow mt-6">404 · Off the map</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-semibold tracking-[-0.05em] text-ink sm:text-5xl">
          This coordinate is not in the graph
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          The page you requested does not exist. Return to the workspace to choose a
          public repository, or explore the curated demo without making any API requests.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link to="/workspace" className="btn btn-primary !min-h-12 !px-5 text-[0.94rem]">
            <ArrowLeft size={15} /> Open workspace
          </Link>
          <Link to={demoHref("history")} className="btn btn-outline">
            <Play size={14} /> Explore the demo
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
