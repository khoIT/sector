import type { CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  blockedReasonLabelKey,
  findOutlineItem,
  groupOutlineItemsForDisplay,
  isOutlineComplete,
  resolveResumeTarget,
  resumeActionLabelKey,
} from './course-outline-model';

function item(
  overrides: Partial<CourseOutlineItem> & Pick<CourseOutlineItem, 'id'>,
): CourseOutlineItem {
  return {
    kind: 'lesson',
    title: overrides.id,
    order: 0,
    depth: 0,
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

describe('groupOutlineItemsForDisplay', () => {
  it('nests a lesson’s topics and quizzes under it, preserving order', () => {
    const items = [
      item({ id: 'l1', kind: 'lesson', depth: 0, lessonId: 'l1' }),
      item({ id: 't1', kind: 'topic', depth: 1, lessonId: 'l1', topicId: 't1' }),
      item({ id: 'q1', kind: 'quiz', depth: 2, lessonId: 'l1', topicId: 't1' }),
      item({ id: 'l2', kind: 'lesson', depth: 0, lessonId: 'l2' }),
    ];

    const groups = groupOutlineItemsForDisplay(items);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.header.id).toBe('l1');
    expect(groups[0]?.children.map((child) => child.id)).toEqual(['t1', 'q1']);
    expect(groups[1]?.header.id).toBe('l2');
    expect(groups[1]?.children).toEqual([]);
  });

  it('gives the fourth nesting shape (course > topic > quiz) its own group with no enclosing lesson', () => {
    const items = [
      item({ id: 't1', kind: 'topic', depth: 0, lessonId: null, topicId: 't1' }),
      item({ id: 'q1', kind: 'quiz', depth: 1, lessonId: null, topicId: 't1' }),
    ];

    const groups = groupOutlineItemsForDisplay(items);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.header.kind).toBe('topic');
    expect(groups[0]?.children.map((child) => child.id)).toEqual(['q1']);
  });

  it('never drops an item, even from a malformed outline that does not start at depth 0', () => {
    const items = [item({ id: 'stray', depth: 3 })];
    const groups = groupOutlineItemsForDisplay(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.header.id).toBe('stray');
  });

  it('returns no groups for an empty outline', () => {
    expect(groupOutlineItemsForDisplay([])).toEqual([]);
  });
});

describe('findOutlineItem', () => {
  const items = [item({ id: 'a' }), item({ id: 'b' })];

  it('finds an item by id', () => {
    expect(findOutlineItem(items, 'b')?.id).toBe('b');
  });

  it('returns undefined for a null id (an end of the list)', () => {
    expect(findOutlineItem(items, null)).toBeUndefined();
  });

  it('returns undefined for an id not in the list', () => {
    expect(findOutlineItem(items, 'missing')).toBeUndefined();
  });
});

describe('resumeActionLabelKey', () => {
  it.each([
    ['not_started', 'courses.outline.resume.start'],
    ['in_progress', 'courses.outline.resume.resume'],
    ['failed', 'courses.outline.resume.retry'],
    ['completed', 'courses.outline.resume.review'],
  ] as const)('maps item status %j to %j', (status, key) => {
    expect(resumeActionLabelKey(status)).toBe(key);
  });
});

/**
 * The route's own resume rule is "first incomplete leaf" with no test for
 * `blockedReason` (learners.outline.helper.ts), so every case here is a
 * pointer it really can send.
 */
describe('resolveResumeTarget', () => {
  const blockedQuiz = item({
    id: 'q-empty',
    kind: 'quiz',
    blockedReason: 'quiz_has_no_questions',
    quiz: { questionCount: 0, attempts: 0, bestPercentage: null, passed: null },
  });

  it('honours the pointer when it names something openable', () => {
    const items = [item({ id: 't1', status: 'completed' }), item({ id: 't2' })];
    expect(resolveResumeTarget(items, 't2')?.id).toBe('t2');
  });

  it('skips a blocked quiz the route pointed at, for the next openable item', () => {
    const items = [item({ id: 't1', status: 'completed' }), blockedQuiz, item({ id: 't2' })];
    expect(resolveResumeTarget(items, 'q-empty')?.id).toBe('t2');
  });

  it('offers a failed quiz again — it is unfinished, not unopenable', () => {
    const items = [item({ id: 'q1', kind: 'quiz', status: 'failed' })];
    expect(resolveResumeTarget(items, 'q1')?.id).toBe('q1');
  });

  it('has nothing to resume when the only item left is blocked', () => {
    const items = [item({ id: 't1', status: 'completed' }), blockedQuiz];
    expect(resolveResumeTarget(items, 'q-empty')).toBeUndefined();
  });

  it('falls back to the first openable item when the pointer names nothing', () => {
    const items = [item({ id: 't1', status: 'completed' }), item({ id: 't2' })];
    expect(resolveResumeTarget(items, 'gone')?.id).toBe('t2');
  });

  it('has nothing to resume in an empty outline', () => {
    expect(resolveResumeTarget([], null)).toBeUndefined();
  });
});

describe('isOutlineComplete', () => {
  it('is complete when every countable item is done', () => {
    expect(isOutlineComplete({ totalItems: 8, completedItems: 8 })).toBe(true);
  });

  it('is not complete part way through', () => {
    expect(isOutlineComplete({ totalItems: 8, completedItems: 7 })).toBe(false);
  });

  /**
   * A course whose content is all unpublished or all blocked resolves to an
   * empty item list. It has nothing to resume, which used to be read as
   * "finished" and told the learner they had completed a course with no
   * content in it. GET .../68f04e61fa8359afd6836877/outline on the mirror
   * returns exactly this.
   */
  it('is not complete when there is nothing to complete', () => {
    expect(isOutlineComplete({ totalItems: 0, completedItems: 0 })).toBe(false);
  });
});

describe('blockedReasonLabelKey', () => {
  it('keys the one documented blocked reason', () => {
    expect(blockedReasonLabelKey('quiz_has_no_questions')).toBe(
      'courses.outline.blocked.quiz_has_no_questions',
    );
  });
});
