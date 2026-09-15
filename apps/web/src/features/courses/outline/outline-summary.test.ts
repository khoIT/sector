import type { CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  formatDurationShort,
  groupRemainingSeconds,
  groupTotalSeconds,
  summariseOutline,
} from './outline-summary';

/**
 * The header's ring and its "N left to watch" line both come from here. The
 * cases that matter are the ones where a number is missing rather than zero:
 * 43 of the library's videos are private and carry no runtime at all, and a
 * course that says "0 minutes left" with an hour still in it is worse than one
 * that says nothing.
 */

function item(
  overrides: Partial<CourseOutlineItem> & Pick<CourseOutlineItem, 'id'>,
): CourseOutlineItem {
  return {
    kind: 'topic',
    title: overrides.id,
    order: 0,
    depth: 1,
    parentId: null,
    lessonId: null,
    topicId: null,
    prevId: null,
    nextId: null,
    status: 'not_started',
    completedAt: null,
    lastAccessedAt: null,
    blockedReason: null,
    quiz: null,
    positionSeconds: null,
    durationSeconds: null,
    imageUrl: null,
    ...overrides,
  };
}

describe('summariseOutline', () => {
  it('counts items and adds up the runtimes it knows', () => {
    const summary = summariseOutline([
      item({ id: 'a', durationSeconds: 600, status: 'completed' }),
      item({ id: 'b', durationSeconds: 300 }),
    ]);
    expect(summary).toEqual({
      totalItems: 2,
      completedItems: 1,
      totalSeconds: 900,
      remainingSeconds: 300,
    });
  });

  it('leaves both totals null when no item has a runtime', () => {
    // Not zero: the caller must be able to tell "nothing left to watch" from
    // "we do not know how long this is".
    const summary = summariseOutline([item({ id: 'a' }), item({ id: 'b', status: 'completed' })]);
    expect(summary.totalSeconds).toBeNull();
    expect(summary.remainingSeconds).toBeNull();
  });

  it('reports zero remaining once every known runtime is watched', () => {
    const summary = summariseOutline([
      item({ id: 'a', durationSeconds: 600, status: 'completed' }),
      item({ id: 'b', durationSeconds: 300, status: 'completed' }),
    ]);
    expect(summary.totalSeconds).toBe(900);
    expect(summary.remainingSeconds).toBe(0);
  });

  it('adds up only the runtimes it has, ignoring the ones it does not', () => {
    // A course mixing public and private videos is the normal case, not an
    // edge one — the total is honest about being partial rather than absent.
    const summary = summariseOutline([
      item({ id: 'public', durationSeconds: 600 }),
      item({ id: 'private' }),
    ]);
    expect(summary.totalSeconds).toBe(600);
    expect(summary.remainingSeconds).toBe(600);
  });

  it('excludes a blocked item from the counts', () => {
    // The server leaves these out of totalItems too; two denominators that
    // disagree would show a course that can never reach 100%.
    const summary = summariseOutline([
      item({ id: 'a', status: 'completed' }),
      item({ id: 'blocked', kind: 'quiz', blockedReason: 'quiz_has_no_questions' }),
    ]);
    expect(summary.totalItems).toBe(1);
    expect(summary.completedItems).toBe(1);
  });

  it('does not count a blocked item’s runtime either', () => {
    const summary = summariseOutline([
      item({ id: 'a', durationSeconds: 600 }),
      item({ id: 'blocked', blockedReason: 'quiz_has_no_questions', durationSeconds: 999 }),
    ]);
    expect(summary.totalSeconds).toBe(600);
  });

  it('treats a failed quiz as not completed', () => {
    const summary = summariseOutline([item({ id: 'q', kind: 'quiz', status: 'failed' })]);
    expect(summary.completedItems).toBe(0);
  });

  it('handles an empty outline without dividing by anything', () => {
    expect(summariseOutline([])).toEqual({
      totalItems: 0,
      completedItems: 0,
      totalSeconds: null,
      remainingSeconds: null,
    });
  });
});

describe('group totals', () => {
  const group = {
    header: item({ id: 'lesson', kind: 'lesson', depth: 0, durationSeconds: null }),
    children: [
      item({ id: 'one', durationSeconds: 600, status: 'completed' }),
      item({ id: 'two', durationSeconds: 240 }),
    ],
  };

  it('adds the header in with its children', () => {
    expect(groupTotalSeconds(group)).toBe(840);
    expect(groupRemainingSeconds(group)).toBe(240);
  });

  it('returns null for a group with no known runtimes', () => {
    expect(
      groupTotalSeconds({ header: item({ id: 'l', kind: 'lesson', depth: 0 }), children: [] }),
    ).toBeNull();
  });
});

describe('formatDurationShort', () => {
  it('shows seconds only under a minute', () => {
    expect(formatDurationShort(48)).toBe('48s');
    expect(formatDurationShort(0)).toBe('0s');
  });

  it('rounds to whole minutes above a minute', () => {
    // 10m16s reads as 10m on a row of a dozen lectures: the comparison is the
    // point, not the precision.
    expect(formatDurationShort(616)).toBe('10m');
    expect(formatDurationShort(240)).toBe('4m');
  });

  it('splits hours out once there is one', () => {
    expect(formatDurationShort(4320)).toBe('1h 12m');
    expect(formatDurationShort(3600)).toBe('1h');
  });

  it('returns null for an unknown or nonsensical runtime', () => {
    expect(formatDurationShort(null)).toBeNull();
    expect(formatDurationShort(-5)).toBeNull();
    expect(formatDurationShort(Number.NaN)).toBeNull();
  });
});
