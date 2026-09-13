import { describe, expect, it } from 'vitest';

import type { QuizAdapter, QuizResult } from '../types';
import { createBankAdapter } from './bank';
import { createFakeApiClient } from './fake-api-client';

/**
 * The contract every `QuizAdapter` implementation has to satisfy, regardless
 * of what "save" and "grade" mean for it — a bank autosaves and grades once
 * at the end, a future course-quiz adapter submits and grades per question,
 * but both are three functions with these exact guarantees. Exported so a
 * later course adapter's own test file can run this suite unchanged:
 *
 *   import { runQuizAdapterContractTests } from '.../adapter-contract.test';
 *   runQuizAdapterContractTests('course quiz', () => ({ ... }));
 */
export type QuizAdapterHarness = {
  adapter: QuizAdapter;
  /** A result the harness's `finish()` will resolve with. */
  result: QuizResult;
};

export function runQuizAdapterContractTests(
  name: string,
  createHarness: () => QuizAdapterHarness,
): void {
  describe(`${name} adapter contract`, () => {
    it('loadProgress resolves an { answers, startedAt } shape', async () => {
      const { adapter } = createHarness();
      const progress = await adapter.loadProgress();
      expect(progress).toHaveProperty('answers');
      expect(progress).toHaveProperty('startedAt');
      expect(typeof progress.answers).toBe('object');
    });

    it('saveAnswer resolves without throwing for a real question/answer pair', async () => {
      const { adapter } = createHarness();
      await expect(adapter.saveAnswer('q1', ['a'])).resolves.toBeUndefined();
    });

    it('finish never computes a score — it returns exactly what the harness resolves', async () => {
      const { adapter, result } = createHarness();

      const finished = await adapter.finish({
        answers: { q1: ['a'] },
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: '2026-01-01T00:00:42.000Z',
      });

      // Not "deep equal to a client-side recomputation" — deep equal to the
      // exact object the fake backend handed back (parsed by the same Zod
      // schema a real ApiClient applies, hence not the same object
      // reference), proving nothing in between recalculated any of it.
      expect(finished).toEqual(result);
    });
  });
}

runQuizAdapterContractTests('question bank', () => {
  const result: QuizResult = {
    attemptId: 'attempt-1',
    quizId: 'quiz-1',
    slug: 'bank',
    title: 'Bank',
    score: 1,
    totalScore: 1,
    percentageScore: 100,
    passed: true,
    timeSpent: 12,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:12.000Z',
    questions: [],
    totalAttempts: 1,
    bestScore: 100,
    averageScore: 100,
  };

  const client = createFakeApiClient(({ method, path }) => {
    if (method === 'GET' && path.endsWith('/progress/quiz-1')) {
      return { progress: null, attemptInfo: null };
    }
    if (method === 'POST' && path.endsWith('/save-progress')) {
      return { questionId: 'q1', selectedAnswers: ['a'], saved: true };
    }
    if (method === 'POST' && path.endsWith('/check-answers')) {
      return result;
    }
    throw new Error(`unexpected request in adapter contract test: ${method} ${path}`);
  });

  return { adapter: createBankAdapter(client, 'quiz-1'), result };
});
