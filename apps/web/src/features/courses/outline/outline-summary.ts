import type { CourseOutlineItem } from '@sector/api-client';

import type { CourseOutlineGroup } from './course-outline-model';

/**
 * What the outline adds up to: how many items, and how much of the course is
 * still to watch.
 *
 * Pure, so the arithmetic that drives the header ring and the "N minutes left"
 * line is testable without rendering anything.
 *
 * The one rule worth stating: `null` and `0` mean different things throughout.
 * `null` is "no runtime is known" — 43 of the library's videos are private and
 * Vimeo will not describe them — and the UI must say nothing rather than
 * claim "0 minutes left" for a course with hours still in it.
 */

export type OutlineSummary = {
  /** Items the server counts toward completion — blocked ones are excluded. */
  totalItems: number;
  completedItems: number;
  /** Runtime of every item with a known duration. Null when none has one. */
  totalSeconds: number | null;
  /** Runtime of the not-yet-completed ones. Null under the same condition. */
  remainingSeconds: number | null;
};

/**
 * A blocked item is one a learner cannot open — a quiz with no questions.
 * The server already leaves these out of `totalItems`
 * (`learners.outline.helper.ts`), and two denominators that disagree is worse
 * than one that is slightly small.
 */
function countsTowardCompletion(item: CourseOutlineItem): boolean {
  return item.blockedReason === null;
}

export function summariseOutline(items: readonly CourseOutlineItem[]): OutlineSummary {
  const counted = items.filter(countsTowardCompletion);

  let totalSeconds: number | null = null;
  let remainingSeconds: number | null = null;

  for (const item of counted) {
    if (item.durationSeconds === null) continue;
    totalSeconds = (totalSeconds ?? 0) + item.durationSeconds;
    if (item.status !== 'completed') {
      remainingSeconds = (remainingSeconds ?? 0) + item.durationSeconds;
    }
  }

  // A course whose every video is watched has 0 seconds left, not "unknown" —
  // but only if at least one runtime was known in the first place.
  if (totalSeconds !== null && remainingSeconds === null) {
    remainingSeconds = 0;
  }

  return {
    totalItems: counted.length,
    completedItems: counted.filter((item) => item.status === 'completed').length,
    totalSeconds,
    remainingSeconds,
  };
}

/** Runtime of one lesson group, header included. */
export function groupTotalSeconds(group: CourseOutlineGroup): number | null {
  return summariseOutline([group.header, ...group.children]).totalSeconds;
}

/** Runtime still unwatched in one lesson group. */
export function groupRemainingSeconds(group: CourseOutlineGroup): number | null {
  return summariseOutline([group.header, ...group.children]).remainingSeconds;
}

/**
 * `'48s'`, `'4m'`, `'1h 12m'` — the compact form for a chip beside a title.
 *
 * Seconds only appear under a minute: on a row listing a dozen lectures,
 * `'10m 16s'` is noise where `'10m'` is the thing being compared.
 */
export function formatDurationShort(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;

  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;

  const minutes = Math.round(whole / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}
