import { describe, expect, it } from 'vitest';

import { clampIndex, isFirstQuestion, isLastQuestion } from './navigation';

describe('clampIndex', () => {
  it('passes through a valid index', () => {
    expect(clampIndex(2, 5)).toBe(2);
  });

  it('clamps below the first question to 0', () => {
    expect(clampIndex(-1, 5)).toBe(0);
  });

  it('clamps past the last question to length - 1', () => {
    expect(clampIndex(9, 5)).toBe(4);
  });

  it('returns 0 for a zero-question quiz rather than a negative index', () => {
    expect(clampIndex(0, 0)).toBe(0);
    expect(clampIndex(3, 0)).toBe(0);
  });
});

describe('isFirstQuestion / isLastQuestion', () => {
  it('identifies the first question', () => {
    expect(isFirstQuestion(0)).toBe(true);
    expect(isFirstQuestion(1)).toBe(false);
  });

  it('identifies the last question', () => {
    expect(isLastQuestion(4, 5)).toBe(true);
    expect(isLastQuestion(3, 5)).toBe(false);
  });
});
