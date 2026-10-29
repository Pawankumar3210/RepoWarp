import { AlertTriangle, X } from "lucide-react";
import { useRepositoryStore } from "../../store/repositoryStore";

export function WarningBanner() {
  const warnings = useRepositoryStore((state) => state.warnings);
  const rateLimit = useRepositoryStore((state) => state.rateLimit);
  const setWarning = useRepositoryStore((state) => state.setWarning);

  const limitWarning =
    rateLimit.remaining !== null && rateLimit.remaining <= 5
      ? rateLimit.remaining === 0
        ? "GitHub's anonymous rate limit is exhausted. Live requests are paused until the window resets."
        : `Only ${rateLimit.remaining} anonymous GitHub API requests remain in this window.`
      : null;
  const messages = [...(limitWarning ? [limitWarning] : []), ...warnings];

  if (messages.length === 0) return null;

  return (
    <div className="relative z-20 border-b border-amber/20 bg-amber/[0.06]">
      <div className="mx-auto flex max-w-[100rem] items-start gap-2.5 px-3 py-2 sm:px-5">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[0.69rem] leading-relaxed text-amber/90">
          {messages[0]}
          {messages.length > 1 ? (
            <span className="ml-1.5 text-amber/60">+{messages.length - 1} more notice{messages.length > 2 ? "s" : ""}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setWarning(null)}
          className="rounded p-1 text-amber/60 transition hover:bg-amber/10 hover:text-amber"
          aria-label="Dismiss notices"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
