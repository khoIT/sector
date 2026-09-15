import type { GroupAssignment } from '@sector/api-client';

/**
 * What a leader actually needs to know about an assignment.
 *
 * The stored `status` answers "how far has the learner got" and says nothing
 * about the deadline, so a row a month past its due date reads `active` — the
 * same as one issued this morning. 2,435 of 4,595 dated assignments are past
 * due and still open, so that is not an edge case, it is most of the list.
 *
 * `overdue` is therefore derived, not stored: it is the stored status seen
 * against the clock. Nothing here is fetched — `status` and `dueDate` are
 * already on every row the group assignments route returns.
 */

export const ASSIGNMENT_LIFECYCLES = [
  'not_started',
  'in_progress',
  'overdue',
  'completed',
] as const;

export type AssignmentLifecycle = (typeof ASSIGNMENT_LIFECYCLES)[number];

type LifecycleInput = Pick<GroupAssignment, 'status' | 'dueDate'>;

/**
 * Order matters, and it is the order a leader would read them in:
 *
 *   1. Finished is finished. A completed assignment handed in late is still
 *      completed — it is not a thing to chase, and showing it as overdue
 *      would put permanent red on a list that is already mostly red.
 *   2. Cancelled rows are not overdue either; nobody owes anything on them.
 *      They fold into `not_started`, which does overstate outstanding work in
 *      principle — but the production mirror holds ZERO cancelled rows across
 *      8,720 assignments (only active, completed and in_progress occur), so
 *      the case is unreachable today. Give cancelled its own pill if the
 *      status ever starts being written.
 *   3. Past its date and still open is overdue, whether or not it was started.
 *      This deliberately outranks `in_progress`: half-done and three weeks
 *      late is the case the report exists to surface.
 *   4. Otherwise the stored status stands.
 *
 * A row with no `dueDate` is never overdue.
 */
export function assignmentLifecycle(assignment: LifecycleInput, now: Date): AssignmentLifecycle {
  if (assignment.status === 'completed') return 'completed';
  if (assignment.status === 'cancelled') return 'not_started';

  if (assignment.dueDate) {
    const due = new Date(assignment.dueDate);
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
      return 'overdue';
    }
  }

  return assignment.status === 'in_progress' ? 'in_progress' : 'not_started';
}

export type AssignmentLifecycleCounts = Record<AssignmentLifecycle, number>;

/**
 * The four counts, over the rows the caller actually has.
 *
 * Deliberately not a group-wide total: this counts the page in front of the
 * leader, and claiming otherwise would be a number that disagrees with the
 * list beneath it.
 */
export function countAssignmentLifecycles(
  assignments: readonly LifecycleInput[],
  now: Date,
): AssignmentLifecycleCounts {
  const counts: AssignmentLifecycleCounts = {
    not_started: 0,
    in_progress: 0,
    overdue: 0,
    completed: 0,
  };

  for (const assignment of assignments) {
    counts[assignmentLifecycle(assignment, now)] += 1;
  }

  return counts;
}

/** The badge tone for each lifecycle value. */
export function assignmentLifecycleTone(lifecycle: AssignmentLifecycle) {
  switch (lifecycle) {
    case 'completed':
      return 'ok' as const;
    case 'overdue':
      return 'crit' as const;
    case 'in_progress':
      return 'accent' as const;
    case 'not_started':
      return 'neutral' as const;
  }
}

export function assignmentLifecycleLabelKey(lifecycle: AssignmentLifecycle): string {
  return `groups.assignments.lifecycle.${lifecycle}`;
}
