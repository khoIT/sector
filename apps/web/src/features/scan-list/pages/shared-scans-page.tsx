import { useSharedScanList } from '@sector/api-client';
import { EmptyState } from '@sector/ui';
import { Share2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';

import { ListErrorState } from '../empty/list-error-state';
import { NarrowedEmptyState } from '../empty/narrowed-empty-state';
import { PagePastEndState } from '../empty/page-past-end-state';
import { sharedScanColumns } from '../rows/shared-scan-columns';
import { toSharedScanColumnFilters } from '../scan-list-filters';
import { ScanListShell } from '../scan-list-shell';
import { SCAN_VAULT_TITLE } from '../scan-list-views';
import { defaultHiddenColumns, toApiSort, visibleColumns } from '../table/column-model';
import { DataTable } from '../table/data-table';
import { DataTablePagination } from '../table/data-table-pagination';
import { DataTableToolbar } from '../table/data-table-toolbar';
import { filterSpecFor } from '../table/filter-spec';
import { hasActiveNarrowing, type SortState } from '../table/list-url-state';
import { useListSurface } from '../use-list-surface';

const DEFAULT_SORT: SortState[] = [{ id: 'createdAt', desc: true }];

/**
 * Scans other people shared WITH the signed-in user.
 *
 * A different resource from the other five tabs (/api/shared-scans, its own
 * row shape, its own filter keys), which is why it does not go through
 * ScanListPage. What it shares is the toolbar, table and pagination.
 */
export function SharedScansPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const defaultHidden = useMemo(
    () => defaultHiddenColumns(sharedScanColumns({ returnUrl: '', user: null, t })),
    [t],
  );

  const surface = useListSurface('shared', DEFAULT_SORT, defaultHidden);
  const { url, debouncedKeyword, hiddenColumns, returnUrl } = surface;

  const columns = useMemo(
    () => sharedScanColumns({ returnUrl, user, t }),
    [returnUrl, user, t],
  );
  const shown = useMemo(() => visibleColumns(columns, hiddenColumns), [columns, hiddenColumns]);

  const query = useSharedScanList({
    filters: {
      globalFilter: debouncedKeyword,
      columnFilters: toSharedScanColumnFilters(url.filters),
      sorting: toApiSort(columns, url.sort),
      pagination: { pageIndex: url.page - 1, pageSize: url.limit },
    },
  });

  const rows = query.data?.items ?? [];
  const narrowed = hasActiveNarrowing({
    keyword: url.keyword,
    filters: url.filters,
  });

  if (query.isError) {
    return (
      <ScanListShell view="shared">
        <ListErrorState error={query.error} onRetry={() => void query.refetch()} />
      </ScanListShell>
    );
  }

  // Rows exist, just not here. Kept ahead of every other empty state because
  // those diagnose WHY a list is empty, and "you lead no groups" is the wrong
  // answer to "you are on page 12 of 3".
  const pagePastEnd = rows.length === 0 && !query.isPending && (query.data?.totalItems ?? 0) > 0;

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
  ) : (
    <EmptyState
      icon={<Share2 className="h-5 w-5" aria-hidden />}
      title="Nobody has shared a scan with you"
      description="A scan appears here when another GUSI user shares it with the email address on your account. You cannot add one yourself — sharing happens from the scan's own page, on the sharer's side."
    />
  );

  return (
    <ScanListShell view="shared">
      <section aria-label={SCAN_VAULT_TITLE.shared}>
        <DataTableToolbar
          spec={filterSpecFor('shared')}
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
          rowKey={(share) => share.id}
          sort={url.sort}
          onSortChange={url.setSort}
          loading={query.isPending}
          empty={emptyState}
          caption={SCAN_VAULT_TITLE.shared}
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
