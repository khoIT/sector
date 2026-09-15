import { isApiError, useCourseOutline } from '@sector/api-client';
import { Button, EmptyState, Skeleton } from '@sector/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';

import { COURSES_PATH, coursePathFor } from '../courses-links';
import { findOutlineItem } from '../outline/course-outline-model';
import { CourseLayout } from './course-layout';
import { LessonView } from './lesson-view';
import { OutlineSidebar } from './outline-sidebar';
import { QuizView } from './quiz-view';
import { TopicView } from './topic-view';

/**
 * `/learn/courses/:courseId/:itemId` — the ONE route every nesting shape the
 * outline resolves opens through: a lesson, a topic, a course-level or
 * topic-nested quiz, all dispatched off `item.kind` rather than four
 * separate route trees the way the legacy dashboard mounted them. Reuses the
 * Phase 6 outline query verbatim; nothing here re-fetches or re-derives the
 * tree — the sidebar groups the SAME resolved array the outline page does.
 */
export function CourseRunnerPage() {
  const { t } = useTranslation();
  const { courseId = '', itemId = '' } = useParams<{ courseId: string; itemId: string }>();
  const location = useLocation();
  // Same `{ title }` shape and the same reasoning as
  // `course-outline-page.tsx`'s `OutlineLocationState`: no route here can
  // guarantee a real course title without a fetch of its own, so a title
  // carried forward via `<Link state>` is a fallback, not a requirement.
  const courseTitle = (location.state as { title?: string } | null | undefined)?.title;

  const outlineQuery = useCourseOutline({ courseId });

  if (outlineQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-1/2" />
        <div className="flex flex-col-reverse gap-4 lg:flex-row">
          <Skeleton className="h-64 flex-1" />
          <Skeleton className="h-64 w-full lg:w-80" />
        </div>
      </div>
    );
  }

  if (outlineQuery.isError) {
    // A 404 here is the access rule answering, not a transient failure: the
    // outline route 404s for an enrolment that has since expired, even
    // though the SAME row still appears in My Courses' `expired` array (see
    // the blocker-remediation report's unresolved question 2). My Courses
    // already renders an expired row as text rather than a link, so this
    // path is a stale bookmark or deep link, not the ordinary flow — and a
    // "Try again" action would be actively misleading: the outline will
    // never come back for this learner and this course.
    const isExpiredOrMissing = isApiError(outlineQuery.error) && outlineQuery.error.isNotFound;

    return (
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
    );
  }

  const outline = outlineQuery.data;
  const item = findOutlineItem(outline.items, itemId);

  if (!item) {
    return (
      <EmptyState
        title={t('courses.runner.itemNotFound.title')}
        description={t('courses.runner.itemNotFound.description')}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to={coursePathFor(courseId)}>{t('courses.outline.title')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <CourseLayout
      courseId={courseId}
      courseTitle={courseTitle}
      itemTitle={item.title}
      progress={outline.progress}
      sidebar={<OutlineSidebar courseId={courseId} items={outline.items} currentItemId={item.id} />}
    >
      {item.kind === 'lesson' ? (
        <LessonView
          courseId={courseId}
          courseTitle={courseTitle}
          item={item}
          items={outline.items}
        />
      ) : null}
      {item.kind === 'topic' ? <TopicView courseId={courseId} item={item} /> : null}
      {item.kind === 'quiz' ? <QuizView courseId={courseId} item={item} /> : null}
    </CourseLayout>
  );
}
