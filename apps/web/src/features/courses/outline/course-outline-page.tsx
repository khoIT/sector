import { isApiError, useCourseOutline } from '@sector/api-client';
import { Button, EmptyState, Skeleton } from '@sector/ui';
import { ChevronLeft, CircleCheck, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';

import { COURSES_PATH, courseItemPathFor } from '../courses-links';
import { roundedProgress } from '../my-courses/course-row-model';
import { CourseOutlineItemRow } from './course-outline-item-row';
import {
  groupOutlineItemsForDisplay,
  isOutlineComplete,
  resolveResumeTarget,
  resumeActionLabelKey,
} from './course-outline-model';

/** `my-courses-page.tsx` does not currently carry the course title into
 *  navigation (My Courses links by id, not by `<Link state>`), and the
 *  outline route itself has no title field — `courseId` is all it resolves.
 *  A future link from My Courses can add `state.title` the way
 *  `groups-index-page.tsx` does for a group name; until then the heading
 *  falls back to a generic label rather than a fetch of its own just to
 *  name the page. */
type OutlineLocationState = { title?: string } | null | undefined;

export function CourseOutlinePage() {
  const { t } = useTranslation();
  const { courseId = '' } = useParams<{ courseId: string }>();
  const location = useLocation();
  const title = (location.state as OutlineLocationState)?.title;

  const query = useCourseOutline({ courseId });

  if (query.isPending) {
    return (
      <section aria-label={t('courses.outline.title')}>
        <BackLink />
        <Skeleton className="mb-4 h-6 w-2/3" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-token" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section aria-label={t('courses.outline.title')}>
        <BackLink />
        <EmptyState
          tone="crit"
          icon={<TriangleAlert className="h-5 w-5" aria-hidden />}
          title={t('courses.outline.error.title')}
          description={isApiError(query.error) ? query.error.message : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {t('courses.outline.error.retry')}
            </Button>
          }
        />
      </section>
    );
  }

  const outline = query.data;
  const percent = roundedProgress(outline.progress);
  const groups = groupOutlineItemsForDisplay(outline.items);
  const resumeItem = resolveResumeTarget(outline.items, outline.resume?.itemId ?? null);
  // Completion is something the outline REPORTS, not something the absence of
  // a resume pointer implies. A course with no published content has nothing
  // to resume and nothing completed either, and telling that learner they had
  // finished it was the plainest thing on the page that was untrue.
  const isComplete = isOutlineComplete(outline);

  return (
    <section aria-label={t('courses.outline.title')}>
      <BackLink />
      <h2 className="mb-1 text-[17px] font-semibold text-ink">
        {title ?? t('courses.outline.title')}
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <p className="sv-num text-body text-ink-dim">
          {t('courses.outline.progress', {
            completed: outline.completedItems,
            total: outline.totalItems,
            percent,
          })}
        </p>
      </div>

      {resumeItem ? (
        <Button asChild className="mb-4">
          <Link to={courseItemPathFor(courseId, resumeItem.id)} state={{ title }}>
            {t(resumeActionLabelKey(resumeItem.status), { title: resumeItem.title })}
          </Link>
        </Button>
      ) : isComplete ? (
        <div className="mb-4 flex items-center gap-2 rounded-token border border-line bg-ok-soft px-3 py-2 text-body text-ok">
          <CircleCheck className="h-4 w-4" aria-hidden />
          {t('courses.outline.completedBanner')}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState title={t('courses.outline.empty.title')} />
      ) : (
        <ol className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.header.id} className="flex flex-col gap-1.5">
              <CourseOutlineItemRow
                courseId={courseId}
                courseTitle={title}
                item={group.header}
                indent={false}
                isResumeTarget={group.header.id === resumeItem?.id}
              />
              {group.children.length > 0 ? (
                <ol className="flex flex-col gap-1.5">
                  {group.children.map((child) => (
                    <li key={child.id}>
                      <CourseOutlineItemRow
                        courseId={courseId}
                        courseTitle={title}
                        item={child}
                        indent
                        isResumeTarget={child.id === resumeItem?.id}
                      />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}
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
