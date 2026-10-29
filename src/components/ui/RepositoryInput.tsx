import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, GitBranch, X } from "lucide-react";
import { parseRepositoryInput } from "../../services/github/parseRepository";
import { explorationHref } from "../../utils/urlState";
import { usePreferencesStore } from "../../store/preferencesStore";
import { cn } from "../../utils/cn";
import { Button } from "./Button";

interface RepositoryInputProps {
  autoFocus?: boolean;
  compact?: boolean;
  className?: string;
}

export function RepositoryInput({
  autoFocus = false,
  compact = false,
  className,
}: RepositoryInputProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const lastView = usePreferencesStore((state) => state.lastView);
  const inputId = useId();
  const errorId = useId();
  const parsed = value.trim() ? parseRepositoryInput(value) : null;
  const showInvalid = Boolean(submitted && parsed && !parsed.ok);
  const showValid = Boolean(parsed?.ok && (focused || submitted));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!parsed) return;
    if (!parsed.ok) return;
    navigate(
      explorationHref(parsed.identity.owner, parsed.identity.name, {
        view: lastView,
      }),
    );
  };

  return (
    <form
      onSubmit={submit}
      className={cn("w-full", className)}
      noValidate
      role="search"
      aria-label="Open a public GitHub repository"
    >
      <div
        className={cn(
          "repo-field-shell group relative flex items-center gap-2 overflow-hidden rounded-xl border p-1.5 transition-all duration-300",
          showInvalid
            ? "border-rose/60 shadow-[0_0_0_3px_rgb(var(--c-rose)/0.1)]"
            : focused
              ? "border-aqua/55 shadow-[0_0_0_3px_rgb(var(--c-aqua)/0.1),0_20px_60px_rgb(var(--c-aqua)/0.08)]"
              : "border-line hover:border-faint/70",
          compact ? "min-h-[3.15rem]" : "min-h-[3.65rem] sm:p-2",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-aqua/[0.07] to-transparent transition-opacity duration-500",
            focused ? "opacity-100" : "opacity-40",
          )}
        />
        <span
          className={cn(
            "ml-2 flex shrink-0 items-center justify-center rounded-lg border border-line/80 bg-elevated/70 text-muted transition-colors",
            compact ? "h-8 w-8" : "h-10 w-10",
          )}
          aria-hidden="true"
        >
          <GitBranch size={compact ? 16 : 18} />
        </span>
        <label htmlFor={inputId} className="sr-only">
          Public GitHub repository URL
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (submitted) setSubmitted(false);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          autoComplete="url"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="url"
          placeholder="github.com/owner/repository"
          className={cn(
            "repo-input min-w-0 flex-1 bg-transparent px-1 outline-none",
            compact ? "text-[0.86rem]" : "text-[0.92rem] sm:text-base",
          )}
          aria-invalid={showInvalid}
          aria-describedby={showInvalid ? errorId : undefined}
        />
        {value ? (
          <button
            type="button"
            className="rounded-md p-1.5 text-faint transition hover:bg-elevated hover:text-ink"
            aria-label="Clear repository URL"
            onClick={() => {
              setValue("");
              setSubmitted(false);
            }}
          >
            <X size={15} />
          </button>
        ) : (
          <span className="hidden items-center gap-1.5 pr-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-faint md:flex">
            <span className="kbd">Enter</span>
          </span>
        )}
        <Button
          type="submit"
          variant="primary"
          size={compact ? "sm" : "md"}
          className={cn("shrink-0", compact ? "h-9 px-3.5" : "h-11 px-4 sm:px-5")}
          icon={showValid ? <Check size={16} /> : <ArrowRight size={16} />}
          disabled={!value.trim()}
        >
          <span className="hidden sm:inline">Warp</span>
          <span className="sr-only sm:hidden">Warp repository</span>
        </Button>
      </div>
      <div className="min-h-5 px-1 pt-1.5" aria-live="polite">
        {showInvalid && parsed && !parsed.ok ? (
          <p
            id={errorId}
            className="flex items-center gap-1.5 text-[0.7rem] text-rose"
          >
            <AlertCircle size={12} aria-hidden="true" />
            {parsed.message}
          </p>
        ) : showValid && parsed?.ok ? (
          <p className="flex items-center gap-1.5 text-[0.7rem] text-teal">
            <Check size={12} aria-hidden="true" />
            Ready to warp into {parsed.identity.fullName}
          </p>
        ) : (
          <p className="text-[0.68rem] text-faint">
            Public repositories only. No account or token required.
          </p>
        )}
      </div>
    </form>
  );
}
