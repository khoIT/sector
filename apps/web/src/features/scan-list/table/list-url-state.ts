import { DEFAULT_PAGE_SIZE, clampPageSize } from '@sector/api-client';

/**
 * Parsing and serialising the list's URL state.
 *
 * Param names are the legacy ones (`keyword`, `page`, `limit`, `sort`,
 * `filters`) so a bookmarked or shared Scan Vault URL from the old dashboard
 * still lands on the same view of the data.
 *
 * Every parser is total: a hand-edited or truncated param falls back to the
 * default instead of throwing. A list page that blows up because someone
 * trimmed a character off a URL is a worse failure than silently ignoring it.
 */

export type SortState = { id: string; desc: boolean };
export type FilterState = { id: string; value: string | string[] };

export type ListUrlState = {
  keyword: string;
  /** 1-based, as it appears in the URL. */
  page: number;
  limit: number;
  sort: SortState[];
  filters: FilterState[];
};

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export function parseLimit(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return DEFAULT_PAGE_SIZE;
  return clampPageSize(value);
}

export function parseSort(raw: string | null, fallback: SortState[]): SortState[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const entries = parsed.filter(
      (entry): entry is SortState =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SortState).id === 'string' &&
        typeof (entry as SortState).desc === 'boolean',
    );
    return entries.length > 0 ? entries : fallback;
  } catch {
    return fallback;
  }
}

export function parseFilters(raw: string | null): FilterState[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is FilterState => {
      if (typeof entry !== 'object' || entry === null) return false;
      const candidate = entry as FilterState;
      if (typeof candidate.id !== 'string') return false;
      if (typeof candidate.value === 'string') return candidate.value.length > 0;
      return Array.isArray(candidate.value) && candidate.value.length > 0;
    });
  } catch {
    return [];
  }
}

/**
 * Layout, carried in `filters` rather than as a query param of its own.
 *
 * It rides here because `filters` is already parsed, serialised and cleared by
 * this file and by `use-list-url-state.ts`, so a grid/list choice survives a
 * reload and a shared link for free. The cost is that it is NOT a narrowing,
 * and everything that reasons about narrowing has to say so — see
 * `hasActiveNarrowing` below.
 */
export const LAYOUT_FILTER_ID = 'view';

/**
 * True when the user has narrowed the list themselves. Drives which empty
 * state to show.
 *
 * The layout filter is excluded deliberately. It changes how the same rows are
 * drawn, not which rows they are, so counting it would put "no courses match
 * your filters — clear them" in front of a learner who had merely switched to
 * the list view.
 */
export function hasActiveNarrowing(state: Pick<ListUrlState, 'keyword' | 'filters'>): boolean {
  return (
    state.keyword.trim().length > 0 ||
    state.filters.some((filter) => filter.id !== LAYOUT_FILTER_ID)
  );
}

export function filterValue(filters: FilterState[], id: string): string | string[] | undefined {
  return filters.find((filter) => filter.id === id)?.value;
}

export function filterValues(filters: FilterState[], id: string): string[] {
  const value = filterValue(filters, id);
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Replace or drop one filter, keeping the rest in place. */
export function setFilter(
  filters: FilterState[],
  id: string,
  value: string | string[] | undefined,
): FilterState[] {
  const rest = filters.filter((filter) => filter.id !== id);
  const isEmpty =
    value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  return isEmpty ? rest : [...rest, { id, value }];
}
