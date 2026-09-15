import { useCourses } from '@sector/api-client';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@sector/ui';
import { PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { courseItemPathFor, coursePathFor } from '../courses/courses-links';
import { CardError } from './card-error';
import { formatPlayheadTimestamp, selectContinueLearning } from './continue-learning-model';

/**
 * "Pick up where you left off" — the first thing a returning learner sees.
 *
 * This is the re-entry surface the roadmap is built around: production says
 * 58% of started courses stall under 25% and learners do not come back on
 * their own. The row exists so coming back is one click from the home screen
 * rather than three through My Courses.
 *
 * Like every other card on this screen it distinguishes loading, failed and
 * empty — rendering a 500 as "nothing in progress" is how a broken screen
 * passes for a healthy one.
 */
export function ContinueLearningRow() {
  const { t } = useTranslation();
  // `in_progress` alone would miss a course whose counters drifted; the model
  // applies the real rule and the server's own paging keeps this cheap.
  const courses = useCourses({ query: { limit: 20, sortBy: 'progress.lastAccessedAt:desc' } });

  const entries = courses.data ? selectContinueLearning(courses.data.items) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.continueLearning.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {courses.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : courses.isError ? (
          <CardError error={courses.error} onRetry={() => void courses.refetch()} />
        ) : entries.length === 0 ? (
          <p className="text-body text-ink-dim">{t('home.continueLearning.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => {
              const playhead = formatPlayheadTimestamp(entry.resumePositionSeconds);
              return (
                <li key={entry.courseId}>
                  <Link
                    // Straight to the item when the server resolved one;
                    // otherwise the outline, which is still a resume of sorts.
                    to={
                      entry.resumeItemId
                        ? courseItemPathFor(entry.courseId, entry.resumeItemId)
                        : coursePathFor(entry.courseId)
                    }
                    className="flex items-center gap-3 rounded-token border border-line bg-surface px-3 py-2 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink"
                  >
                    <PlayCircle className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-ink">{entry.courseTitle}</span>
                      {entry.resumeItemTitle ? (
                        <span className="block truncate text-[12px] text-ink-dim">
                          {playhead
                            ? t('home.continueLearning.resumeAt', {
                                title: entry.resumeItemTitle,
                                timestamp: playhead,
                              })
                            : entry.resumeItemTitle}
                        </span>
                      ) : null}
                    </span>
                    <span className="sv-num shrink-0 text-[12px] text-ink-dim">
                      {t('home.continueLearning.percent', { percent: entry.percent })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
