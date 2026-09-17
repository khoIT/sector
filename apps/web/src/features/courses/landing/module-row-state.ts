import type { CourseOutlineGroup } from '../outline/course-outline-model';
import { isGroupOpen } from '../runner/sidebar-groups';

/**
 * Which module rows are open on the course page.
 *
 * The course page now carries the whole outline, which on the library's
 * largest course is 185 items. Rendering all of them expanded turns the page
 * a learner opens to decide "should I start this?" into a wall they have to
 * scroll past, so exactly one module opens: the one holding the item Start or
 * Continue would take them to. Everything else is a single row until they ask
 * for it.
 *
 * `isGroupOpen` is the player's rule for the same question, reused rather than
 * restated — the contents pane and this page disagreeing about which module
 * the learner is in would be a difference nobody could explain.
 */

/**
 * The modules open on first render.
 *
 * A course with nothing to resume — finished, or with only a blocked quiz
 * left — still opens its first module. A page of nothing but closed rows
 * gives the learner no sense of what is inside, which is the question this
 * page exists to answer.
 */
export function initialOpenModuleIds(
  groups: readonly CourseOutlineGroup[],
  resumeItemId: string | null | undefined,
): string[] {
  const active = resumeItemId
    ? groups.find((group) => isGroupOpen(group, resumeItemId))
    : undefined;
  const open = active ?? groups[0];

  return open ? [open.header.id] : [];
}

/**
 * Open or close one module, leaving the rest as they are.
 *
 * Deliberately not an accordion: comparing two modules means having both open,
 * and a rule that closes the previous one makes that impossible.
 */
export function toggleModuleId(open: readonly string[], id: string): string[] {
  return open.includes(id) ? open.filter((openId) => openId !== id) : [...open, id];
}
