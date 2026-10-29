import {
  Command,
  Database,
  Keyboard,
  Moon,
  Palette,
  Sun,
  Waves,
} from "lucide-react";
import { usePreferencesStore } from "../../store/preferencesStore";
import type { ViewMode } from "../../types/domain";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  view: ViewMode;
  onFilters: () => void;
  onCompare: () => void;
}

const SHORTCUTS = [
  ["Space", "Play or pause time travel"],
  ["← / →", "Step one revision older or newer"],
  ["Shift + ←↑→↓", "Pan the 3D camera"],
  ["1", "Switch to History Warp"],
  ["2", "Switch to Codebase Warp"],
  ["F", "Open filters"],
  ["C", "Open comparison"],
  ["O", "Toggle cinematic orbit"],
  ["?", "Open this guide"],
  ["Esc", "Close any overlay"],
];

export function HelpDialog({
  open,
  onClose,
  view,
  onFilters,
  onCompare,
}: HelpDialogProps) {
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);
  const setReduceMotion = usePreferencesStore((state) => state.setReduceMotion);
  const showSceneGrid = usePreferencesStore((state) => state.showSceneGrid);
  const setShowSceneGrid = usePreferencesStore((state) => state.setShowSceneGrid);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Guide & appearance"
      description="RepoWarp is keyboard-friendly and honest about what has actually loaded."
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Back to the map
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-line/70 bg-base/20 p-3.5">
            <h3 className="flex items-center gap-2 font-display text-[0.82rem] font-semibold text-ink">
              <Palette size={15} className="text-aqua" />
              Appearance
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <p className="panel-kicker mb-1.5">Theme</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-line/70 bg-panel/50 p-1">
                  {(["dark", "light"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTheme(option)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.68rem] font-semibold capitalize transition",
                        theme === option
                          ? "bg-elevated text-ink shadow-sm"
                          : "text-faint hover:text-muted",
                      )}
                    >
                      {option === "dark" ? <Moon size={13} /> : <Sun size={13} />}
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="panel-kicker mb-1.5 block">Motion</span>
                <select
                  value={reduceMotion === "system" ? "system" : String(reduceMotion)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setReduceMotion(
                      value === "system" ? "system" : value === "true" ? true : false,
                    );
                  }}
                  className="field field-select !min-h-9 !py-1.5 text-[0.7rem]"
                >
                  <option value="system">Follow system preference</option>
                  <option value="false">Full motion</option>
                  <option value="true">Reduced motion</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line/60 px-3 py-2">
                <span>
                  <span className="block text-[0.72rem] font-semibold text-ink">Scene grid</span>
                  <span className="block text-[0.6rem] text-faint">Spatial reference in 3D views</span>
                </span>
                <input
                  type="checkbox"
                  checked={showSceneGrid}
                  onChange={(event) => setShowSceneGrid(event.target.checked)}
                  className="h-4 w-4"
                  style={{ accentColor: "rgb(var(--c-aqua))" }}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-line/70 bg-base/20 p-3.5">
            <h3 className="flex items-center gap-2 font-display text-[0.82rem] font-semibold text-ink">
              <Database size={15} className="text-teal" />
              Data honesty
            </h3>
            <ul className="mt-2.5 space-y-2 text-[0.66rem] leading-relaxed text-muted">
              <li>
                Only pages fetched in this session are visualized and exported. Partial
                history is labeled as partial everywhere.
              </li>
              <li>
                Live mode uses GitHub&apos;s anonymous REST API: 60 requests per hour,
                shared by your network. RepoWarp surfaces rate limits rather than hiding
                them.
              </li>
              <li>
                Codebase trees are reconstructed from the selected commit. Large
                repositories load directories on demand; playback pauses tree loading.
              </li>
              <li>
                <span className="font-semibold text-ink">demo/atlas-lens</span> is curated
                fixture data, never presented as live GitHub data.
              </li>
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-line/70 bg-base/20 p-3.5">
            <h3 className="flex items-center gap-2 font-display text-[0.82rem] font-semibold text-ink">
              <Keyboard size={15} className="text-violet" />
              Keyboard
            </h3>
            <dl className="mt-2.5 space-y-1.5">
              {SHORTCUTS.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="text-[0.65rem] text-muted">{label}</dt>
                  <dd>
                    <kbd className="rounded border border-line/80 bg-panel/70 px-1.5 py-0.5 font-mono text-[0.57rem] text-ink">
                      {key}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-[0.6rem] leading-relaxed text-faint">
              Shortcuts pause while you are typing in an input, select, or textarea.
            </p>
          </section>

          <section className="rounded-xl border border-line/70 bg-base/20 p-3.5">
            <h3 className="flex items-center gap-2 font-display text-[0.82rem] font-semibold text-ink">
              <Command size={15} className="text-amber" />
              Current workspace
            </h3>
            <p className="mt-2 text-[0.66rem] leading-relaxed text-muted">
              You are viewing{" "}
              <span className="font-semibold text-ink">
                {view === "history" ? "History Warp" : "Codebase Warp"}
              </span>
              . Filters affect the loaded graph; comparison inspects two revisions without
              changing your selected node. Drag to orbit, right-drag or shift-drag to pan,
              scroll to zoom, use the on-screen pan pad, or press{" "}
              <kbd className="rounded border border-line/80 bg-panel/70 px-1 py-0.5 font-mono text-[0.57rem] text-ink">
                O
              </kbd>{" "}
              for a cinematic orbit when reduced motion is off.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onFilters} icon={<Waves size={13} />}>
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onCompare}
                icon={<Command size={13} />}
              >
                Compare
              </Button>
            </div>
          </section>
        </div>
      </div>
    </Dialog>
  );
}
