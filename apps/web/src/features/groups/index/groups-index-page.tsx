import { isApiError, LIST_SEARCH_DEBOUNCE_MS, useGroups, type Group } from '@sector/api-client';
import { Button, EmptyState } from '@sector/ui';
import { ChevronRight, TriangleAlert, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { formatDate } from '@/lib/format';

import type { ListColumn } from '../../scan-list/table/column-model';
import { DataTable } from '../../scan-list/table/data-table';
import { DataTablePagination } from '../../scan-list/table/data-table-pagination';
import { hasActiveNarrowing } from '../../scan-list/table/list-url-state';
import { useDebouncedValue } from '../../scan-list/table/use-debounced-value';
import { useListUrlState } from '../../scan-list/table/use-list-url-state';
import { GroupFormDialog } from '../forms/group-form-dialog';
import { groupMembersPathFor } from '../groups-links';
import { GroupsSearchField } from '../groups-search-field';
import { hasExpiry, seatsUsage } from './group-row-model';

/**
 * The groups index: name, type, members, leaders and seats/expiry, scoped to
 * what the caller's role may see (`useGroups` decides the route — see the
 * scoping note on `GROUP_ADMIN_BYPASS_PERMISSIONS` in `@sector/api-client`).
 *
 * Reuses the Scan Vault's generic table/pagination/URL-state primitives
 * rather than a parallel implementation: `DataTable` and `DataTablePagination`
 * take plain props and know nothing about scans specifically.
 */
export function GroupsIndexPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const navigate = useNavigate();

  const url = useListUrlState([]);
  const debouncedKeyword = useDebouncedValue(url.keyword, LIST_SEARCH_DEBOUNCE_MS);

  const query = useGroups({
    user,
    query: { keyword: debouncedKeyword, page: url.page, limit: url.limit },
  });

  const rows = query.data?.items ?? [];
  const narrowed = hasActiveNarrowing({ keyword: url.keyword, filters: [] });
  const pagePastEnd = rows.length === 0 && !query.isPending && (query.data?.totalItems ?? 0) > 0;

  const columns: ListColumn<Group>[] = [
    {
      id: 'name',
      header: t('groups.index.columns.name'),
      cell: (group) => (
        <button
          type="button"
          onClick={() =>
            navigate(groupMembersPathFor(group.id), { state: { groupName: group.name } })
          }
          className="flex items-center gap-1.5 text-left font-medium text-ink outline-none hover:text-accent-ink focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          {group.name}
          <ChevronRight className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
        </button>
      ),
    },
    {
      id: 'type',
      header: t('groups.index.columns.type'),
      cell: (group) => (group.type ? t(`groups.index.type.${group.type}`) : '—'),
    },
    {
      id: 'members',
      header: t('groups.index.columns.members'),
      // Total headcount — leaders and learners both. `learnerCount` alone
      // undercounts a group's roster by exactly its leaders.
      cell: (group) => (group.leaderCount ?? 0) + (group.learnerCount ?? 0),
      numeric: true,
    },
    {
      id: 'leaders',
      header: t('groups.index.columns.leaders'),
      cell: (group) => group.leaderCount,
      numeric: true,
    },
    {
      id: 'seats',
      header: t('groups.index.columns.seats'),
      cell: (group) => {
        const seats = seatsUsage(group);
        return seats
          ? t('groups.index.seatsUsed', { used: seats.used, total: seats.total })
          : t('groups.index.unlimitedSeats');
      },
    },
    {
      id: 'expires',
      header: t('groups.index.columns.expires'),
      cell: (group) => (hasExpiry(group) ? formatDate(group.expirationDate) : '—'),
    },
  ];

  if (query.isError) {
    return (
      <section aria-label={t('groups.index.title')}>
        <h2 className="mb-3 text-[17px] font-semibold text-ink">{t('groups.index.title')}</h2>
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={t('groups.index.error.title')}
          description={isApiError(query.error) ? query.error.message : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {t('groups.index.error.retry')}
            </Button>
          }
        />
      </section>
    );
  }

  const emptyState = pagePastEnd ? (
    <EmptyState
      title={t('groups.index.pagePastEnd.title')}
      action={
        <Button variant="secondary" size="sm" onClick={() => url.setPage(1)}>
          {t('groups.index.pagePastEnd.backToFirstPage')}
        </Button>
      }
    />
  ) : narrowed ? (
    <EmptyState
      title={t('groups.index.noMatch.title')}
      description={t('groups.index.noMatch.description', { keyword: url.keyword })}
      action={
        <Button variant="secondary" size="sm" onClick={url.clearNarrowing}>
          {t('toolbar.clearSearch')}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<Users className="h-5 w-5" aria-hidden />}
      title={t('groups.index.empty.title')}
      description={t('groups.index.empty.description')}
    />
  );

  return (
    <section aria-label={t('groups.index.title')}>
      <h2 className="mb-3 text-[17px] font-semibold text-ink">{t('groups.index.title')}</h2>

      <div className="flex flex-wrap items-center gap-2 pb-3">
        <GroupsSearchField
          value={url.keyword}
          onChange={url.setKeyword}
          placeholder={t('groups.index.searchPlaceholder')}
        />
        {can('create:group') ? <GroupFormDialog mode="create" /> : null}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(group) => group.id}
        sort={[]}
        onSortChange={() => {}}
        loading={query.isPending}
        empty={emptyState}
        caption={t('groups.index.title')}
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
  );
}
