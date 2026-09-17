import { useScanList, type Scan, type ScanListView } from '@sector/api-client';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';

import { ExpertQueueEmptyState } from '../empty/expert-queue-empty-state';
import { GroupQueueEmptyState } from '../empty/group-queue-empty-state';
import { ListErrorState } from '../empty/list-error-state';
import { MyScansEmptyState } from '../empty/my-scans-empty-state';
import { NarrowedEmptyState } from '../empty/narrowed-empty-state';
import { PagePastEndState } from '../empty/page-past-end-state';
import { scanDetailPathFor } from '@/features/scan-detail/scan-detail-links';
import type { ScanQueueState } from '@/features/scan-detail/queue-position';

import { scanColumns } from '../rows/scan-columns';
import { toScanColumnFilters } from '../scan-list-filters';
import { ScanListShell } from '../scan-list-shell';
import { isReviewQueue, isReviewedList, SCAN_VAULT_TITLE } from '../scan-list-views';
import { defaultHiddenColumns, toApiSort, visibleColumns } from '../table/column-model';
import { DataTable } from '../table/data-table';
import { DataTablePagination } from '../table/data-table-pagination';
import { DataTableToolbar } from '../table/data-table-toolbar';
import { filterSpecFor } from '../table/filter-spec';
import { hasActiveNarrowing, type SortState } from '../table/list-url-state';
import { useNow } from '../table/use-now';
import { useListSurface } from '../use-list-surface';

/**
 * Default sort per view.
 *
 * The two QUEUES sort by longest-waiting first — the one ordering that makes a
 * queue a queue. `waiting` is descending here, which the column's `invertSort`
 * turns into `createdAt:asc` on the wire.
 */
const DEFAULT_SORT: Record<ScanListView, SortState[]> = {
  my: [{ id: 'createdAt', desc: true }],
  pending: [{ id: 'waiting', desc: true }],
  reviewed: [{ id: 'reviewedAt', desc: true }],
  expert: [{ id: 'waiting', desc: true }],
  'expert-reviewed': [{ id: 'reviewedAt', desc: true }],
};

const WAITING_TICK_MS = 60_000;

export function ScanListPage({ view }: { view: ScanListView }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queue = isReviewQueue(view);

  // Columns carry their own default-visibility flags, so the starting hidden
  // set is read back off a throwaway column set rather than duplicated here.
  const defaultHidden = useMemo(
    () => defaultHiddenColumns(scanColumns({ view, t, user: null, returnUrl: '', now: 0 })),
    [view, t],
  );

  const surface = useListSurface(view, DEFAULT_SORT[view], defaultHidden);
  const { url, debouncedKeyword, hiddenColumns, returnUrl } = surface;

  // Only the queues need a ticking clock, and only to keep Waiting honest.
  const now = useNow(WAITING_TICK_MS, queue);

  const columns = useMemo(
    // `linkState` is applied below rather than here: it depends on the rows,
    // which depend on the query, which depends on these columns' sort mapping.
    () => scanColumns({ view, t, user, returnUrl, now }),
    [view, t, user, returnUrl, now],
  );

  const shown = useMemo(() => visibleColumns(columns, hiddenColumns), [columns, hiddenColumns]);

  // Built once and shared between the query and the queue state a row link
  // carries, so the detail page steps the SAME list the reviewer was reading —
  // rebuilding it over there would be a second implementation of this query.
  const filters = useMemo(
    () => ({
      globalFilter: debouncedKeyword,
      columnFilters: toScanColumnFilters(url.filters),
      sorting: toApiSort(columns, url.sort),
      pagination: { pageIndex: url.page - 1, pageSize: url.limit },
    }),
    [debouncedKeyword, url.filters, url.sort, url.page, url.limit, columns],
  );

  const query = useScanList({
    view,
    filters,
    // Only My Scans can contain a scan that is still being rendered and
    // de-identified; a queue never shows one.
    pollWhileProcessing: view === 'my',
  });

  // Memoised because `linkState` closes over it: a fresh `[]` on every render
  // would rebuild every row link's state and defeat the memo below it.
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const totalItems = query.data?.totalItems ?? 0;

  const linkState = useCallback(
    (scan: Scan): ScanQueueState => ({
      view,
      filters,
      ids: rows.map((row) => row.id),
      index: rows.findIndex((row) => row.id === scan.id),
      pageIndex: url.page - 1,
      pageSize: url.limit,
      totalItems,
    }),
    [view, filters, rows, url.page, url.limit, totalItems],
  );
  const narrowed = hasActiveNarrowing({
    keyword: url.keyword,
    filters: url.filters,
  });

  if (query.isError) {
    return (
      <ScanListShell view={view}>
        <ListErrorState error={query.error} onRetry={() => void query.refetch()} />
      </ScanListShell>
    );
  }

  // Rows exist, just not here. Kept ahead of every other empty state because
  // those diagnose WHY a list is empty, and "you lead no groups" is the wrong
  // answer to "you are on page 12 of 3".
  const pagePastEnd = rows.length === 0 && !query.isPending && (query.data?.totalItems ?? 0) > 0;

  // My Scans with nothing in it replaces the whole surface — table, toolbar
  // and all — with an explanation of what a scan study is. An empty table with
  // a search box over it teaches a new learner nothing.
  if (view === 'my' && !query.isPending && rows.length === 0 && !narrowed && !pagePastEnd) {
    return (
      <ScanListShell view={view}>
        <MyScansEmptyState />
      </ScanListShell>
    );
  }

  // Rebuilt with the queue state now that the rows are known. One extra pass
  // over at most 100 column descriptors, and it keeps `columns` — which the
  // sort mapping and the query key read — free of the rows it would otherwise
  // depend on.
  const withQueueState = scanColumns({ view, t, user, returnUrl, now, linkState }).filter(
    (column) => shown.some((visible) => visible.id === column.id),
  );

  const emptyState = pagePastEnd ? (
    <PagePastEndState
      page={url.page}
      totalItems={query.data?.totalItems ?? 0}
      onGoToFirstPage={() => url.setPage(1)}
    />
  ) : narrowed ? (
    <NarrowedEmptyState
      keyword={url.keyword}
      filterCount={url.filters.length}
      onClear={url.clearNarrowing}
    />
  ) : view === 'pending' || view === 'reviewed' ? (
    <GroupQueueEmptyState reviewed={isReviewedList(view)} onRefresh={() => void query.refetch()} />
  ) : (
    <ExpertQueueEmptyState reviewed={isReviewedList(view)} onRefresh={() => void query.refetch()} />
  );

  return (
    <ScanListShell view={view}>
      <section aria-label={SCAN_VAULT_TITLE[view]}>
        <DataTableToolbar
          spec={filterSpecFor(view)}
          keyword={url.keyword}
          onKeywordChange={url.setKeyword}
          filters={url.filters}
          onFiltersChange={url.setFilters}
          columns={columns}
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={surface.setHiddenColumns}
          onResetColumns={surface.resetHiddenColumns}
          totalItems={query.data?.totalItems}
        />

        <DataTable
          columns={withQueueState}
          rows={rows}
          rowKey={(scan) => scan.id}
          sort={url.sort}
          onSortChange={url.setSort}
          loading={query.isPending}
          empty={emptyState}
          caption={SCAN_VAULT_TITLE[view]}
          rowHref={(scan) => scanDetailPathFor(view, scan.id, returnUrl)}
          rowState={linkState}
        />

        {rows.length > 0 || pagePastEnd ? (
          <DataTablePagination
            page={url.page}
            limit={url.limit}
            totalItems={query.data?.totalItems ?? 0}
            totalPages={query.data?.totalPages ?? 1}
            onPageChange={url.setPage}
            onLimitChange={url.setLimit}
            busy={query.isFetching}
          />
        ) : null}
      </section>
    </ScanListShell>
  );
}
