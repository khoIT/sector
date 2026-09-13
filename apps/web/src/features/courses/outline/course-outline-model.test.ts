import type { CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  blockedReasonLabelKey,
  findOutlineItem,
  groupOutlineItemsForDisplay,
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
    ['completed', 'courses.outline.resume.review'],
  ] as const)('maps item status %j to %j', (status, key) => {
    expect(resumeActionLabelKey(status)).toBe(key);
  });
});

describe('blockedReasonLabelKey', () => {
  it('keys the one documented blocked reason', () => {
    expect(blockedReasonLabelKey('quiz_has_no_questions')).toBe(
      'courses.outline.blocked.quiz_has_no_questions',
    );
  });
});
