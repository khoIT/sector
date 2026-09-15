import type { CourseOutlineGroup } from '../outline/course-outline-model';

/**
 * Whether a module's items show in the contents pane.
 *
 * The pane used to render every item in the course. On a 65-item course that
 * is a four-thousand-pixel column beside a screen of content, and the module
 * the learner is actually in is somewhere inside it. Only the module holding
 * the current item opens; the rest stay as their header row, which is still a
 * link, so moving to another module opens that one in turn.
 *
 * A course with no modules — a flat list of lessons, which plenty of the
 * imported courses are — has a header and no children either way, so this
 * changes nothing for them.
 */
export function isGroupOpen(group: CourseOutlineGroup, currentItemId: string): boolean {
  if (group.header.id === currentItemId) return true;

  return group.children.some((child) => child.id === currentItemId);
}
