import type { CourseOutlineItem } from '@sector/api-client';
import { useCourseLessonDetail } from '@sector/api-client';
import { Button, EmptyState, RichText, Skeleton } from '@sector/ui';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CourseItemNav } from './course-item-nav';
import { useTrackCourseItemView } from './use-track-course-item-view';

export type LessonViewProps = {
  courseId: string;
  item: CourseOutlineItem;
};

/** A lesson, through the Phase 5 rich-text renderer. Completion is entirely
 *  server-derived (see `use-track-course-item-view.ts`): a lesson with no
 *  published topics/quizzes under it completes the instant it is viewed. */
export function LessonView({ courseId, item }: LessonViewProps) {
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
      <RichText html={detail.data.content} />
      <CourseItemNav courseId={courseId} prevId={item.prevId} nextId={item.nextId} />
    </div>
  );
}
