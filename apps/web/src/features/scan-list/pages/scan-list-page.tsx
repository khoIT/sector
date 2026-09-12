import { useScanList, type ScanListView } from '@scanvault/api-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';

import { ExpertQueueEmptyState } from '../empty/expert-queue-empty-state';
import { GroupQueueEmptyState } from '../empty/group-queue-empty-state';
import { ListErrorState } from '../empty/list-error-state';
import { MyScansEmptyState } from '../empty/my-scans-empty-state';
import { NarrowedEmptyState } from '../empty/narrowed-empty-state';
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
    () => scanColumns({ view, t, user, returnUrl, now }),
    [view, t, user, returnUrl, now],
  );

  const shown = useMemo(() => visibleColumns(columns, hiddenColumns), [columns, hiddenColumns]);

  const query = useScanList({
    view,
    filters: {
      globalFilter: debouncedKeyword,
      columnFilters: toScanColumnFilters(url.filters),
      sorting: toApiSort(columns, url.sort),
      pagination: { pageIndex: url.page - 1, pageSize: url.limit },
    },
    // Only My Scans can contain a scan that is still being rendered and
    // de-identified; a queue never shows one.
    pollWhileProcessing: view === 'my',
  });

  const rows = query.data?.items ?? [];
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

  // My Scans with nothing in it replaces the whole surface — table, toolbar
  // and all — with an explanation of what a scan study is. An empty table with
  // a search box over it teaches a new learner nothing.
  if (view === 'my' && !query.isPending && rows.length === 0 && !narrowed) {
    return (
      <ScanListShell view={view}>
        <MyScansEmptyState />
      </ScanListShell>
    );
  }

  const emptyState = narrowed ? (
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
          columns={shown}
          rows={rows}
          rowKey={(scan) => scan.id}
          sort={url.sort}
          onSortChange={url.setSort}
          loading={query.isPending}
          empty={emptyState}
          caption={SCAN_VAULT_TITLE[view]}
        />

        {rows.length > 0 ? (
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
