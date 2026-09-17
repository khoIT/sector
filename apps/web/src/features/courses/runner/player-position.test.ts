import type { CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { summariseOutline } from '../outline/outline-summary';
import { positionLabel } from './player-position';

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

describe('positionLabel', () => {
  const items = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];

  it('is 1-based, the way a reader counts', () => {
    expect(positionLabel(items, 'a')).toEqual({ index: 1, total: 3 });
    expect(positionLabel(items, 'c')).toEqual({ index: 3, total: 3 });
  });

  it('skips a blocked quiz in both halves', () => {
    const withBlocked = [
      item({ id: 'a' }),
      item({ id: 'locked', kind: 'quiz', blockedReason: 'quiz_has_no_questions' }),
      item({ id: 'b' }),
    ];

    // Not 3 of 3: the middle item cannot be opened, so counting it would make
    // the second openable topic read as the third of three.
    expect(positionLabel(withBlocked, 'b')).toEqual({ index: 2, total: 2 });
  });

  it('agrees with the total every other surface shows', () => {
    const withBlocked = [
      item({ id: 'a' }),
      item({ id: 'locked', kind: 'quiz', blockedReason: 'quiz_has_no_questions' }),
      item({ id: 'b' }),
    ];

    expect(positionLabel(withBlocked, 'a').total).toBe(summariseOutline(withBlocked).totalItems);
  });

  it('reports no index for an item the outline does not hold', () => {
    expect(positionLabel(items, 'gone')).toEqual({ index: 0, total: 3 });
    expect(positionLabel(items, null)).toEqual({ index: 0, total: 3 });
  });

  it('reports nothing at all for an empty outline', () => {
    expect(positionLabel([], 'a')).toEqual({ index: 0, total: 0 });
  });
});
