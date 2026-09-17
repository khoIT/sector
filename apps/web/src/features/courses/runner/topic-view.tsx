import type { CourseOutlineItem } from '@sector/api-client';
import { useCourseTopicDetail } from '@sector/api-client';
import { Button, EmptyState, RichText, Skeleton, cn } from '@sector/ui';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { formatPlayheadTimestamp } from '@/lib/format';

import { OutlineStatusGlyph } from '../outline/outline-status-glyph';
import { useCourseShell } from '../shell/course-shell-context';
import { CourseItemNav } from './course-item-nav';
import { hasReadableBody, splitTopicMedia } from './split-topic-media';
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
  const { panelSlot } = useCourseShell();

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

  const duration = formatPlayheadTimestamp(item.durationSeconds);
  const { media, body } = splitTopicMedia(detail.data?.content);

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

  const tabs = <TopicTabs body={body} />;

  return (
    // Room at the bottom for the sticky prev/next bar, which would otherwise
    // sit over the last line of the topic body on a phone.
    <div className="flex flex-col gap-4 pb-20 lg:pb-0">
      {/* The embed arrives inside the topic's own HTML with whatever width the
          author gave it, which on most topics is a 640px box floating in a
          1000px column. `sv-video` forces any iframe in this subtree to fill
          the column at 16:9 — the player is the page, not an illustration. */}
      <div ref={contentRef} className="sv-video flex flex-col gap-4">
        {/* The player leads. Kept inside `contentRef` so the watch-tracking
            hook still finds the iframe it reports the playhead from — moving
            the TABS out is safe, moving the media out is not. */}
        {media ? <RichText html={media} /> : null}

        <div className="flex flex-col gap-1">
          <h1 className="text-[20px] font-semibold leading-tight text-ink">{item.title}</h1>
          <div className="sv-num flex flex-wrap items-center gap-2 text-[12px] text-ink-dim">
            <OutlineStatusGlyph status={item.status} />
            <span>{watchedLabel(item, t)}</span>
            {duration ? (
              <>
                <span aria-hidden>{'\u00b7'}</span>
                <span>{duration}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Beside the video when there is a column for it, under the video when
          there is not. A portal rather than a second copy: the tab state, the
          translations and the router all stay in this component's tree
          wherever the DOM node happens to be. */}
      {panelSlot ? createPortal(tabs, panelSlot) : tabs}

      <CourseItemNav
        courseId={courseId}
        prevId={item.prevId}
        nextId={item.nextId}
        variant="sticky"
      />
    </div>
  );
}

/**
 * Where the learner stands on THIS topic, in the words the contents pane uses
 * for the same three states — plus how far in they are, which is the number
 * that tells them whether picking it up again is worth it.
 */
function watchedLabel(
  item: CourseOutlineItem,
  t: (key: string, o?: Record<string, unknown>) => string,
): string {
  if (item.status === 'completed') return t('courses.outline.itemStatus.completed');
  if (item.positionSeconds && item.durationSeconds) {
    const percent = Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100));
    return t('courses.runner.watchedPercent', { percent });
  }
  return t(`courses.outline.itemStatus.${item.status}`);
}

const TABS = ['overview', 'transcript', 'notes'] as const;

/**
 * Overview, Transcript and Notes.
 *
 * Only Overview has anything to show today. The other two are declared here
 * rather than hidden because they are the shape the player is being built
 * toward, and each says plainly that it is not built yet — an empty tab a
 * learner can open and read is honest; a tab that silently shows nothing is
 * a bug report waiting to happen.
 */
function TopicTabs({ body }: { body: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
              tab === name
                ? 'border-accent-ink font-medium text-ink'
                : 'border-transparent text-ink-dim hover:text-ink',
            )}
          >
            {t(`courses.runner.tabs.${name}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        hasReadableBody(body) ? (
          // The same clamp the course description uses, so authored prose is
          // a readable column at every width rather than a 1,600px line.
          <div className="max-w-[62ch]">
            <RichText html={body} />
          </div>
        ) : (
          // Most topics are the video and nothing else. Saying so beats an
          // empty panel under a tab the learner just clicked.
          <p className="text-body text-ink-dim">{t('courses.runner.tabs.overviewEmpty')}</p>
        )
      ) : (
        <p className="max-w-[62ch] text-body text-ink-dim">
          {t(`courses.runner.tabs.${tab}Pending`)}
        </p>
      )}
    </div>
  );
}
