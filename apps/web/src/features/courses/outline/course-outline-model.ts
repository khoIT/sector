import type { CourseOutlineItem } from '@sector/api-client';

/**
 * Pure shaping for the outline surface: visual grouping and label lookups,
 * kept out of the page component so it is unit tested without rendering
 * anything — same split as `my-courses/course-row-model.ts`.
 *
 * Nothing here re-derives navigation. `order` is already the server's order;
 * `groupOutlineItemsForDisplay` only chunks the ALREADY-ordered flat array at
 * every depth-0 item, so a lesson's topics and quizzes render nested under
 * it without a second traversal or a client-side sort. A depth-0 item that
 * is a topic or a quiz (the `course > topic > quiz` shape this phase gives a
 * route for the first time) becomes its own single-item or short group the
 * same way a lesson does — grouping does not require a lesson to exist.
 */

export type CourseOutlineGroup = {
  /** The depth-0 item this group hangs off — a lesson, or (the fourth
   *  nesting shape) a root-level topic or quiz. */
  header: CourseOutlineItem;
  /** Everything under it, still in server order. */
  children: CourseOutlineItem[];
};

export function groupOutlineItemsForDisplay(
  items: readonly CourseOutlineItem[],
): CourseOutlineGroup[] {
  const groups: CourseOutlineGroup[] = [];

  for (const item of items) {
    // `groups.length === 0` is defensive only: a well-formed outline always
    // starts at depth 0, but a malformed one should still render something
    // rather than drop items on the floor.
    if (item.depth === 0 || groups.length === 0) {
      groups.push({ header: item, children: [] });
      continue;
    }
    groups[groups.length - 1]!.children.push(item);
  }

  return groups;
}

export function findOutlineItem(
  items: readonly CourseOutlineItem[],
  id: string | null,
): CourseOutlineItem | undefined {
  if (!id) return undefined;
  return items.find((item) => item.id === id);
}

/**
 * The verb on the resume action, matching the item's OWN status — not the
 * course's. A quiz is complete only once every question is answered, so an
 * item can sit `in_progress` (opened, not finished) for a long time; this
 * never claims "Start" for something the learner has already opened.
 */
export function resumeActionLabelKey(status: CourseOutlineItem['status']): string {
  switch (status) {
    case 'not_started':
      return 'courses.outline.resume.start';
    case 'in_progress':
      return 'courses.outline.resume.resume';
    case 'completed':
      return 'courses.outline.resume.review';
  }
}

export function blockedReasonLabelKey(
  reason: NonNullable<CourseOutlineItem['blockedReason']>,
): string {
  return `courses.outline.blocked.${reason}`;
}

export function itemKindLabelKey(kind: CourseOutlineItem['kind']): string {
  return `courses.outline.kind.${kind}`;
}

export function itemStatusLabelKey(status: CourseOutlineItem['status']): string {
  return `courses.outline.itemStatus.${status}`;
}
