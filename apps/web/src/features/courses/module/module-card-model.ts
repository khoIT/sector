import type { CourseOutlineItem } from '@sector/api-client';

/**
 * What one card on a module page shows.
 *
 * A module page lists the topics and quizzes under a lesson. The authored
 * lesson body used to carry that list as a hand-maintained HTML table whose
 * links pointed at the retired dashboard host; the outline already knows the
 * same children, in the server's own order, with per-learner status. So the
 * cards are built from the outline and the table is no longer rendered.
 *
 * Pure, so the thumbnail and duration rules below are proved without
 * rendering anything.
 */

export type ModuleCard = {
  id: string;
  title: string;
  kind: CourseOutlineItem['kind'];
  status: CourseOutlineItem['status'];
  blockedReason: CourseOutlineItem['blockedReason'];
  /** Runtime for a video topic. Null for a quiz, for a topic with no video,
   *  and for the private videos Vimeo will not describe. */
  durationSeconds: number | null;
  /** Poster frame, or null. Never a URL that would paint a broken image. */
  imageUrl: string | null;
};

/**
 * Only an `https://` poster is used.
 *
 * The browser blocks a mixed-content image and paints the broken-image icon
 * in its place, which is worse than showing no image at all — the same call
 * `sanitize-rich-text.ts` makes about `<img>` in authored bodies.
 */
function usablePoster(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return /^https:\/\//i.test(imageUrl.trim()) ? imageUrl : null;
}

/**
 * One card per child, in the server's order.
 *
 * The poster is the child's OWN thumbnail or nothing. There is a per-lesson
 * image available (`GET /api/lms/courses/:courseId/lessons/:lessonId` sends
 * one), but it is deliberately not used as a fallback: it is a single image
 * shared by every child, so a module with no Vimeo thumbnails would render a
 * grid of identical pictures, and the route never returns null for it — a
 * lesson with no image of its own gets a generic default photo. Both make a
 * card claim to depict something it does not. 843 of 894 video topics have a
 * real thumbnail of their own, so the gap this would paper over is small and
 * an empty poster area is the honest thing to show in it.
 */
export function buildModuleCards(children: readonly CourseOutlineItem[]): ModuleCard[] {
  return children.map((child) => ({
    id: child.id,
    title: child.title,
    kind: child.kind,
    status: child.status,
    blockedReason: child.blockedReason,
    // A quiz has no runtime to report even if some future server sends one.
    durationSeconds: child.kind === 'quiz' ? null : child.durationSeconds,
    imageUrl: usablePoster(child.imageUrl),
  }));
}
