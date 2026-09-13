import { describe, expect, it } from 'vitest';

import { segmentState, segmentStates } from './segmented-progress-state';

describe('segmentState', () => {
  it('marks the current index as current even when it is already answered', () => {
    expect(segmentState(2, 2, true)).toBe('current');
    expect(segmentState(2, 2, false)).toBe('current');
  });

  it('marks a done, non-current segment as done', () => {
    expect(segmentState(0, 2, true)).toBe('done');
  });

  it('marks an unanswered, non-current segment as todo', () => {
    expect(segmentState(4, 2, false)).toBe('todo');
  });
});

describe('segmentStates', () => {
  it('builds one state per segment in order', () => {
    const done = new Set([0, 1]);
    expect(segmentStates(4, 2, (index) => done.has(index))).toEqual([
      'done',
      'done',
      'current',
      'todo',
    ]);
  });

  it('returns an empty array for zero or negative totals', () => {
    expect(segmentStates(0, 0, () => false)).toEqual([]);
    expect(segmentStates(-3, 0, () => false)).toEqual([]);
  });
});
