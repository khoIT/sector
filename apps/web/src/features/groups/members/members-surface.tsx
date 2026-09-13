import {
  GROUP_ADMIN_BYPASS_PERMISSIONS,
  isApiError,
  LIST_SEARCH_DEBOUNCE_MS,
  useGroupMembers,
  userDisplayName,
  type GroupMember,
} from '@sector/api-client';
import { Button, EmptyState, StatusPill } from '@sector/ui';
import { ChevronLeft, TriangleAlert, Users2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { formatDate } from '@/lib/format';

import type { ListColumn } from '../../scan-list/table/column-model';
import { DataTable } from '../../scan-list/table/data-table';
import { DataTablePagination } from '../../scan-list/table/data-table-pagination';
import { hasActiveNarrowing } from '../../scan-list/table/list-url-state';
import { useDebouncedValue } from '../../scan-list/table/use-debounced-value';
import { useListUrlState } from '../../scan-list/table/use-list-url-state';
import { GROUP_ADMINISTRATION_PATH } from '../groups-links';
import { GroupsSearchField } from '../groups-search-field';
import { memberColumnsFor, type MemberColumnDef } from './columns';
import { memberRoleTone, memberStatusTone } from './member-badge-tone';

/** `groups-index-page.tsx` carries the group's name here on navigation, so
 *  the header does not need a second fetch just to name the page. A direct
 *  deep link (no state) falls back to the generic title — the member list
 *  itself does not depend on it. */
type MembersLocationState = { groupName?: string } | null | undefined;

function toListColumn(
  def: MemberColumnDef,
  t: (key: string, options?: Record<string, unknown>) => string,
): ListColumn<GroupMember> {
  switch (def.id) {
    case 'member':
      return {
        id: def.id,
        header: t(def.labelKey),
        cell: (member) => (
          <div>
            <div className="font-medium text-ink">{userDisplayName(member.user)}</div>
            <div className="text-[12px] text-ink-dim">{member.user.email}</div>
          </div>
        ),
      };
    case 'role':
      return {
        id: def.id,
        header: t(def.labelKey),
        cell: (member) => (
          <StatusPill
            dot={false}
            tone={memberRoleTone(member.role)}
            label={t(`groups.members.role.${member.role}`)}
          />
        ),
      };
    case 'status':
      return {
        id: def.id,
        header: t(def.labelKey),
        cell: (member) => (
          <StatusPill
            tone={memberStatusTone(member.status)}
            label={t(`groups.members.status.${member.status}`)}
          />
        ),
      };
    case 'joined':
      return { id: def.id, header: t(def.labelKey), cell: (member) => formatDate(member.joinedAt) };
    case 'expires':
      return {
        id: def.id,
        header: t(def.labelKey),
        cell: (member) => formatDate(member.expiresAt),
      };
  }
}

/**
 * ONE members surface. Its column set is a function of the caller's real
 * capability (`memberColumnsFor`, `columns.ts`) — there is no "viewing as"
 * switcher, and no second screen for the administrator case.
 */
export function MembersSurface() {
  const { t } = useTranslation();
  const { user, canAny } = useAuth();
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const groupName = (location.state as MembersLocationState)?.groupName;

  const url = useListUrlState([]);
  const debouncedKeyword = useDebouncedValue(url.keyword, LIST_SEARCH_DEBOUNCE_MS);

  const viewerRole = canAny([...GROUP_ADMIN_BYPASS_PERMISSIONS]) ? 'administrator' : 'leader';
  const columns = memberColumnsFor(viewerRole).map((def) => toListColumn(def, t));

  const query = useGroupMembers({
    user,
    groupId,
    query: { keyword: debouncedKeyword, page: url.page, limit: url.limit },
  });

  const rows = query.data?.items ?? [];
  const narrowed = hasActiveNarrowing({ keyword: url.keyword, filters: [] });
  const pagePastEnd = rows.length === 0 && !query.isPending && (query.data?.totalItems ?? 0) > 0;
  const title = groupName ?? t('groups.members.title');

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="mb-2">
      <Link to={GROUP_ADMINISTRATION_PATH}>
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        {t('groups.members.backToGroups')}
      </Link>
    </Button>
  );

  if (query.isError) {
    return (
      <section aria-label={title}>
        {backLink}
        <h2 className="mb-3 text-[17px] font-semibold text-ink">{title}</h2>
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={t('groups.members.error.title')}
          description={isApiError(query.error) ? query.error.message : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {t('groups.members.error.retry')}
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
      title={t('groups.members.noMatch.title')}
      description={t('groups.members.noMatch.description', { keyword: url.keyword })}
      action={
        <Button variant="secondary" size="sm" onClick={url.clearNarrowing}>
          {t('toolbar.clearSearch')}
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<Users2 className="h-5 w-5" aria-hidden />}
      title={t('groups.members.empty.title')}
      description={t('groups.members.empty.description')}
    />
  );

  return (
    <section aria-label={title}>
      {backLink}

      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        <span className="sv-num text-body text-ink-dim">
          {t('groups.members.subtitle', { count: query.data?.totalItems ?? 0 })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-3">
        {/* Kept for every role even though the server currently drops this
            keyword on the leader/reviewer-scoped route (see the `keyword`
            doc on `GroupMemberListQuery`) — it already narrows the list for
            a full-access caller today, and needs no client change once the
            pending API fix ships. */}
        <GroupsSearchField
          value={url.keyword}
          onChange={url.setKeyword}
          placeholder={t('groups.members.searchPlaceholder')}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(member) => member.id}
        sort={[]}
        onSortChange={() => {}}
        loading={query.isPending}
        empty={emptyState}
        caption={title}
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
