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
import { Card, CardContent, CardHeader, CardTitle, Combobox, Skeleton } from '@sector/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CardError } from './card-error';
import {
  courseSegmentsToChartData,
  scanItemsToChartData,
  selectedOptionValue,
} from './chart-adapters';
import { Bars, Donut, LineTrend, Sparkline } from './lazy-charts';

/**
 * "My learning": the panel every role sees, because every role can also be a
 * learner. The learner home uses it as the whole page; the other three use it
 * as one section alongside their group- or queue-scoped content.
 *
 * Every card here distinguishes three states — loading, failed, empty. They
 * are not the same thing, and rendering a 403 or a 500 as "nothing yet" is how
 * a broken screen passes for a healthy one.
 */
export function MyLearningPanel() {
  const { t } = useTranslation();
  const [chosenCourseId, setChosenCourseId] = useState<string>('');

  const courses = useCourses({ query: { limit: 100 } });
  // Most recently touched first, sorted here rather than by the route's
  // `sortBy`: `/api/v2/learners/courses` sorts with `item[sortBy]`, and
  // `lastAccessedAt` lives on `item.progress`, so `sortBy=lastAccessedAt:desc`
  // silently sorted on undefined and returned the list untouched.
  const courseOptions = useMemo(
    () =>
      [...(courses.data?.items ?? [])]
        .sort((a, b) =>
          (b.progress.lastAccessedAt ?? '').localeCompare(a.progress.lastAccessedAt ?? ''),
        )
        .map((item) => ({
          value: item.course.id,
          label: item.course.title,
        })),
    [courses.data],
  );
  const selectedCourseId = selectedOptionValue(courseOptions, chosenCourseId);

  const courseProgress = useDashboardCourseProgress(
    selectedCourseId ? { courseId: selectedCourseId } : undefined,
  );
  const timeline = useDashboardCourseCompletionTimeline(
    selectedCourseId ? { courseId: selectedCourseId } : undefined,
  );
  const scanProgress = useDashboardScanProgress();
  const qbank = useDashboardQBankStats();
  const topics = useDashboardTopicProgress({ courseId: selectedCourseId || undefined });
  const quizzes = useDashboardQuizProgress({ courseId: selectedCourseId || undefined });
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
            onSelect={setChosenCourseId}
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
            {courses.isPending || (selectedCourseId && courseProgress.isPending) ? (
              <Skeleton className="h-[240px] w-full" />
            ) : courses.isError ? (
              <CardError error={courses.error} onRetry={() => void courses.refetch()} />
            ) : courseProgress.isError ? (
              <CardError
                error={courseProgress.error}
                onRetry={() => void courseProgress.refetch()}
              />
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
            {scanProgress.isPending ? (
              <Skeleton className="h-[240px] w-full" />
            ) : scanProgress.isError ? (
              <CardError error={scanProgress.error} onRetry={() => void scanProgress.refetch()} />
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
            {qbank.isPending ? (
              <Skeleton className="h-[240px] w-full" />
            ) : qbank.isError ? (
              <CardError error={qbank.error} onRetry={() => void qbank.refetch()} />
            ) : (qbank.data?.chartData.length ?? 0) === 0 ? (
              <p className="text-body text-ink-dim">{t('home.myLearning.noQbank')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(qbank.data?.chartData ?? []).slice(0, 5).map((item) => (
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
            {selectedCourseId && timeline.isPending ? (
              <Skeleton className="h-[220px] w-full" />
            ) : timeline.isError ? (
              <CardError error={timeline.error} onRetry={() => void timeline.refetch()} />
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
            {topCourses.isPending ? (
              <Skeleton className="h-[220px] w-full" />
            ) : topCourses.isError ? (
              <CardError error={topCourses.error} onRetry={() => void topCourses.refetch()} />
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
            {topics.isPending ? (
              <Skeleton className="h-[120px] w-full" />
            ) : topics.isError ? (
              <CardError error={topics.error} onRetry={() => void topics.refetch()} />
            ) : (topics.data?.progressList.length ?? 0) === 0 ? (
              <p className="text-body text-ink-dim">{t('home.myLearning.noTopics')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(topics.data?.progressList ?? []).slice(0, 5).map((topic) => (
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
            {quizzes.isPending ? (
              <Skeleton className="h-[120px] w-full" />
            ) : quizzes.isError ? (
              <CardError error={quizzes.error} onRetry={() => void quizzes.refetch()} />
            ) : (quizzes.data?.progressList.length ?? 0) === 0 ? (
              <p className="text-body text-ink-dim">{t('home.myLearning.noQuizzes')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(quizzes.data?.progressList ?? []).slice(0, 5).map((quiz) => (
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
