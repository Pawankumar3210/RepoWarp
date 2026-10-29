import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import { useToastStore } from "../../store/toastStore";
import type { ToastMessage } from "../../types/domain";
import { cn } from "../../utils/cn";

const TONES: Record<
  ToastMessage["tone"],
  { icon: typeof Info; className: string; iconClass: string }
> = {
  info: { icon: Info, className: "border-aqua/25", iconClass: "text-aqua" },
  success: {
    icon: CheckCircle2,
    className: "border-teal/30",
    iconClass: "text-teal",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber/35",
    iconClass: "text-amber",
  },
  error: { icon: XCircle, className: "border-rose/35", iconClass: "text-rose" },
};

export function Toasts() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.slice(-4).map((toast) => {
        const tone = TONES[toast.tone];
        const ToneIcon = tone.icon;
        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "reveal glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-3.5 py-3",
              tone.className,
            )}
          >
            <ToneIcon
              size={17}
              className={cn("mt-0.5 shrink-0", tone.iconClass)}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.82rem] font-semibold leading-snug text-ink">
                {toast.title}
              </p>
              {toast.message ? (
                <p className="mt-1 text-[0.73rem] leading-relaxed text-muted">
                  {toast.message}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="mt-0.5 rounded-md p-1 text-faint transition hover:bg-elevated hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
