import type { CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { groupOutlineItemsForDisplay } from '../outline/course-outline-model';
import { initialOpenModuleIds, toggleModuleId } from './module-row-state';

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

const groups = groupOutlineItemsForDisplay([
  item({ id: 'm1', depth: 0 }),
  item({ id: 'm1-t1', kind: 'topic', depth: 1 }),
  item({ id: 'm2', depth: 0 }),
  item({ id: 'm2-t1', kind: 'topic', depth: 1 }),
  item({ id: 'm2-q1', kind: 'quiz', depth: 1 }),
  item({ id: 'm3', depth: 0 }),
]);

describe('initialOpenModuleIds', () => {
  it('opens the module holding the item the learner would resume', () => {
    expect(initialOpenModuleIds(groups, 'm2-q1')).toEqual(['m2']);
  });

  it('opens a module whose own header is the resume target', () => {
    expect(initialOpenModuleIds(groups, 'm3')).toEqual(['m3']);
  });

  it('opens one module and no others, so a 185-item course is still one screen', () => {
    expect(initialOpenModuleIds(groups, 'm2-t1')).toHaveLength(1);
  });

  it('opens the first module for a course with nothing to resume', () => {
    // A finished course, or one whose only remaining item is blocked. The page
    // still has to show something other than a stack of closed rows.
    expect(initialOpenModuleIds(groups, null)).toEqual(['m1']);
  });

  it('opens the first module when the pointer names an item the outline does not hold', () => {
    expect(initialOpenModuleIds(groups, 'gone')).toEqual(['m1']);
  });

  it('opens nothing for a course with no content', () => {
    expect(initialOpenModuleIds([], 'anything')).toEqual([]);
  });
});

describe('toggleModuleId', () => {
  it('opens a closed module', () => {
    expect(toggleModuleId(['m1'], 'm2')).toEqual(['m1', 'm2']);
  });

  it('closes an open one', () => {
    expect(toggleModuleId(['m1', 'm2'], 'm1')).toEqual(['m2']);
  });

  it('leaves the other modules alone — this is not an accordion', () => {
    // Comparing two modules means having both open at once. Auto-closing the
    // previous one is the behaviour that makes that impossible.
    expect(toggleModuleId(['m1'], 'm3')).toEqual(['m1', 'm3']);
  });
});
