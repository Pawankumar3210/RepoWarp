import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, Home, RotateCcw } from "lucide-react";
import { RepoWarpLogo } from "../components/brand/RepoWarpLogo";
import { Button } from "../components/ui/Button";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "An unexpected rendering error occurred.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error("RepoWarp render failure", error, info.componentStack);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="relative flex min-h-svh flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="aurora left-[-12rem] top-[-10rem] h-[30rem] w-[30rem] bg-rose/10" />
          <div className="stage-grid absolute inset-0 opacity-35" />
        </div>
        <header className="relative z-10 mx-auto flex h-[4.4rem] w-full max-w-[86rem] items-center px-4 sm:px-7 lg:px-10">
          <Link to="/" aria-label="RepoWarp home">
            <RepoWarpLogo compact />
          </Link>
        </header>
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose/30 bg-rose/10 text-rose">
            <AlertOctagon size={27} />
          </span>
          <p className="eyebrow mt-6">Unexpected failure</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-ink">
            The warp drive stalled
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            A rendering error interrupted this view. Your loaded history is not stored
            remotely, and no repository data was modified.
          </p>
          {import.meta.env.DEV && this.state.message ? (
            <p className="mt-4 max-w-xl overflow-auto rounded-lg border border-rose/20 bg-rose/[0.05] px-3 py-2 font-mono text-[0.62rem] text-rose/90">
              {this.state.message}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="primary"
              icon={<RotateCcw size={15} />}
              onClick={() => window.location.reload()}
            >
              Reload RepoWarp
            </Button>
            <Link to="/" className="btn btn-outline" onClick={() => this.setState({ hasError: false, message: null })}>
              <Home size={15} /> Go home
            </Link>
          </div>
        </main>
      </div>
    );
  }
}
