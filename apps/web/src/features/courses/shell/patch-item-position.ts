import type { CourseOutline } from '@sector/api-client';

/**
 * Write a playhead into the cached outline without refetching it.
 *
 * The shell fetches the outline once per course visit and does not remount
 * between items, and position writes deliberately do not invalidate that
 * query — 185 items is a large round trip to pay every twelve seconds. Left
 * alone those two facts combine badly: an A -> B -> A round trip inside the
 * shell would resume A from whatever position was cached when the course was
 * opened, which is behind where the learner actually stopped. Reloading the
 * page hid it, so it had to be tested by navigating.
 *
 * Returns the previous outline unchanged when nothing moved, so React Query
 * does not notify subscribers on a write that changed nothing.
 */
export function patchItemPosition(
  itemId: string,
  positionSeconds: number,
): (previous: CourseOutline | undefined) => CourseOutline | undefined {
  return (previous) => {
    if (!previous) return previous;

    let changed = false;
    const items = previous.items.map((item) => {
      if (item.id !== itemId || item.positionSeconds === positionSeconds) return item;
      changed = true;
      return { ...item, positionSeconds };
    });

    return changed ? { ...previous, items } : previous;
  };
}
