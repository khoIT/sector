import { describe, expect, it } from 'vitest';

import { canStartQuiz } from './refuse-empty-quiz';

describe('canStartQuiz', () => {
  it('refuses a quiz with zero questions', () => {
    expect(canStartQuiz(0)).toBe(false);
  });

  it('allows a quiz with at least one question', () => {
    expect(canStartQuiz(1)).toBe(true);
    expect(canStartQuiz(66)).toBe(true);
  });
});
