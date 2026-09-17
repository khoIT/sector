import type { ScanListView } from '@sector/api-client';

/**
 * The list a scan was opened from, carried in `location.state`.
 *
 * In history state rather than the URL, deliberately: a scan link is pasted
 * into email and Slack by reviewers all day, and a URL carrying somebody's
 * filter set, sort and page offset is both ugly and wrong for the person who
 * receives it. A bookmarked or emailed link simply arrives without this, and
 * the detail page shows no queue navigation — which is correct, because there
 * is no queue.
 *
 * `filters` is the exact argument the list page handed `useScanList`, passed
 * through untouched. Rebuilding it on this side from the URL would be a second
 * implementation of the list's own query, and the two would drift.
 */
export type ScanQueueState = {
  view: ScanListView;
  filters: unknown;
  /** Scan ids on the page the reviewer opened, in the order shown. */
  ids: string[];
  /** Where the opened scan sat in `ids` when the link was made. */
  index: number;
  pageIndex: number;
  pageSize: number;
  totalItems: number;
};

/**
 * History state is not trusted input. It survives a deploy, so it can hold
 * the shape a previous release wrote, and a crafted entry can hold anything
 * at all. Anything that does not match is treated as "arrived without a
 * queue".
 */
export function isScanQueueState(value: unknown): value is ScanQueueState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<ScanQueueState>;

  return (
    typeof state.view === 'string' &&
    Array.isArray(state.ids) &&
    state.ids.every((id) => typeof id === 'string') &&
    typeof state.index === 'number' &&
    typeof state.pageIndex === 'number' &&
    typeof state.pageSize === 'number' &&
    typeof state.totalItems === 'number'
  );
}

export type QueuePosition = {
  prevId: string | null;
  nextId: string | null;
  /** 1-based position across the whole list, not within the page. */
  position: number;
  total: number;
  /** Page to load for a neighbour that sits past the edge of this one. */
  needsPrevPage: number | null;
  needsNextPage: number | null;
};

/**
 * The scans either side of this one.
 *
 * The scan is located by ID first and only falls back to the carried index,
 * because the list can have moved under the reviewer — someone else reviewing
 * a scan drops it out of Unreviewed, and every index after it shifts by one.
 * Trusting the stale index there would step the reviewer over a scan.
 */
export function resolveQueuePosition(state: ScanQueueState, scanId: string): QueuePosition {
  const found = state.ids.indexOf(scanId);
  const at = found === -1 ? state.index : found;
  const onPage = at >= 0 && at < state.ids.length;

  const prevId = onPage ? (state.ids[at - 1] ?? null) : null;
  const nextId = onPage ? (state.ids[at + 1] ?? null) : null;

  const hasMoreAfter = (state.pageIndex + 1) * state.pageSize < state.totalItems;

  return {
    prevId,
    nextId,
    position: onPage ? state.pageIndex * state.pageSize + at + 1 : 0,
    total: state.totalItems,
    // A page holding a single row is at both edges at once, which is why
    // these are two fields rather than one.
    needsPrevPage: !prevId && onPage && state.pageIndex > 0 ? state.pageIndex - 1 : null,
    needsNextPage: !nextId && onPage && hasMoreAfter ? state.pageIndex + 1 : null,
  };
}

/**
 * The same queue, as seen from a neighbouring page.
 *
 * Stepping across a page boundary has to hand the next detail page a state
 * describing THAT page, or the reviewer arrives at row 1 of page 2 still
 * carrying page 1's ids and immediately loses Previous.
 */
export function queueStateForPage(
  base: ScanQueueState,
  page: { ids: string[]; pageIndex: number; totalItems: number },
  scanId: string,
): ScanQueueState {
  return {
    ...base,
    ids: page.ids,
    index: Math.max(0, page.ids.indexOf(scanId)),
    pageIndex: page.pageIndex,
    totalItems: page.totalItems,
  };
}
