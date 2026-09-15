import type { GroupAssignment } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  assignmentLifecycle,
  assignmentLifecycleTone,
  countAssignmentLifecycles,
} from './assignment-status-model';

/**
 * `overdue` is the whole point of this module: 2,435 of 4,595 dated
 * assignments are past due and still open, and the stored status shows every
 * one of them as `active`.
 */

const NOW = new Date('2026-09-15T12:00:00.000Z');
const PAST = '2026-08-01T00:00:00.000Z';
const FUTURE = '2026-10-01T00:00:00.000Z';

function row(overrides: Partial<GroupAssignment>): Pick<GroupAssignment, 'status' | 'dueDate'> {
  return {
    status: 'active',
    dueDate: null,
    ...overrides,
  } as Pick<GroupAssignment, 'status' | 'dueDate'>;
}

describe('assignmentLifecycle', () => {
  it('reports an untouched assignment as not started', () => {
    expect(assignmentLifecycle(row({ status: 'active', dueDate: FUTURE }), NOW)).toBe(
      'not_started',
    );
  });

  it('reports a started one as in progress', () => {
    expect(assignmentLifecycle(row({ status: 'in_progress', dueDate: FUTURE }), NOW)).toBe(
      'in_progress',
    );
  });

  it('reports a past-due open one as overdue', () => {
    expect(assignmentLifecycle(row({ status: 'active', dueDate: PAST }), NOW)).toBe('overdue');
  });

  it('calls half-done and late overdue, not in progress', () => {
    // The case the report exists to surface: started, stalled, three weeks late.
    expect(assignmentLifecycle(row({ status: 'in_progress', dueDate: PAST }), NOW)).toBe('overdue');
  });

  it('leaves a completed assignment completed even when it was handed in late', () => {
    expect(assignmentLifecycle(row({ status: 'completed', dueDate: PAST }), NOW)).toBe('completed');
  });

  it('never calls an assignment with no due date overdue', () => {
    expect(assignmentLifecycle(row({ status: 'active', dueDate: null }), NOW)).toBe('not_started');
    expect(assignmentLifecycle(row({ status: 'in_progress', dueDate: null }), NOW)).toBe(
      'in_progress',
    );
  });

  it('does not chase a cancelled assignment', () => {
    expect(assignmentLifecycle(row({ status: 'cancelled', dueDate: PAST }), NOW)).toBe(
      'not_started',
    );
  });

  it('treats an unparseable due date as no due date rather than as overdue', () => {
    expect(assignmentLifecycle(row({ status: 'active', dueDate: 'not a date' }), NOW)).toBe(
      'not_started',
    );
  });

  it('is exclusive at the boundary: due exactly now is not yet overdue', () => {
    expect(assignmentLifecycle(row({ status: 'active', dueDate: NOW.toISOString() }), NOW)).toBe(
      'not_started',
    );
  });
});

describe('countAssignmentLifecycles', () => {
  it('counts each row once, across all four values', () => {
    const counts = countAssignmentLifecycles(
      [
        row({ status: 'active', dueDate: FUTURE }),
        row({ status: 'active', dueDate: PAST }),
        row({ status: 'in_progress', dueDate: PAST }),
        row({ status: 'in_progress', dueDate: FUTURE }),
        row({ status: 'completed', dueDate: PAST }),
      ],
      NOW,
    );

    expect(counts).toEqual({
      not_started: 1,
      in_progress: 1,
      overdue: 2,
      completed: 1,
    });
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(5);
  });

  it('returns four zeroes for an empty list rather than nothing', () => {
    expect(countAssignmentLifecycles([], NOW)).toEqual({
      not_started: 0,
      in_progress: 0,
      overdue: 0,
      completed: 0,
    });
  });
});

describe('assignmentLifecycleTone', () => {
  it('puts only overdue in the critical tone', () => {
    expect(assignmentLifecycleTone('overdue')).toBe('crit');
    expect(assignmentLifecycleTone('completed')).toBe('ok');
    expect(assignmentLifecycleTone('in_progress')).toBe('accent');
    expect(assignmentLifecycleTone('not_started')).toBe('neutral');
  });
});
