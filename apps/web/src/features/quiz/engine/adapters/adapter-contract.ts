import { describe, expect, it } from 'vitest';

import type { QuizAdapter, QuizResult } from '../types';

/**
 * The contract every `QuizAdapter` implementation has to satisfy, regardless
 * of what "save" and "grade" mean for it — a bank autosaves and grades once
 * at the end, a future course-quiz adapter submits and grades per question,
 * but both are three functions with these exact guarantees.
 *
 * Deliberately NOT a `.test.ts` file: it calls `describe`/`it` but registers
 * nothing on its own — a plain `.ts` module can be imported by any number of
 * `.test.ts` files without re-running anyone else's suite. `adapter-contract.test.ts`
 * (this bank's own) and a later `course.test.ts` both import
 * `runQuizAdapterContractTests` from here and call it themselves; neither
 * imports the other's `.test.ts` file.
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
    it('a fresh attempt has nothing to resume', async () => {
      const { adapter } = createHarness();
      const progress = await adapter.loadProgress();
      expect(progress.answers).toEqual({});
      expect(progress.startedAt).toBeNull();
      expect(progress.resumeQuestionId).toBeNull();
    });

    it('an answer saved through saveAnswer is visible on the next loadProgress', async () => {
      // The one property a stateless canned-response fake cannot prove:
      // autosave that cannot be read back is not autosave. `createHarness`
      // must hand back a harness whose adapter is backed by a server that
      // actually remembers what it was told.
      const { adapter } = createHarness();
      await adapter.saveAnswer('q1', ['a']);
      const progress = await adapter.loadProgress();
      expect(progress.answers.q1).toEqual(['a']);
      expect(progress.resumeQuestionId).toBe('q1');
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
