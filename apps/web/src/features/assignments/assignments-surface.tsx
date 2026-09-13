import {
  GROUP_ASSIGNMENT_STATUSES,
  GROUP_ASSIGNMENT_TYPES,
  isApiError,
  useGroupAssignments,
  userDisplayName,
  type Assignment,
  type GroupAssignmentStatus,
  type GroupAssignmentType,
} from '@sector/api-client';
import {
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusPill,
  type BadgeTone,
} from '@sector/ui';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { formatDate } from '@/lib/format';

import type { ListColumn } from '../scan-list/table/column-model';
import { DataTable } from '../scan-list/table/data-table';

const PAGE_SIZE = 20;

const ALL = 'all';

function assignmentStatusTone(status: GroupAssignmentStatus): BadgeTone {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'cancelled':
      return 'crit';
    case 'in_progress':
      return 'warn';
    case 'active':
      return 'accent';
    case 'draft':
    default:
      return 'neutral';
  }
}

/**
 * One group's assignments — what a leader or administrator assigned its
 * learners to complete. Read-only: the legacy `create` / `edit` / `delete`
 * dialogs are not ported (see `schemas/assignment.ts` for why), so this is
 * the visibility half of that page, not the authoring half.
 */
export function AssignmentsSurface() {
  const { t } = useTranslation();
  const { groupId = '' } = useParams<{ groupId: string }>();

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<GroupAssignmentStatus | typeof ALL>(ALL);
  const [assignmentType, setAssignmentType] = useState<GroupAssignmentType | typeof ALL>(ALL);
  const [page, setPage] = useState(1);

  const query = useGroupAssignments({
    groupId,
    keyword: keyword || undefined,
    status: status === ALL ? undefined : status,
    assignmentType: assignmentType === ALL ? undefined : assignmentType,
    skip: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const rows = query.data?.assignments ?? [];
  const pagination = query.data?.pagination;

  const columns: ListColumn<Assignment>[] = [
    {
      id: 'learner',
      header: t('assignments.columns.learner'),
      cell: (assignment) => userDisplayName(assignment.user),
    },
    {
      id: 'content',
      header: t('assignments.columns.content'),
      cell: (assignment) => assignment.contentId.title,
    },
    {
      id: 'type',
      header: t('assignments.columns.type'),
      cell: (assignment) => t(`assignments.type.${assignment.assignmentType}`),
    },
    {
      id: 'dueDate',
      header: t('assignments.columns.dueDate'),
      cell: (assignment) => formatDate(assignment.dueDate),
    },
    {
      id: 'status',
      header: t('assignments.columns.status'),
      cell: (assignment) => (
        <StatusPill
          tone={assignmentStatusTone(assignment.status)}
          label={t(`assignments.status.${assignment.status}`)}
        />
      ),
    },
  ];

  if (query.isError) {
    return (
      <section aria-label={t('assignments.title')}>
        <h2 className="mb-3 text-[17px] font-semibold text-ink">{t('assignments.title')}</h2>
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={t('assignments.error.title')}
          description={isApiError(query.error) ? query.error.message : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {t('assignments.error.retry')}
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section aria-label={t('assignments.title')}>
      <h2 className="mb-3 text-[17px] font-semibold text-ink">{t('assignments.title')}</h2>

      <div className="flex flex-wrap items-center gap-2 pb-3">
        <Input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder={t('assignments.searchPlaceholder')}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as GroupAssignmentStatus | typeof ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" placeholder={t('assignments.filters.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('assignments.filters.allStatuses')}</SelectItem>
            {GROUP_ASSIGNMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`assignments.status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={assignmentType}
          onValueChange={(value) => {
            setAssignmentType(value as GroupAssignmentType | typeof ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" placeholder={t('assignments.filters.type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('assignments.filters.allTypes')}</SelectItem>
            {GROUP_ASSIGNMENT_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`assignments.type.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(assignment) => assignment.id}
        sort={[]}
        onSortChange={() => {}}
        loading={query.isPending}
        empty={
          <EmptyState
            title={t('assignments.empty.title')}
            description={t('assignments.empty.description')}
          />
        }
        caption={t('assignments.title')}
      />

      {pagination && pagination.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((current) => current - 1)}
            aria-label={t('pagination.previous')}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="text-body text-ink-dim">
            {t('pagination.range', {
              from: pagination.skip + 1,
              to: Math.min(pagination.skip + pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </span>
          <Button
            variant="secondary"
            size="icon"
            disabled={!pagination.hasMore || query.isFetching}
            onClick={() => setPage((current) => current + 1)}
            aria-label={t('pagination.next')}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </section>
  );
}
