import { Boxes, TriangleAlert } from "lucide-react";
import { cn } from "../../utils/cn";

export function SceneUnavailable({
  title = "3D rendering is unavailable",
  message = "This browser could not create a WebGL context. The timeline, filters, inspector, and exports still work.",
  className,
}: {
  title?: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 px-6 text-center",
        className,
      )}
    >
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-elevated/70">
        <Boxes size={24} className="text-aqua" aria-hidden="true" />
        <TriangleAlert
          size={13}
          className="absolute -bottom-1 -right-1 rounded-full bg-panel text-amber"
          aria-hidden="true"
        />
      </span>
      <div>
        <p className="font-display text-sm font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
          {message}
        </p>
      </div>
    </div>
  );
}

