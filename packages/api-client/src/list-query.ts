import type { QueryInput } from './client';

/**
 * One query-string builder for every list route.
 *
 * The legacy dashboard inlined the same block seven times (getScans,
 * getPendingScans, getReviewedScans, getExpertScans, getExpertReviewedScans,
 * getSharedScans, getFiles) with raw string concatenation, so a keyword
 * containing `&` or `=` corrupted the URL and empty filters left `&&` runs.
 */

/** Server default page size. */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Server hard cap. A request for more is silently clamped to 100 server-side,
 * so the clamp is applied here too and the UI never shows a page size it
 * cannot actually get.
 */
export const MAX_PAGE_SIZE = 100;

/** Debounce applied to the free-text filter before it enters a query key. */
export const LIST_SEARCH_DEBOUNCE_MS = 600;

/**
 * Fields the server will actually sort by. Anything else silently falls back
 * to createdAt, so `buildListQuery` normalises here rather than letting the
 * UI think it sorted by a column it did not.
 */
export const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'reviewedAt',
  'firstName',
  'lastName',
  'title',
  'status',
  'scanType',
  'name',
] as const;

export type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

export const DEFAULT_SORT: SortSpec = { id: 'createdAt', desc: true };

/**
 * Filter keys the /api/scan/* list routes recognise. The UI's column-filter id
 * IS the API parameter name, so typing these prevents a typo producing a
 * filter the server silently ignores.
 */
export const SCAN_LIST_FILTER_KEYS = [
  'keyword',
  'status',
  'tags',
  'scanTypeKeys',
  'groupIds',
  'userIds',
] as const;

export type ScanListFilterKey = (typeof SCAN_LIST_FILTER_KEYS)[number];

/**
 * GET /api/shared-scans takes a DIFFERENT set, and note `scanTypeIds` (ids)
 * where the scan routes take `scanTypeKeys` (keys). That divergence is a real
 * trap; it is encoded in the types so the two cannot be mixed up.
 */
export const SHARED_SCAN_LIST_FILTER_KEYS = [
  'keyword',
  'sharedBy',
  'scanTypeIds',
  'status',
] as const;

export type SharedScanListFilterKey = (typeof SHARED_SCAN_LIST_FILTER_KEYS)[number];

export type ColumnFilter<TKey extends string = ScanListFilterKey> = {
  id: TKey;
  value: string | string[];
};

export type SortSpec = { id: string; desc: boolean };

/** 0-based, matching TanStack Table. Converted to the API's 1-based `page`. */
export type PaginationSpec = { pageIndex: number; pageSize: number };

export type ListQueryInput<TKey extends string = ScanListFilterKey> = {
  /** Free-text search. Debounce it with LIST_SEARCH_DEBOUNCE_MS first. */
  globalFilter?: string;
  columnFilters?: Array<ColumnFilter<TKey>>;
  sorting?: SortSpec[];
  pagination?: PaginationSpec;
};

export function isAllowedSortField(field: string): field is SortField {
  return (ALLOWED_SORT_FIELDS as readonly string[]).includes(field);
}

/** Falls back to createdAt for anything the server would ignore. */
export function normalizeSortField(field: string | undefined): SortField {
  return field && isAllowedSortField(field) ? field : 'createdAt';
}

export function clampPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(pageSize), MAX_PAGE_SIZE);
}

/**
 * Build the query object for a list route. Pass the result straight to
 * `client.get(path, { query })`, which URL-encodes it.
 */
export function buildListQuery<TKey extends string = ScanListFilterKey>(
  input: ListQueryInput<TKey> = {},
): QueryInput {
  const {
    globalFilter = '',
    columnFilters = [],
    sorting = [],
    pagination = { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
  } = input;

  const query: QueryInput = {};

  const keyword = globalFilter.trim();
  if (keyword) query.keyword = keyword;

  for (const filter of columnFilters) {
    if (filter.value === undefined || filter.value === null) continue;
    query[filter.id] = Array.isArray(filter.value) ? filter.value : String(filter.value);
  }

  const sort = sorting[0] ?? DEFAULT_SORT;
  query.sortBy = `${normalizeSortField(sort.id)}:${sort.desc ? 'desc' : 'asc'}`;

  query.page = Math.max(1, Math.trunc(pagination.pageIndex) + 1);
  query.limit = clampPageSize(pagination.pageSize);

  return query;
}
