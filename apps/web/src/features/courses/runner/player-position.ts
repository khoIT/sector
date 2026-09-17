import type { CourseOutlineItem } from '@sector/api-client';

/**
 * Where the learner is in the course, as `3 / 46`.
 *
 * On a phone the contents list moves into a drawer, so the one thing the
 * trigger has to carry is the fact the list was showing for free: how far
 * through the course this item sits.
 *
 * Blocked items are excluded from BOTH halves, matching `summariseOutline`
 * and the server's own `totalItems`. A quiz with no questions cannot be
 * opened, so counting it gives a denominator nobody can ever reach and an
 * index that jumps by two.
 */
export type PlayerPosition = { index: number; total: number };

export function positionLabel(
  items: readonly CourseOutlineItem[],
  currentItemId: string | null,
): PlayerPosition {
  const openable = items.filter((item) => !item.blockedReason);
  const at = openable.findIndex((item) => item.id === currentItemId);

  // `0` for an item the outline does not hold — a stale link, or the blocked
  // quiz itself. The caller shows the total alone rather than "0 of 46".
  return { index: at === -1 ? 0 : at + 1, total: openable.length };
}
