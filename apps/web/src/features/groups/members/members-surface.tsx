import {
  GROUP_ADMIN_BYPASS_PERMISSIONS,
  isApiError,
  LIST_SEARCH_DEBOUNCE_MS,
  useGroupMembers,
  userDisplayName,
  type GroupMember,
} from '@sector/api-client';
import { Button, EmptyState, StatusPill } from '@sector/ui';
import { TriangleAlert, Users2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { formatDate } from '@/lib/format';

import type { ListColumn } from '../../scan-list/table/column-model';
import { DataTable } from '../../scan-list/table/data-table';
import { DataTablePagination } from '../../scan-list/table/data-table-pagination';
import { hasActiveNarrowing } from '../../scan-list/table/list-url-state';
import { useDebouncedValue } from '../../scan-list/table/use-debounced-value';
import { useListUrlState } from '../../scan-list/table/use-list-url-state';
import { InviteMemberDialog } from '../forms/invite-member-dialog';
import { GroupDetailTabs } from '../group-detail-tabs';
import { useGroupDetailTitle } from '../use-group-detail-title';
import { GroupsSearchField } from '../groups-search-field';
import { memberColumnsFor, type MemberColumnDef } from './columns';
import { memberRoleTone, memberStatusTone } from './member-badge-tone';
import { MemberActionsCell } from './member-actions-cell';

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
 * switcher, and no second screen for the administrator case. The `actions`
 * column (role change, removal) is appended here for BOTH roles, gated
 * per-cell on the real permission — see the doc comment on `memberColumnsFor`.
 */
export function MembersSurface() {
  const { t } = useTranslation();
  const { user, canAny } = useAuth();
  const { groupId } = useParams<{ groupId: string }>();

  const url = useListUrlState([]);
  const debouncedKeyword = useDebouncedValue(url.keyword, LIST_SEARCH_DEBOUNCE_MS);

  const viewerRole = canAny([...GROUP_ADMIN_BYPASS_PERMISSIONS]) ? 'administrator' : 'leader';
  const canEditRole = canAny(['edit:group-member']);
  const canRemove = canAny(['delete:group-member']);
  const canInvite = canAny(['create:group-member']);
  // `canInvite` also gates the per-row resend, so it counts towards showing
  // the column at all: on this data every member is `pending` or `active` and
  // resending is the action a leader needs most on the first of those.
  const showActions = canEditRole || canRemove || canInvite;

  const baseColumns = memberColumnsFor(viewerRole).map((def) => toListColumn(def, t));
  const columns: ListColumn<GroupMember>[] = showActions
    ? [
        ...baseColumns,
        {
          id: 'actions',
          header: '',
          cell: (member) => (
            <MemberActionsCell
              member={member}
              groupId={groupId ?? ''}
              canEditRole={canEditRole}
              canRemove={canRemove}
              canInvite={canInvite}
            />
          ),
        },
      ]
    : baseColumns;

  const query = useGroupMembers({
    user,
    groupId,
    query: { keyword: debouncedKeyword, page: url.page, limit: url.limit },
  });

  const rows = query.data?.items ?? [];
  const narrowed = hasActiveNarrowing({ keyword: url.keyword, filters: [] });
  const pagePastEnd = rows.length === 0 && !query.isPending && (query.data?.totalItems ?? 0) > 0;
  const title = useGroupDetailTitle(groupId);

  if (!groupId) return null;

  if (query.isError) {
    return (
      <section aria-label={title}>
        <GroupDetailTabs groupId={groupId} active="members" />
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
      <GroupDetailTabs groupId={groupId} active="members" />

      <div className="mb-3 flex flex-wrap items-baseline gap-2">
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
        {canInvite ? <InviteMemberDialog groupId={groupId} /> : null}
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
