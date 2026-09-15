import type { CourseOutlineItem } from '@sector/api-client';
import { useCourseTopicDetail } from '@sector/api-client';
import { Button, EmptyState, RichText, Skeleton } from '@sector/ui';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { CourseItemNav } from './course-item-nav';
import { useTrackCourseItemView } from './use-track-course-item-view';
import { useVimeoWatchTracking } from './use-vimeo-watch-tracking';
import { useWatchPosition } from './use-watch-position';

export type TopicViewProps = {
  courseId: string;
  item: CourseOutlineItem;
};

/**
 * A topic, through the same rich-text renderer as a lesson.
 *
 * If the content embeds a Vimeo player, this reports the playhead back as it
 * moves. It reports only that: the server holds the runtime and decides
 * completion from the marks these reports leave behind. This component used to
 * send `videoCompleted: true` on the player's `ended` event, which is the
 * claim that made a finished course forgeable from the browser.
 */
export function TopicView({ courseId, item }: TopicViewProps) {
  const { t } = useTranslation();
  const detail = useCourseTopicDetail(courseId, item.id);
  const contentRef = useRef<HTMLDivElement>(null);

  const hasVideo = Boolean(detail.data?.content?.includes('player.vimeo.com'));
  // Deferred until the content query settles: see the hook's own doc comment
  // on `enabled` for why firing on an unresolved query would always read
  // `hasVideo` as false and complete a video topic on sight.
  useTrackCourseItemView(courseId, 'topic', item.id, { hasVideo }, detail.isSuccess);

  const { reportPosition, suppressForTrack } = useWatchPosition(courseId, item.id);

  // The mount ping goes out the moment the content query settles. `/track`
  // opens a transaction and retries a write conflict three times before
  // throwing, so hold the playhead writes off for a moment rather than have
  // the two race for the same document.
  useEffect(() => {
    if (detail.isSuccess) suppressForTrack();
  }, [detail.isSuccess, suppressForTrack]);

  useVimeoWatchTracking(contentRef, detail.data?.content, reportPosition);

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
