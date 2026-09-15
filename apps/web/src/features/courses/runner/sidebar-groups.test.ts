import type { CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import type { CourseOutlineGroup } from '../outline/course-outline-model';
import { isGroupOpen } from './sidebar-groups';

const item = (id: string) => ({ id, title: id }) as CourseOutlineItem;
const group = (headerId: string, childIds: string[]): CourseOutlineGroup =>
  ({ header: item(headerId), children: childIds.map(item) }) as CourseOutlineGroup;

describe('isGroupOpen', () => {
  it('opens the module holding the current item', () => {
    expect(isGroupOpen(group('lesson-1', ['topic-a', 'topic-b']), 'topic-b')).toBe(true);
  });

  it('opens the module whose own header is the current item', () => {
    expect(isGroupOpen(group('lesson-1', ['topic-a']), 'lesson-1')).toBe(true);
  });

  it('leaves every other module closed', () => {
    expect(isGroupOpen(group('lesson-2', ['topic-c']), 'topic-b')).toBe(false);
  });

  it('leaves a module closed when nothing is open yet', () => {
    expect(isGroupOpen(group('lesson-1', ['topic-a']), '')).toBe(false);
  });
});
