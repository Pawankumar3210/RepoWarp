import { cn } from "../../utils/cn";

interface RepoWarpLogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  compact?: boolean;
  wordmarkClassName?: string;
}

export function RepoWarpMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/repowarp-logo.png"
      alt="RepoWarp"
      width={Math.round(size * 616 / 547)}
      height={size}
      role="img"
      className={cn("h-auto shrink-0 object-contain", className)}
    />
  );
}

export function RepoWarpLogo({
  size = 34,
  className,
  withWordmark = true,
  compact = false,
  wordmarkClassName,
}: RepoWarpLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="group/logo relative inline-flex">
        <RepoWarpMark
          size={size}
          className="relative transition-transform duration-300 ease-out group-hover/logo:-rotate-3 group-hover/logo:scale-[1.04]"
        />
      </span>
      {withWordmark ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-[1.08rem] font-bold tracking-[-0.035em]",
              wordmarkClassName,
            )}
          >
            Repo<span className="text-gradient">Warp</span>
          </span>
          {!compact ? (
            <span className="mt-1 font-mono text-[0.52rem] font-medium uppercase tracking-[0.24em] text-faint">
              Spatial Git Atlas
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
