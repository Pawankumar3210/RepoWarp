import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { RepoWarpLogo } from "../brand/RepoWarpLogo";
import { ThemeToggle } from "../ui/ThemeToggle";
import { LinkButton } from "../ui/Button";
import { demoHref } from "../../utils/urlState";

export function SiteHeader({ variant = "landing" }: { variant?: "landing" | "workspace" }) {
  return (
    <header className="relative z-40">
      <div className="mx-auto flex h-[4.4rem] max-w-[86rem] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
        <Link
          to="/"
          className="group inline-flex rounded-xl focus-visible:outline-offset-4"
          aria-label="RepoWarp home"
        >
          <RepoWarpLogo compact wordmarkClassName="text-[1.596rem]" />
        </Link>

        {variant === "landing" ? (
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            <a
              href="#features"
              className="text-[0.78rem] font-medium text-muted transition hover:text-ink"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-[0.78rem] font-medium text-muted transition hover:text-ink"
            >
              How it works
            </a>
            <Link
              to={demoHref("history")}
              className="text-[0.78rem] font-medium text-muted transition hover:text-ink"
            >
              Live demo
            </Link>
          </nav>
        ) : (
          <nav className="hidden items-center sm:flex" aria-label="Workspace">
            <Link
              to="/"
              className="btn btn-soft !min-h-10 !rounded-xl !px-5 text-[0.86rem] font-semibold"
            >
              Home
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {variant === "landing" ? (
            <LinkButton
              to="/workspace"
              variant="soft"
              size="sm"
              icon={<ArrowUpRight size={14} />}
              className="hidden sm:inline-flex"
            >
              Open workspace
            </LinkButton>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-line/65">
      <div className="mx-auto flex max-w-[86rem] flex-col gap-5 px-4 py-8 sm:px-7 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-3">
          <RepoWarpLogo size={27} compact />
          <span className="text-[0.7rem] text-faint">
            Travel through the evolution of code.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.68rem] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="status-dot !h-1.5 !w-1.5" aria-hidden="true" />
            Public GitHub API
          </span>
          <span>No account required</span>
          <span>Anonymous rate limits apply</span>
          <Link to={demoHref("history")} className="text-muted transition hover:text-ink">
            Curated demo
          </Link>
        </div>
      </div>
    </footer>
  );
}
