import { courseKeys, trackItemPosition, useApiClient } from '@sector/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { patchItemPosition } from '../shell/patch-item-position';
import {
  clampPosition,
  initialWatchWriteState,
  recordWrite,
  recordWriteFailure,
  shouldWritePosition,
  suppressAround,
  type WatchWriteState,
} from './watch-position';

/**
 * Writes the learner's playhead back while a video plays, and once more on the
 * way out.
 *
 * The throttle itself lives in `watch-position.ts` so it can be tested without
 * a player; this owns the effects — the request, the retry bookkeeping and the
 * page-hide flush.
 *
 * Two things this deliberately does NOT do: send a duration, or send a
 * "completed" flag. The server holds the runtime and decides completion from
 * the mark it wrote itself. When a write reports that the topic just ticked
 * over, the outline is invalidated so the sidebar catches up.
 */
export function useWatchPosition(
  courseId: string,
  itemId: string,
): {
  reportPosition: (seconds: number, options?: { force?: boolean }) => void;
  suppressForTrack: () => void;
} {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const stateRef = useRef<WatchWriteState>(initialWatchWriteState);
  // The last position the player reported, whether or not it was written.
  // The page-hide flush has no player to ask, so it sends this.
  const latestSecondsRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  // A change of item resets the throttle: the new topic's playhead has
  // nothing to do with the old one's, and carrying `lastWrittenSeconds` over
  // would read as a seek and fire an immediate write for the wrong item.
  useEffect(() => {
    stateRef.current = initialWatchWriteState;
    latestSecondsRef.current = null;
  }, [courseId, itemId]);

  const write = useCallback(
    (seconds: number, keepalive: boolean) => {
      const nowMs = Date.now();
      const positionSeconds = clampPosition(seconds);
      stateRef.current = recordWrite(stateRef.current, { positionSeconds, nowMs });
      inFlightRef.current = true;

      void trackItemPosition(client, courseId, itemId, { positionSeconds }, { keepalive })
        .then((result) => {
          inFlightRef.current = false;
          // Patch the cached outline in place rather than invalidating it.
          // The shell holds one outline for the whole course visit and does
          // not remount between items, so without this an A -> B -> A round
          // trip inside the shell resumes A from a stale playhead. A blanket
          // invalidate on every twelve-second tick would undo the write-volume
          // work this throttle exists for.
          queryClient.setQueryData(
            courseKeys.outline(courseId),
            patchItemPosition(itemId, positionSeconds),
          );
          // A completion reached from the player, not from a `/track` ping:
          // the sidebar's tick and the progress bar both read the outline.
          if (result?.completed) {
            void queryClient.invalidateQueries({ queryKey: courseKeys.outline(courseId) });
          }
        })
        .catch(() => {
          inFlightRef.current = false;
          // Re-arm rather than drop it. The write that failed may have been
          // the one that crossed the threshold.
          stateRef.current = recordWriteFailure(stateRef.current);
        });
    },
    [client, courseId, itemId, queryClient],
  );

  const reportPosition = useCallback(
    (seconds: number, options?: { force?: boolean }) => {
      latestSecondsRef.current = seconds;
      const nowMs = Date.now();

      // One request at a time. A slow network would otherwise queue writes
      // that each carry an older position than the one before it.
      if (inFlightRef.current && !options?.force) return;

      if (
        !shouldWritePosition(stateRef.current, {
          positionSeconds: seconds,
          nowMs,
          force: options?.force,
        })
      ) {
        return;
      }

      write(seconds, false);
    },
    [write],
  );

  const suppressForTrack = useCallback(() => {
    stateRef.current = suppressAround(stateRef.current, Date.now());
  }, []);

  // React does not unmount on a tab close, so an unmount cleanup is not the
  // last chance to record where the learner got to — `pagehide` is. The write
  // is marked keepalive so the browser does not cancel it with the document.
  useEffect(() => {
    const flush = () => {
      const seconds = latestSecondsRef.current;
      if (seconds === null) return;
      if (stateRef.current.lastWrittenSeconds === clampPosition(seconds)) return;
      write(seconds, true);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Leaving the topic by navigating inside the app: same last chance,
      // reached a different way.
      flush();
    };
  }, [write]);

  return { reportPosition, suppressForTrack };
}
