import { useGroupCourses, useGroupProgressReport } from '@sector/api-client';
import {
  Badge,
  EmptyState,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@sector/ui';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardError } from '../../home/card-error';
import {
  formatLastActive,
  learnerName,
  sortReportRows,
  type ReportSortKey,
} from './report-row-model';

export type GroupProgressTableProps = {
  groupId: string;
};

/**
 * Who in this group has done what, on screen rather than only in a download.
 *
 * Reads the SAME route as the CSV and xlsx exports on this tab, so a leader
 * who reads a number here and exports the spreadsheet gets one answer. Before
 * this, the on-screen report trusted a cached percentage while the export
 * recomputed it, and the two could disagree by more than five points without
 * anything saying so.
 */
export function GroupProgressTable({ groupId }: GroupProgressTableProps) {
  const { t } = useTranslation();
  const [courseId, setCourseId] = useState('');
  const [sortKey, setSortKey] = useState<ReportSortKey>('completion');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');

  const courses = useGroupCourses(groupId, { limit: 50 });
  const report = useGroupProgressReport(groupId, courseId || undefined);

  const rows = useMemo(
    () => sortReportRows(report.data ?? [], sortKey, direction),
    [report.data, sortKey, direction],
  );

  function toggleSort(key: ReportSortKey) {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    // Ascending on the two "who needs chasing" columns puts the worst first;
    // on overdue the large number is the problem, so it leads descending.
    setDirection(key === 'overdue' ? 'desc' : 'asc');
  }

  function SortableHeader({ column, label }: { column: ReportSortKey; label: string }) {
    const active = sortKey === column;
    const Icon = direction === 'asc' ? ArrowUp : ArrowDown;

    return (
      <TableHeaderCell>
        <button
          type="button"
          onClick={() => toggleSort(column)}
          className="inline-flex items-center gap-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
          aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          {label}
          {active ? <Icon className="h-3 w-3" aria-hidden /> : null}
        </button>
      </TableHeaderCell>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-xs flex-wrap items-center gap-2">
        <Select
          value={courseId}
          onValueChange={setCourseId}
          aria-label={t('groups.report.courseFilter')}
        >
          <option value="">{t('groups.report.allCourses')}</option>
          {(courses.data?.items ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>
      </div>

      {report.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : report.isError ? (
        // A 403 rendered as "no learners yet" is how a permission problem
        // passes for an empty group.
        <CardError error={report.error} onRetry={() => void report.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={courseId ? t('groups.report.empty.course') : t('groups.report.empty.group')}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <SortableHeader column="name" label={t('groups.report.column.learner')} />
                <TableHeaderCell>{t('groups.report.column.course')}</TableHeaderCell>
                <SortableHeader column="completion" label={t('groups.report.column.completion')} />
                <TableHeaderCell>{t('groups.report.column.steps')}</TableHeaderCell>
                <SortableHeader column="lastActive" label={t('groups.report.column.lastActive')} />
                <SortableHeader column="overdue" label={t('groups.report.column.overdue')} />
              </TableRow>
            </TableHead>
            <TableBody>
              {/*
                A learner can appear twice under one course: the report is
                built from group memberships, and the same person can hold two
                of them. Email plus course name is therefore not unique, and
                keying on it alone makes React treat two distinct rows as one.
              */}
              {rows.map((row, index) => (
                <TableRow key={`${row.Email}-${row['Course Name']}-${index}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-ink">{learnerName(row)}</span>
                      <span className="text-[12px] text-ink-dim">{row.Email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{row['Course Name']}</TableCell>
                  <TableCell className="sv-num">{row['Completion Percentage']}</TableCell>
                  <TableCell className="sv-num">{row['Completed Steps']}</TableCell>
                  <TableCell>{formatLastActive(row, t)}</TableCell>
                  <TableCell>
                    {row.assignments.overdue > 0 ? (
                      <Badge tone="crit">{row.assignments.overdue}</Badge>
                    ) : (
                      <span className="sv-num text-ink-dim">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
