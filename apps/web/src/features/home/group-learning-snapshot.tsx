import {
  isApiError,
  useDashboardGroupCharts,
  useDashboardQBankStats,
  useDashboardScanProgress,
  useGroupCourses,
} from '@sector/api-client';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  EmptyState,
  Skeleton,
} from '@sector/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { groupMembersPathFor } from '@/features/groups/groups-links';

import { CardError } from './card-error';
import {
  courseSegmentsToChartData,
  groupCourseChartQuery,
  groupScanBars,
  selectedOptionValue,
} from './chart-adapters';
import { Bars, Donut } from './lazy-charts';

export type GroupLearningSnapshotProps = {
  groupId: string;
  groupName: string;
};

/**
 * One group's course/scan snapshot — the group-leader home's primary content,
 * and the reviewer/administrator homes' group-scoped section.
 *
 * Deliberately does NOT render a member table: Phase 8 already built one
 * members surface (`features/groups`), and a second table that rebuilds the
 * same rows here is exactly the duplication this screen exists to remove.
 * "View members" links to it instead.
 *
 * Two things the server makes this screen's job, not the API's:
 *
 *   - the course donut needs a `courseId`. `GET /api/dashboard/charts` fills
 *     `courseProgressChart` only when the request carries one, so the card
 *     asks which course first (`useGroupCourses`) and stays out of the way
 *     until it can ask a question with an answer.
 *   - the scan bars come from `scan-progress-by-user?groupId=`, never from
 *     the same `charts` response, whose scan array is unscoped for a group
 *     with no learners. See `groupScanBars`.
 */
export function GroupLearningSnapshot({ groupId, groupName }: GroupLearningSnapshotProps) {
  const { t } = useTranslation();
  const [chosenCourseId, setChosenCourseId] = useState<string>('');

  const courses = useGroupCourses(groupId, { limit: 50 });
  const courseOptions = useMemo(
    () => (courses.data?.items ?? []).map((course) => ({ value: course.id, label: course.title })),
    [courses.data],
  );
  const courseId = selectedOptionValue(courseOptions, chosenCourseId);

  const charts = useDashboardGroupCharts(groupCourseChartQuery(groupId, courseId));
  const scans = useDashboardScanProgress({ groupId });
  const qbank = useDashboardQBankStats({ groupId });

  const scanBars = groupScanBars(t, scans.data);
  // `assertLeadsGroup` guards the group's course list, and an administrator
  // who is not a leader of this group may list it without being able to open
  // it. That is a refusal, not a breakage, so it reads as a note rather than
  // as a red error card.
  const coursesForbidden = isApiError(courses.error) && courses.error.isForbidden;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">
          {t('home.group.title', { groupName })}
        </h2>
        <Button asChild variant="secondary" size="sm">
          <Link to={groupMembersPathFor(groupId)}>{t('home.group.viewMembers')}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t('home.group.courseProgress')}</CardTitle>
              {courseOptions.length > 0 ? (
                <Combobox
                  label={t('home.group.course')}
                  options={courseOptions}
                  selected={courseId ? [courseId] : []}
                  onSelect={setChosenCourseId}
                  placeholder={t('home.group.selectCourse')}
                  className="w-full sm:w-56"
                />
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {courses.isPending || (courseId && charts.isPending) ? (
              <Skeleton className="h-[240px] w-full" />
            ) : coursesForbidden ? (
              <EmptyState title={t('home.group.coursesRestricted')} />
            ) : courses.isError ? (
              <CardError error={courses.error} onRetry={() => void courses.refetch()} />
            ) : charts.isError ? (
              <CardError error={charts.error} onRetry={() => void charts.refetch()} />
            ) : courseOptions.length === 0 ? (
              <EmptyState title={t('home.group.noCourses')} />
            ) : (
              <Donut
                data={courseSegmentsToChartData(t, charts.data?.courseProgressChart.segments ?? [])}
                totalLabel={
                  charts.data ? `${charts.data.courseProgressChart.totalLearners}` : undefined
                }
                emptyTitle={t('home.group.noCourseProgress')}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('home.group.scanProgress')}</CardTitle>
          </CardHeader>
          <CardContent>
            {scans.isPending ? (
              <Skeleton className="h-[240px] w-full" />
            ) : scans.isError ? (
              <CardError error={scans.error} onRetry={() => void scans.refetch()} />
            ) : (
              <Bars data={scanBars} emptyTitle={t('home.group.noScanProgress')} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.group.qbank')}</CardTitle>
        </CardHeader>
        <CardContent>
          {qbank.isPending ? (
            <Skeleton className="h-[160px] w-full" />
          ) : qbank.isError ? (
            <CardError error={qbank.error} onRetry={() => void qbank.refetch()} />
          ) : (qbank.data?.chartData.length ?? 0) === 0 ? (
            <p className="text-body text-ink-dim">{t('home.group.noQbank')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(qbank.data?.chartData ?? []).slice(0, 6).map((item) => (
                <li key={item.quizId} className="flex items-center justify-between gap-2 text-body">
                  <span className="truncate text-ink">{item.name}</span>
                  <span className="sv-num shrink-0 text-ink-dim">
                    {t('home.group.bestScore', { score: Math.round(item.highestScore) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
