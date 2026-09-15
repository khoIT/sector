import { isApiError, useCourseOutline } from '@sector/api-client';
import { Button, EmptyState, Skeleton } from '@sector/ui';
import { ChevronLeft, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useMatch, useParams } from 'react-router-dom';

import { COURSES_PATH } from '../courses-links';
import { OutlineSidebar } from '../runner/outline-sidebar';
import type { CourseShellContext } from './course-shell-context';
import { CourseShellHeader } from './course-shell-header';

/**
 * The layout route every course surface opens through: it owns the outline
 * query and the chrome, and the outline page and the item views mount inside
 * it as children.
 *
 * The point is what does NOT happen on a navigation. Before this, moving from
 * one topic to the next was a full route change: the item route refetched the
 * outline, rebuilt the header and rebuilt the contents pane, so the pane the
 * learner was reading flickered away and came back on every click. Hoisting
 * the query and the pane here means a move between two items swaps only the
 * child — the contents pane and the course header never unmount.
 *
 * The contents pane shows on item routes only. On the index the outline page
 * IS the contents list, and rendering both would put the same tree on screen
 * twice.
 */
export function CourseShell() {
  const { t } = useTranslation();
  const { courseId = '' } = useParams<{ courseId: string }>();
  const location = useLocation();
  const itemMatch = useMatch(`${COURSES_PATH}/:courseId/:itemId`);
  const currentItemId = itemMatch?.params.itemId ?? null;
  const courseTitle = (location.state as { title?: string } | null | undefined)?.title;

  const outlineQuery = useCourseOutline({ courseId });

  if (outlineQuery.isPending) {
    return (
      <section aria-label={t('courses.outline.title')} className="flex flex-col gap-4">
        <BackLink />
        <Skeleton className="h-6 w-2/3" />
        <div className="flex flex-col gap-4 lg:flex-row">
          <Skeleton className="h-64 w-full lg:w-80" />
          <Skeleton className="h-64 flex-1" />
        </div>
      </section>
    );
  }

  if (outlineQuery.isError) {
    // A 404 here is the access rule answering, not a transient failure: the
    // outline route 404s for an enrolment that has since expired, even though
    // the SAME row still appears in My Courses' `expired` array. My Courses
    // renders an expired row as text rather than a link, so this path is a
    // stale bookmark or a deep link, not the ordinary flow — and a "Try again"
    // action would be actively misleading, because the outline will never come
    // back for this learner and this course.
    const isExpiredOrMissing = isApiError(outlineQuery.error) && outlineQuery.error.isNotFound;

    return (
      <section aria-label={t('courses.outline.title')}>
        <BackLink />
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={
            isExpiredOrMissing
              ? t('courses.runner.noLongerAvailable.title')
              : t('courses.outline.error.title')
          }
          description={
            isExpiredOrMissing
              ? t('courses.runner.noLongerAvailable.description')
              : isApiError(outlineQuery.error)
                ? outlineQuery.error.message
                : undefined
          }
          action={
            isExpiredOrMissing ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={COURSES_PATH}>{t('courses.index.title')}</Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => void outlineQuery.refetch()}>
                {t('courses.outline.error.retry')}
              </Button>
            )
          }
        />
      </section>
    );
  }

  const outline = outlineQuery.data;
  const context: CourseShellContext = { courseId, courseTitle, outline };

  return (
    <section aria-label={t('courses.outline.title')} className="flex flex-col gap-4">
      <div>
        <BackLink />
        <CourseShellHeader courseTitle={courseTitle} outline={outline} />
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        {currentItemId ? (
          <div className="w-full flex-shrink-0 lg:w-80">
            <OutlineSidebar
              courseId={courseId}
              items={outline.items}
              currentItemId={currentItemId}
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <Outlet context={context} />
        </div>
      </div>
    </section>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to={COURSES_PATH}
      className="mb-2 inline-flex items-center gap-1 text-body text-accent-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      {t('courses.outline.backToCourses')}
    </Link>
  );
}
