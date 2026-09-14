import type { CourseListStatusFilter } from '@sector/api-client';
import type { BadgeTone } from '@sector/ui';

/**
 * Pure display shaping for one My Courses card, kept out of the page
 * component so it can be unit tested without rendering anything — same split
 * as `groups/index/group-row-model.ts`.
 */

export type CourseProgressStatus = 'not_started' | 'in_progress' | 'completed';
/** An outline item's own status, which adds the one a course never takes. */
export type CourseItemProgressStatus = CourseProgressStatus | 'failed';

/**
 * `StatusPill`/`Badge` tone is domain-free; this is the courses mapping.
 *
 * `failed` is `warn`, not `crit`: a quiz below its passing mark can be
 * retaken, and the API never downgrades a later pass because of it. Nothing
 * about it is an error state the learner has to escalate.
 */
export function courseProgressTone(status: CourseItemProgressStatus): BadgeTone {
  switch (status) {
    case 'not_started':
      return 'neutral';
    case 'in_progress':
      return 'accent';
    case 'failed':
      return 'warn';
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
 * The API now sends a whole percent, but round here regardless of what the
 * wire holds — rounding an already-integer value is a no-op — rather than
 * re-coupling display to the exact precision of one route. Also clamps so a
 * stray value outside 0–100 cannot overflow a progress bar.
 */
export function roundedProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

/**
 * Every value the My Courses status filter OFFERS, in menu order.
 *
 * `expired` is deliberately not among them, although the route accepts it:
 * filtering on it keeps only rows the route then moves into its separate
 * `expired` array, so `items` — the grid — is empty by construction and the
 * page can only answer "no courses match". The expired enrolments already
 * have their own section below the grid, which is where a learner looks for
 * them. Offering a filter that can never fill the thing it filters is a
 * worse answer than not offering it.
 */
export const COURSE_LIST_STATUS_FILTERS: readonly CourseListStatusFilter[] = [
  'not_started',
  'in_progress',
  'completed',
  'active',
  'paused',
  'dropped',
];
