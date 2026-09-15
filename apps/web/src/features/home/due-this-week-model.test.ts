import type { MyAssignment } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { assignmentTitle, dueWindowEnd, selectDueThisWeek } from './due-this-week-model';

const NOW = new Date('2026-09-15T00:00:00.000Z');

function assignment(overrides: Partial<MyAssignment> = {}): MyAssignment {
  return {
    id: 'a1',
    assignmentType: 'course',
    contentId: null,
    courseId: null,
    user: null,
    dueDate: '2026-09-16T00:00:00.000Z',
    status: 'active',
    completedAt: null,
    route: '/learn/courses/c1',
    ...overrides,
  } as MyAssignment;
}

describe('selectDueThisWeek', () => {
  it('puts anything late before anything merely upcoming', () => {
    const rows = selectDueThisWeek(
      [
        assignment({ id: 'upcoming', dueDate: '2026-09-18T00:00:00.000Z' }),
        assignment({ id: 'late', dueDate: '2026-09-01T00:00:00.000Z' }),
      ],
      NOW,
    );

    expect(rows.map((row) => row.id)).toEqual(['late', 'upcoming']);
  });

  it('breaks ties within each group by the soonest due date', () => {
    const rows = selectDueThisWeek(
      [
        assignment({ id: 'later', dueDate: '2026-09-20T00:00:00.000Z' }),
        assignment({ id: 'sooner', dueDate: '2026-09-16T00:00:00.000Z' }),
        assignment({ id: 'very-late', dueDate: '2026-08-01T00:00:00.000Z' }),
        assignment({ id: 'just-late', dueDate: '2026-09-14T00:00:00.000Z' }),
      ],
      NOW,
    );

    expect(rows.map((row) => row.id)).toEqual(['very-late', 'just-late', 'sooner', 'later']);
  });

  it('drops a row with no due date rather than sorting it last', () => {
    // Nothing without a date can be "due this week", and showing one under
    // that heading would be a claim the data does not make.
    expect(selectDueThisWeek([assignment({ dueDate: null })], NOW)).toEqual([]);
    expect(selectDueThisWeek([assignment({ dueDate: 'not a date' })], NOW)).toEqual([]);
  });

  it('drops assignments that are no longer owed', () => {
    expect(selectDueThisWeek([assignment({ status: 'completed' })], NOW)).toEqual([]);
    expect(selectDueThisWeek([assignment({ status: 'cancelled' })], NOW)).toEqual([]);
    expect(selectDueThisWeek([assignment({ status: 'in_progress' })], NOW)).toHaveLength(1);
  });

  it('renders nothing for an empty list', () => {
    expect(selectDueThisWeek([], NOW)).toEqual([]);
  });
});

describe('assignmentTitle', () => {
  it('prefers the assigned content over the course it sits under', () => {
    expect(
      assignmentTitle(
        assignment({
          contentId: { id: 'x', title: 'Cardiac views' },
          courseId: { id: 'c', title: 'POCUS Essentials' },
        } as Partial<MyAssignment>),
      ),
    ).toBe('Cardiac views');
  });

  it('falls back to the course, then to nothing', () => {
    expect(
      assignmentTitle(
        assignment({ courseId: { id: 'c', title: 'POCUS Essentials' } } as Partial<MyAssignment>),
      ),
    ).toBe('POCUS Essentials');
    expect(assignmentTitle(assignment())).toBeNull();
  });
});

describe('dueWindowEnd', () => {
  it('returns the same boundary for any two moments in the same day', () => {
    // This string is part of the request's cache key. If it moved with the
    // clock, every render would ask for a window nobody had asked for yet,
    // and the panel would fetch in a loop for as long as it stayed mounted.
    const early = dueWindowEnd(new Date('2026-09-15T00:00:00.000Z'));
    const later = dueWindowEnd(new Date('2026-09-15T00:00:00.001Z'));
    const muchLater = dueWindowEnd(new Date('2026-09-15T11:59:59.999Z'));

    expect(later).toBe(early);
    expect(muchLater).toBe(early);
  });

  it('covers the whole of the seventh day, so nothing due that day is missed', () => {
    const end = new Date(dueWindowEnd(new Date('2026-09-15T08:00:00.000Z')));

    expect(end.getTime()).toBeGreaterThan(new Date('2026-09-22T08:00:00.000Z').getTime());
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('moves on once the day does', () => {
    expect(dueWindowEnd(new Date('2026-09-16T00:00:00.000Z'))).not.toBe(
      dueWindowEnd(new Date('2026-09-15T00:00:00.000Z')),
    );
  });
});
