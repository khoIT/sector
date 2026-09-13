import { trackCourseProgress, useApiClient, type TrackContentType } from '@sector/api-client';
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { courseKeys } from '@sector/api-client';

export type TrackCourseItemViewExtra = { hasVideo?: boolean; videoCompleted?: boolean };

/**
 * Fires the "viewed" ping (`POST /api/v2/learners/courses/:courseId/track`)
 * once on mount and once more on unmount with the accumulated time spent —
 * the completion rule itself lives entirely server-side (a lesson/topic with
 * no video completes on the mount ping alone; the outline is what actually
 * shows the result, refetched after each call).
 *
 * Returns `trackNow`, which the topic view calls a THIRD time, mid-mount,
 * the moment the embedded Vimeo player reports `ended` — the one interior
 * state transition (`hasVideo: true` -> `videoCompleted: true`) this generic
 * mount/unmount pair cannot express on its own.
 */
export function useTrackCourseItemView(
  courseId: string,
  contentType: TrackContentType,
  contentId: string,
  extra?: TrackCourseItemViewExtra,
): { trackNow: (moreExtra?: TrackCourseItemViewExtra) => Promise<void> } {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const mountedAtRef = useRef(Date.now());
  const hasVideoRef = useRef(extra?.hasVideo);
  hasVideoRef.current = extra?.hasVideo;

  const invalidateOutline = useCallback(
    () => queryClient.invalidateQueries({ queryKey: courseKeys.outline(courseId) }),
    [queryClient, courseId],
  );

  const trackNow = useCallback(
    async (moreExtra?: TrackCourseItemViewExtra) => {
      const timeSpent = Math.floor((Date.now() - mountedAtRef.current) / 1000);
      await trackCourseProgress(client, courseId, {
        contentType,
        contentId,
        timeSpent,
        hasVideo: hasVideoRef.current,
        ...moreExtra,
      });
      await invalidateOutline();
    },
    [client, courseId, contentType, contentId, invalidateOutline],
  );

  useEffect(() => {
    mountedAtRef.current = Date.now();
    let cancelled = false;

    void trackCourseProgress(client, courseId, {
      contentType,
      contentId,
      hasVideo: extra?.hasVideo,
      videoCompleted: extra?.videoCompleted,
    }).then(() => {
      if (!cancelled) void invalidateOutline();
    });

    return () => {
      cancelled = true;
      const timeSpent = Math.floor((Date.now() - mountedAtRef.current) / 1000);
      // Fire-and-forget: nothing can await a promise from inside an unmount
      // cleanup, and this is a best-effort accumulation, not the source of
      // truth for completion (the mount ping already established that).
      void trackCourseProgress(client, courseId, { contentType, contentId, timeSpent });
    };
    // contentId/courseId/contentType identify the item; a real change of any
    // of them (client-side navigation to a different item, or a different
    // course) is exactly when this should re-fire. `extra` is intentionally
    // read once, at mount, not tracked as a dependency: the video flags are
    // constant for a given topic's initial "viewed" ping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, courseId, contentType, contentId]);

  return { trackNow };
}
