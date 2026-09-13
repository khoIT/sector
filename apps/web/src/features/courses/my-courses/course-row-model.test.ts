import { describe, expect, it } from 'vitest';

import {
  COURSE_LIST_STATUS_FILTERS,
  courseActionLabelKey,
  courseProgressTone,
  roundedProgress,
} from './course-row-model';

describe('courseProgressTone', () => {
  it.each([
    ['not_started', 'neutral'],
    ['in_progress', 'accent'],
    ['completed', 'ok'],
  ] as const)('maps %j to %j', (status, tone) => {
    expect(courseProgressTone(status)).toBe(tone);
  });
});

describe('courseActionLabelKey', () => {
  it('starts an untouched course', () => {
    expect(courseActionLabelKey('not_started')).toBe('courses.index.action.start');
  });

  it('resumes a course already in progress', () => {
    expect(courseActionLabelKey('in_progress')).toBe('courses.index.action.resume');
  });

  it('offers to review a completed course rather than hiding the action', () => {
    expect(courseActionLabelKey('completed')).toBe('courses.index.action.review');
  });
});

describe('roundedProgress', () => {
  it('rounds a float, in case any route ever sends one', () => {
    expect(roundedProgress(28.915662650602407)).toBe(29);
  });

  it('is a no-op on the whole percent the API sends today (no double-rounding)', () => {
    expect(roundedProgress(29)).toBe(29);
    expect(roundedProgress(100)).toBe(100);
    expect(roundedProgress(0)).toBe(0);
  });

  it('clamps a value below zero', () => {
    expect(roundedProgress(-4)).toBe(0);
  });

  it('clamps a value above 100', () => {
    expect(roundedProgress(104)).toBe(100);
  });

  it('treats a non-finite value as no progress rather than throwing', () => {
    expect(roundedProgress(Number.NaN)).toBe(0);
  });
});

describe('COURSE_LIST_STATUS_FILTERS', () => {
  it('offers the six values that can fill the grid, exactly once each', () => {
    expect(new Set(COURSE_LIST_STATUS_FILTERS).size).toBe(6);
    expect(COURSE_LIST_STATUS_FILTERS).toEqual(
      expect.arrayContaining([
        'not_started',
        'in_progress',
        'completed',
        'active',
        'paused',
        'dropped',
      ]),
    );
  });

  /**
   * The route accepts `expired` and this menu does not offer it: filtering on
   * it keeps only rows that normalizeLearnerCourses then moves into the
   * separate `expired` array, so `items` comes back empty every time and the
   * grid can only say "no courses match". Verified against the mirror —
   * `?status=expired` answers `{ totalPages: 0, totalItems: 0, items: [] }`.
   * The expired enrolments have their own section under the grid.
   */
  it('does not offer the one the grid can never show', () => {
    expect(COURSE_LIST_STATUS_FILTERS).not.toContain('expired');
  });
});
