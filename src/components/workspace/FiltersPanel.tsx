import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRepositoryStore } from "../../store/repositoryStore";
import type { AuthorOption } from "../../features/history/graphLayout";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

interface FiltersPanelProps {
  open: boolean;
  onClose: () => void;
  authors: AuthorOption[];
  loadedCount: number;
  visibleCount: number;
}

function CheckField({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line/70 bg-base/20 px-3 py-2.5 transition hover:border-line hover:bg-elevated/25">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-line"
        style={{ accentColor: "rgb(var(--c-aqua))" }}
      />
      <span>
        <span className="block text-[0.76rem] font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-[0.65rem] leading-relaxed text-faint">{hint}</span>
      </span>
    </label>
  );
}

export function FiltersPanel({
  open,
  onClose,
  authors,
  loadedCount,
  visibleCount,
}: FiltersPanelProps) {
  const filters = useRepositoryStore((state) => state.filters);
  const setFilters = useRepositoryStore((state) => state.setFilters);
  const resetFilters = useRepositoryStore((state) => state.resetFilters);

  const activeCount = [
    filters.search,
    filters.author,
    filters.fromDate,
    filters.toDate,
    filters.mergesOnly,
    filters.taggedOnly,
  ].filter(Boolean).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filter the loaded history"
      description="Filters reshape the graph, inspector context, and playback. Only commits already loaded in this session are searched."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={resetFilters}
            disabled={activeCount === 0}
            icon={<X size={14} />}
          >
            Reset filters
          </Button>
          <Button variant="primary" onClick={onClose}>
            Show {visibleCount} of {loadedCount}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="filter-search" className="panel-kicker mb-1.5 block">
            Message or SHA
          </label>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              aria-hidden="true"
            />
            <input
              id="filter-search"
              autoFocus
              value={filters.search}
              onChange={(event) => setFilters({ search: event.target.value })}
              placeholder="Search subjects, messages, or a commit prefix"
              className="field !pl-9"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="filter-author" className="panel-kicker mb-1.5 block">
              Author
            </label>
            <select
              id="filter-author"
              value={filters.author}
              onChange={(event) => setFilters({ author: event.target.value })}
              className="field field-select"
            >
              <option value="">Any author</option>
              {authors.map((author) => (
                <option key={author.value} value={author.value}>
                  {author.label}
                  {author.login ? ` (@${author.login})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filter-from" className="panel-kicker mb-1.5 block">
                From
              </label>
              <input
                id="filter-from"
                type="date"
                value={filters.fromDate}
                max={filters.toDate || undefined}
                onChange={(event) => setFilters({ fromDate: event.target.value })}
                className="field !px-2 text-[0.72rem]"
              />
            </div>
            <div>
              <label htmlFor="filter-to" className="panel-kicker mb-1.5 block">
                To
              </label>
              <input
                id="filter-to"
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(event) => setFilters({ toDate: event.target.value })}
                className="field !px-2 text-[0.72rem]"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <CheckField
            checked={filters.mergesOnly}
            onChange={(mergesOnly) => setFilters({ mergesOnly })}
            label="Merges only"
            hint="Keep revisions with more than one parent."
          />
          <CheckField
            checked={filters.taggedOnly}
            onChange={(taggedOnly) => setFilters({ taggedOnly })}
            label="Tagged only"
            hint="Keep revisions carrying at least one tag."
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-line/70 bg-base/25 px-3 py-2.5">
          <SlidersHorizontal size={14} className="text-aqua" aria-hidden="true" />
          <p className="text-[0.68rem] leading-relaxed text-muted">
            {activeCount === 0
              ? "No filters active. The full loaded branch history is visible."
              : `${visibleCount} of ${loadedCount} loaded commits match.`}
          </p>
        </div>

        <p className="text-[0.62rem] leading-relaxed text-faint">
          Use the reference selector in the toolbar to change branches. Filters never
          fetch additional history on their own; load more commits first to widen the
          searchable range.
        </p>
      </div>
    </Dialog>
  );
}
