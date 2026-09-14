import {
  useDashboardGroupCharts,
  useDashboardQBankStats,
  useDashboardScanProgress,
} from '@sector/api-client';
import {
  Bars,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Donut,
  Skeleton,
} from '@sector/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { groupMembersPathFor } from '@/features/groups/groups-links';

import { courseSegmentsToChartData, groupScanChartToChartData } from './chart-adapters';

export type GroupLearningSnapshotProps = {
  groupId: string;
  groupName: string;
};

/**
 * One group's course/scan snapshot — the group-leader home's primary
 * content, and the reviewer/administrator homes' group-scoped section.
 *
 * Deliberately does NOT render a member table: Phase 8 already built one
 * members surface (`features/groups`), and a second table that rebuilds the
 * same rows here is exactly the duplication this phase exists to remove.
 * "View members" links to it instead.
 */
export function GroupLearningSnapshot({ groupId, groupName }: GroupLearningSnapshotProps) {
  const { t } = useTranslation();

  const charts = useDashboardGroupCharts({ groupId });
  const scans = useDashboardScanProgress({ groupId });
  const qbank = useDashboardQBankStats({ groupId });

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
            <CardTitle>{t('home.group.courseProgress')}</CardTitle>
          </CardHeader>
          <CardContent>
            {charts.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
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
            {charts.isLoading || scans.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <Bars
                data={
                  charts.data ? groupScanChartToChartData(t, charts.data.scanProgressChart) : []
                }
                emptyTitle={t('home.group.noScanProgress')}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.group.qbank')}</CardTitle>
        </CardHeader>
        <CardContent>
          {qbank.isLoading ? (
            <Skeleton className="h-[160px] w-full" />
          ) : (qbank.data?.chartData.length ?? 0) === 0 ? (
            <p className="text-body text-ink-dim">{t('home.group.noQbank')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {qbank.data!.chartData.slice(0, 6).map((item) => (
                <li key={item.quizId} className="flex items-center justify-between gap-2 text-body">
                  <span className="truncate text-ink">{item.name}</span>
                  <span className="sv-num shrink-0 text-ink-dim">
                    {t('home.group.averageScore', { score: Math.round(item.highestScore) })}
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
