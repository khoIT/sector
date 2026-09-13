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
  it('rounds an unrounded float from the live API', () => {
    expect(roundedProgress(28.915662650602407)).toBe(29);
  });

  it('passes a whole percent through unchanged', () => {
    expect(roundedProgress(100)).toBe(100);
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
  it('lists all seven values the server filter accepts, exactly once each', () => {
    expect(new Set(COURSE_LIST_STATUS_FILTERS).size).toBe(7);
    expect(COURSE_LIST_STATUS_FILTERS).toEqual(
      expect.arrayContaining([
        'not_started',
        'in_progress',
        'completed',
        'expired',
        'active',
        'paused',
        'dropped',
      ]),
    );
  });
});
