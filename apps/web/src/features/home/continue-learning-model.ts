import type { LearnerCourseListItem } from '@sector/api-client';

/**
 * Which course a learner should be offered first when they come back.
 *
 * This is the whole point of the re-entry work: production says 58% of started
 * courses stall under 25% and learners do not return on their own. The home
 * screen gets one row, and it has to pick the right course without asking.
 *
 * Ordering, most recent first, is deliberately the only rule. "Closest to
 * finishing" sounds better and is worse: it buries the thing the learner was
 * actually doing five minutes ago under a course they abandoned at 90% last
 * year.
 */

export type ContinueLearningEntry = {
  courseId: string;
  courseTitle: string;
  /** 0-100, as the server computed it. */
  percent: number;
  /** The item to reopen, when the server could resolve one. */
  resumeItemId: string | null;
  resumeItemTitle: string | null;
  /** Playhead in seconds, for a topic carrying a video. */
  resumePositionSeconds: number | null;
  lastAccessedAt: string;
};

/** A course is worth resuming only if it was started and is not finished. */
function isResumable(row: LearnerCourseListItem): boolean {
  if (!row.progress.lastAccessedAt) return false;
  if (row.progress.status === 'completed') return false;
  return row.progress.progress < 100;
}

export function selectContinueLearning(
  rows: readonly LearnerCourseListItem[],
  limit = 3,
): ContinueLearningEntry[] {
  return rows
    .filter(isResumable)
    .slice()
    .sort((a, b) => {
      const at = Date.parse(a.progress.lastAccessedAt ?? '');
      const bt = Date.parse(b.progress.lastAccessedAt ?? '');
      // An unparseable date sorts last rather than throwing the whole row out:
      // a bad timestamp is a reason to rank it low, not to hide the course.
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    })
    .slice(0, limit)
    .map((row) => ({
      courseId: row.course.id,
      courseTitle: row.course.title,
      percent: Math.round(row.progress.progress),
      resumeItemId: row.progress.lastItemAccessed?.id ?? null,
      resumeItemTitle: row.progress.lastItemAccessed?.title ?? null,
      resumePositionSeconds: row.progress.lastItemAccessed?.positionSeconds ?? null,
      lastAccessedAt: row.progress.lastAccessedAt!,
    }));
}

/**
 * `'8:40'` — the playhead as a learner reads a video timestamp, not as a
 * duration. Distinct from `formatDurationShort` on purpose: "resume at 8:40"
 * and "10m left" are different sentences and rounding the first to `'9m'`
 * would be wrong.
 */
export function formatPlayheadTimestamp(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;

  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
