import type { CourseListStatusFilter } from '@sector/api-client';
import type { BadgeTone } from '@sector/ui';

/**
 * Pure display shaping for one My Courses card, kept out of the page
 * component so it can be unit tested without rendering anything — same split
 * as `groups/index/group-row-model.ts`.
 */

export type CourseProgressStatus = 'not_started' | 'in_progress' | 'completed';

/** `StatusPill`/`Badge` tone is domain-free; this is the courses mapping. */
export function courseProgressTone(status: CourseProgressStatus): BadgeTone {
  switch (status) {
    case 'not_started':
      return 'neutral';
    case 'in_progress':
      return 'accent';
    case 'completed':
      return 'ok';
  }
}

/**
 * The verb on the card's one action, keyed to an i18n string rather than
 * hard-coded text: "Start" for an untouched course, "Resume" once progress
 * exists, "Review" once it is complete — a finished course is still worth
 * reopening, just not to make further progress on.
 */
export function courseActionLabelKey(status: CourseProgressStatus): string {
  switch (status) {
    case 'not_started':
      return 'courses.index.action.start';
    case 'in_progress':
      return 'courses.index.action.resume';
    case 'completed':
      return 'courses.index.action.review';
  }
}

/**
 * The API sends an unrounded float today (e.g. `28.915662650602407`) and a
 * whole percent once the in-flight API fix lands; round for display either
 * way rather than trusting the wire's precision, and clamp so a stray value
 * outside 0–100 cannot overflow a progress bar.
 */
export function roundedProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

/** Every value the My Courses status filter accepts, in menu order. */
export const COURSE_LIST_STATUS_FILTERS: readonly CourseListStatusFilter[] = [
  'not_started',
  'in_progress',
  'completed',
  'active',
  'paused',
  'dropped',
  'expired',
];
