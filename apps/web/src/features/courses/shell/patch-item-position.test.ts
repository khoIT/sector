import type { CourseOutline, CourseOutlineItem } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { patchItemPosition } from './patch-item-position';

function item(id: string, positionSeconds: number | null): CourseOutlineItem {
  return {
    id,
    kind: 'topic',
    title: id,
    depth: 1,
    parentId: null,
    lessonId: null,
    topicId: id,
    status: 'in_progress',
    completedAt: null,
    lastAccessedAt: null,
    blockedReason: null,
    quiz: null,
    positionSeconds,
    durationSeconds: 600,
  } as CourseOutlineItem;
}

function outline(items: CourseOutlineItem[]): CourseOutline {
  return {
    courseId: 'c1',
    courseMetaVersion: 1,
    status: 'in_progress',
    progress: 0.5,
    totalItems: items.length,
    completedItems: 0,
    resume: null,
    items,
  } as CourseOutline;
}

describe('patchItemPosition', () => {
  it('writes the new playhead onto the named item only', () => {
    const before = outline([item('a', 10), item('b', 20)]);

    const after = patchItemPosition('a', 95)(before);

    expect(after?.items[0]?.positionSeconds).toBe(95);
    expect(after?.items[1]?.positionSeconds).toBe(20);
  });

  it('returns the same object when the position did not move', () => {
    // Referential equality is the point, not a nicety: React Query notifies
    // every subscriber of a changed object, and the player writes on a timer.
    const before = outline([item('a', 10)]);

    expect(patchItemPosition('a', 10)(before)).toBe(before);
  });

  it('returns the same object when the item is not in this outline', () => {
    const before = outline([item('a', 10)]);

    expect(patchItemPosition('elsewhere', 95)(before)).toBe(before);
  });

  it('tolerates an outline that has not loaded', () => {
    expect(patchItemPosition('a', 95)(undefined)).toBeUndefined();
  });
});
