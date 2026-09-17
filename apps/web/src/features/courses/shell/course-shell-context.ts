import type { CourseOutline } from '@sector/api-client';
import { useOutletContext } from 'react-router-dom';

export type CourseShellContext = {
  courseId: string;
  /** Falls back to a generic label. No course route resolves a title of its
   *  own — `courseId` is all the outline endpoint takes — so a title carried
   *  forward via `<Link state>` is a fallback, not a requirement. */
  courseTitle: string | undefined;
  outline: CourseOutline;
  /**
   * The player's third column, when the viewport is wide enough to have one.
   * The item view portals its tab panel into this; `null` means there is no
   * panel column and the tabs render inline under the video.
   *
   * An element rather than a ref: a ref's `.current` is null on the render
   * that mounts it, so a child reading it during render would never see the
   * node and the panel would stay empty forever.
   */
  panelSlot: HTMLElement | null;
};

/**
 * The resolved outline, fetched once by `CourseShell` and read by every child
 * route. A child that called `useCourseOutline` itself would still hit the
 * query cache, but it would also re-subscribe and re-render on every write,
 * which is the coupling the shell exists to remove.
 */
export function useCourseShell(): CourseShellContext {
  return useOutletContext<CourseShellContext>();
}
