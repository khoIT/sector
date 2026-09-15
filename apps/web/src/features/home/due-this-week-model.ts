import type { MyAssignment } from '@sector/api-client';

/**
 * Ordering for the "Due this week" panel.
 *
 * Production says 2,440 of 4,595 dated assignments are overdue and still open,
 * which is the shape of the problem: a learner with anything late has a late
 * thing FIRST, and only then the things merely coming up. Within each of those
 * two groups the soonest due date leads.
 *
 * A row with no due date cannot be "due this week" at all and is dropped
 * rather than sorted to the end — the server's due-date filter should already
 * have excluded it, and rendering one under a "due" heading would be a claim
 * the data does not support.
 */

export type DueAssignment = MyAssignment & { dueDate: string };

function dueTime(assignment: DueAssignment): number {
  return new Date(assignment.dueDate).getTime();
}

export function isOverdue(assignment: DueAssignment, now: Date): boolean {
  return dueTime(assignment) < now.getTime();
}

export function selectDueThisWeek(
  assignments: readonly MyAssignment[],
  now: Date,
): DueAssignment[] {
  const dated = assignments.filter(
    (assignment): assignment is DueAssignment =>
      typeof assignment.dueDate === 'string' &&
      assignment.dueDate.length > 0 &&
      Number.isFinite(new Date(assignment.dueDate).getTime()),
  );

  // A completed or cancelled assignment is not owed, whatever its due date.
  const open = dated.filter(
    (assignment) => assignment.status !== 'completed' && assignment.status !== 'cancelled',
  );

  return open.sort((left, right) => {
    const leftLate = isOverdue(left, now);
    const rightLate = isOverdue(right, now);
    if (leftLate !== rightLate) return leftLate ? -1 : 1;
    return dueTime(left) - dueTime(right);
  });
}

/** What the row is called: the content's own title, or the course it sits under. */
export function assignmentTitle(assignment: MyAssignment): string | null {
  return assignment.contentId?.title ?? assignment.courseId?.title ?? null;
}
