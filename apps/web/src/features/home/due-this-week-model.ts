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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The far edge of the window, as the server wants it: the end of the day seven
 * days out.
 *
 * Rounded to the day deliberately. This string is part of the request's cache
 * key, so a millisecond-precise boundary mints a new key on every single
 * render — each fetch re-renders, each re-render asks again, and the panel
 * never stops requesting. Rounding also means returning to this page reuses
 * the answer already fetched instead of asking again, and "due this week"
 * never needed sub-second precision to begin with.
 */
export function dueWindowEnd(now: Date): string {
  const end = new Date(now.getTime() + SEVEN_DAYS_MS);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

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

  // Bound the window here rather than trusting the request to have been
  // filtered. An API that does not know the due-date parameter drops it and
  // answers with everything the learner owes, and this panel would then put
  // work due months out under a heading that says this week. Overdue work is
  // still owed now, so only the far edge is cut.
  const windowEnd = new Date(dueWindowEnd(now)).getTime();
  const withinWindow = open.filter((assignment) => dueTime(assignment) <= windowEnd);

  return withinWindow.sort((left, right) => {
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
