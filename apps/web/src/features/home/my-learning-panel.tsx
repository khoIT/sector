import {
  useCourses,
  useDashboardCourseCompletionTimeline,
  useDashboardCourseProgress,
  useDashboardQBankStats,
  useDashboardQuizProgress,
  useDashboardScanProgress,
  useDashboardTopCourseProgress,
  useDashboardTopicProgress,
} from '@sector/api-client';
import {
  Bars,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  Donut,
  LineTrend,
  Skeleton,
  Sparkline,
} from '@sector/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { courseSegmentsToChartData, scanItemsToChartData } from './chart-adapters';

export type MyLearningPanelProps = {
  /** Omit for "me"; pass a groupId to scope the scan/qbank/topic/quiz cards to
   *  a group instead (still the caller's OWN course-progress selector, since
   *  there is no per-member drill-down here — see Phase 8's member surface
   *  for that). */
  groupId?: string;
};

/**
 * "My learning": the panel every role sees, because every role can also be a
 * learner. The learner home uses it as the whole page; the other three use it
 * as one section alongside their group- or queue-scoped content.
 */
export function MyLearningPanel({ groupId }: MyLearningPanelProps) {
  const { t } = useTranslation();
  const [courseId, setCourseId] = useState<string>('');

  const courses = useCourses({ query: { limit: 100, sortBy: 'lastAccessedAt:desc' } });
  const courseOptions = useMemo(
    () =>
      (courses.data?.items ?? []).map((item) => ({
        value: item.course.id,
        label: item.course.title,
      })),
    [courses.data],
  );
  const selectedCourseId = courseId || courseOptions[0]?.value || '';

  const courseProgress = useDashboardCourseProgress(
    selectedCourseId ? { courseId: selectedCourseId } : undefined,
  );
  const timeline = useDashboardCourseCompletionTimeline(
    selectedCourseId ? { courseId: selectedCourseId } : undefined,
  );
  const scanProgress = useDashboardScanProgress({ groupId });
  const qbank = useDashboardQBankStats({ groupId });
  const topics = useDashboardTopicProgress({ groupId, courseId: selectedCourseId || undefined });
  const quizzes = useDashboardQuizProgress({ groupId, courseId: selectedCourseId || undefined });
  const topCourses = useDashboardTopCourseProgress({ limit: 5 });

  const timelinePoints = (timeline.data?.chartData ?? []).map((day) => ({
    label: day.date,
    value: day.value,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{t('home.myLearning.title')}</h2>
        {courseOptions.length > 0 ? (
          <Combobox
            label={t('home.myLearning.course')}
            options={courseOptions}
            selected={selectedCourseId ? [selectedCourseId] : []}
            onSelect={setCourseId}
            placeholder={t('home.myLearning.selectCourse')}
            className="w-full sm:w-72"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('home.myLearning.courseProgress')}</CardTitle>
          </CardHeader>
          <CardContent>
            {courseProgress.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <Donut
                data={courseSegmentsToChartData(t, courseProgress.data?.segments ?? [])}
                totalLabel={courseProgress.data ? `${courseProgress.data.totalModules}` : undefined}
                emptyTitle={t('home.myLearning.noCourseProgress')}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('home.myLearning.scanProgress')}</CardTitle>
          </CardHeader>
          <CardContent>
            {scanProgress.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <Bars
                data={scanItemsToChartData(t, scanProgress.data?.chartData ?? [])}
                emptyTitle={t('home.myLearning.noScanProgress')}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('home.myLearning.qbank')}</CardTitle>
          </CardHeader>
          <CardContent>
            {qbank.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (qbank.data?.chartData.length ?? 0) === 0 ? (
              <p className="text-body text-ink-dim">{t('home.myLearning.noQbank')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {qbank.data!.chartData.slice(0, 5).map((item) => (
                  <li
                    key={item.quizId}
                    className="flex items-center justify-between gap-2 text-body"
                  >
                    <span className="truncate text-ink">{item.name}</span>
                    <span className="sv-num shrink-0 text-ink-dim">
                      {t('home.myLearning.attempts', { count: item.attempts })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>{t('home.myLearning.timeline')}</CardTitle>
              <Sparkline values={timelinePoints.map((point) => point.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {timeline.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <LineTrend
                data={timelinePoints}
                valueFormatter={(value) => `${Math.round(value)}%`}
                emptyTitle={t('home.myLearning.noTimeline')}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('home.myLearning.topCourses')}</CardTitle>
          </CardHeader>
          <CardContent>
            {topCourses.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <Bars
                horizontal
                data={(topCourses.data?.courses ?? []).map((course) => ({
                  code: course.courseId,
                  label: course.courseName,
                  value: Math.round(course.progress),
                  tone: 'accent' as const,
                }))}
                emptyTitle={t('home.myLearning.noTopCourses')}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('home.myLearning.topics')}</CardTitle>
          </CardHeader>
          <CardContent>
            {(topics.data?.progressList.length ?? 0) === 0 ? (
              <p className="text-body text-ink-dim">{t('home.myLearning.noTopics')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topics.data!.progressList.slice(0, 5).map((topic) => (
                  <li key={topic.id} className="flex items-center justify-between gap-2 text-body">
                    <span className="truncate text-ink">{topic.title}</span>
                    <span className="sv-num shrink-0 text-ink-dim">
                      {Math.round(topic.completionPercentage)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('home.myLearning.quizzes')}</CardTitle>
          </CardHeader>
          <CardContent>
            {(quizzes.data?.progressList.length ?? 0) === 0 ? (
              <p className="text-body text-ink-dim">{t('home.myLearning.noQuizzes')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {quizzes.data!.progressList.slice(0, 5).map((quiz) => (
                  <li key={quiz.id} className="flex items-center justify-between gap-2 text-body">
                    <span className="truncate text-ink">{quiz.title}</span>
                    <span className="sv-num text-ink-dim">{Math.round(quiz.passRate)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
