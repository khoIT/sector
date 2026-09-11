import { Input, cn } from '@scanvault/ui';
import { useMemo, useState } from 'react';

export type FilterOption = { value: string; label: string };

/** How many rows a searchable list renders before asking the user to narrow. */
const MAX_VISIBLE_OPTIONS = 40;

export type CheckboxFilterListProps = {
  legend: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Adds a search box. Set it for lists that can run to hundreds of entries. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyHint?: string;
  loading?: boolean;
};

/**
 * A multi-select filter section.
 *
 * `/api/scan/users` answers with every learner in the caller's scope as one
 * flat array — 1,334 of them on the local database — so the searchable variant
 * filters client-side over the already-loaded list and renders only the first
 * matches. No infinite scroll, because there is no second page to fetch.
 */
export function CheckboxFilterList({
  legend,
  options,
  selected,
  onChange,
  searchable = false,
  searchPlaceholder = 'Search',
  emptyHint,
  loading = false,
}: CheckboxFilterListProps) {
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, search]);

  // Selected entries stay visible even when the search filters them out, so
  // the user can always see and undo what they have chosen.
  const selectedSet = new Set(selected);
  const visible = [
    ...matches.filter((option) => selectedSet.has(option.value)),
    ...matches.filter((option) => !selectedSet.has(option.value)),
  ].slice(0, MAX_VISIBLE_OPTIONS);

  const hiddenCount = matches.length - visible.length;

  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((entry) => entry !== value));
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[12px] font-medium text-ink-dim">{legend}</legend>

      {searchable ? (
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`Search ${legend}`}
        />
      ) : null}

      {loading ? (
        <p className="text-body text-ink-dim">Loading…</p>
      ) : options.length === 0 ? (
        <p className="text-body text-ink-dim">{emptyHint ?? 'Nothing to filter by.'}</p>
      ) : (
        <div
          className={cn(
            'flex max-h-44 flex-col overflow-y-auto rounded-token border border-line bg-surface',
          )}
        >
          {visible.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-body hover:bg-surface-2"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                checked={selectedSet.has(option.value)}
                onChange={(event) => toggle(option.value, event.target.checked)}
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}

          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-body text-ink-dim">No match.</p>
          ) : null}

          {hiddenCount > 0 ? (
            <p className="border-t border-line px-2 py-1.5 text-[11px] text-ink-dim">
              {hiddenCount.toLocaleString()} more — keep typing to narrow.
            </p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}

export type RadioFilterListProps = {
  legend: string;
  options: FilterOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  anyLabel?: string;
};

/** A single-choice filter with an explicit "any" reset row. */
export function RadioFilterList({
  legend,
  options,
  value,
  onChange,
  anyLabel = 'Any',
}: RadioFilterListProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[12px] font-medium text-ink-dim">{legend}</legend>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={value === undefined} onClick={() => onChange(undefined)}>
          {anyLabel}
        </FilterChip>

        {options.map((option) => (
          <FilterChip
            key={option.value}
            active={value === option.value}
            onClick={() => onChange(value === option.value ? undefined : option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>
    </fieldset>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[12px] transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent-ink',
        active
          ? 'border-accent-ink/30 bg-accent-soft text-accent-ink'
          : 'border-line bg-surface text-ink-dim hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
