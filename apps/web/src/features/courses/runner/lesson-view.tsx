import type { CourseOutlineItem } from '@sector/api-client';
import { useCourseLessonDetail } from '@sector/api-client';
import { Button, EmptyState, RichText, Skeleton } from '@sector/ui';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { hasSubstantiveProse } from '../module/lesson-body';
import { ModulePage } from '../module/module-page';
import { CourseItemNav } from './course-item-nav';
import { useTrackCourseItemView } from './use-track-course-item-view';

export type LessonViewProps = {
  courseId: string;
  courseTitle: string | undefined;
  item: CourseOutlineItem;
  /** The whole resolved outline, for the module grid below the body. */
  items: readonly CourseOutlineItem[];
};

/**
 * A lesson: whatever it teaches in prose, then the topics and quizzes under
 * it as cards.
 *
 * The authored body used to be the entire page. On two thirds of the library
 * that body is only a table of links to the lesson's own children, and most
 * of those links are absolute URLs on the retired dashboard host, so they
 * open a new tab on a host that is going away. The card grid renders the same
 * children from the outline instead — in server order, with this learner's
 * status, the runtime and a thumbnail.
 *
 * The body is still shown when it teaches something (207 of 606 lessons), and
 * suppressed when it is only that link table (see `lesson-body.ts`). Nothing
 * is deleted from the database either way.
 *
 * Completion stays entirely server-derived (see `use-track-course-item-view.ts`):
 * a lesson with no published topics/quizzes under it completes the instant it
 * is viewed.
 */
export function LessonView({ courseId, courseTitle, item, items }: LessonViewProps) {
  const { t } = useTranslation();
  const detail = useCourseLessonDetail(courseId, item.id);
  useTrackCourseItemView(courseId, 'lesson', item.id);

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <EmptyState
        tone="crit"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        title={t('courses.runner.lesson.error.title')}
        description={detail.error instanceof Error ? detail.error.message : undefined}
        action={
          <Button variant="secondary" size="sm" onClick={() => void detail.refetch()}>
            {t('courses.runner.lesson.error.retry')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hasSubstantiveProse(detail.data.content) ? <RichText html={detail.data.content} /> : null}
      <ModulePage courseId={courseId} courseTitle={courseTitle} lessonItem={item} items={items} />
      <CourseItemNav courseId={courseId} prevId={item.prevId} nextId={item.nextId} />
    </div>
  );
}
