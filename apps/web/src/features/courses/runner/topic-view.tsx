import type { CourseOutlineItem } from '@sector/api-client';
import { useCourseTopicDetail } from '@sector/api-client';
import { Button, EmptyState, RichText, Skeleton } from '@sector/ui';
import { AlertTriangle } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { CourseItemNav } from './course-item-nav';
import { useTrackCourseItemView } from './use-track-course-item-view';
import { useVimeoWatchTracking } from './use-vimeo-watch-tracking';

export type TopicViewProps = {
  courseId: string;
  item: CourseOutlineItem;
};

/**
 * A topic, through the same rich-text renderer as a lesson. The API's
 * progress model carries no numeric watch position — only `hasVideo` /
 * `videoCompleted` booleans (`learners.process.topic.ts#determineTopicStatus`:
 * a topic with no video completes on view; one with a video stays
 * `in_progress` until `videoCompleted: true` arrives). "Writing the watch
 * position back" therefore means: detect the embedded Vimeo player (if any)
 * and report ITS `ended` event as that second call — the only watch signal
 * this API can record, and the one the outline's resume pointer actually
 * reads.
 */
export function TopicView({ courseId, item }: TopicViewProps) {
  const { t } = useTranslation();
  const detail = useCourseTopicDetail(courseId, item.id);
  const contentRef = useRef<HTMLDivElement>(null);

  const hasVideo = Boolean(detail.data?.content?.includes('player.vimeo.com'));
  const { trackNow } = useTrackCourseItemView(courseId, 'topic', item.id, { hasVideo });

  useVimeoWatchTracking(contentRef, detail.data?.content, () => {
    void trackNow({ hasVideo: true, videoCompleted: true });
  });

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <EmptyState
        tone="crit"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        title={t('courses.runner.topic.error.title')}
        description={detail.error instanceof Error ? detail.error.message : undefined}
        action={
          <Button variant="secondary" size="sm" onClick={() => void detail.refetch()}>
            {t('courses.runner.topic.error.retry')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={contentRef}>
        <RichText html={detail.data.content} />
      </div>
      <CourseItemNav courseId={courseId} prevId={item.prevId} nextId={item.nextId} />
    </div>
  );
}
