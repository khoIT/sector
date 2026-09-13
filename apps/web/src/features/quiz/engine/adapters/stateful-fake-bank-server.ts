import type { QuestionBankResult } from '@sector/api-client';

import { createFakeApiClient, type FakeApiClient } from './fake-api-client';

/**
 * A fake `/api/v2/question-banks*` backend that actually remembers what was
 * saved, unlike the stateless canned-response fakes in bank.test.ts. Needed
 * for the one contract property that a stateless fake cannot prove: that an
 * answer saved through `saveAnswer` is visible on the NEXT `loadProgress` —
 * autosave that cannot be read back is not autosave, it just looks like it
 * in a test that never checks.
 */
export function createStatefulFakeBankServer(
  quizId: string,
  result: QuestionBankResult,
): { client: FakeApiClient } {
  const savedAnswers: Record<string, string[]> = {};
  let startedAt: string | null = null;

  const client = createFakeApiClient(({ method, path, body }) => {
    if (method === 'GET' && path === `/api/v2/question-banks/progress/${quizId}`) {
      const answeredIds = Object.keys(savedAnswers);
      if (answeredIds.length === 0) return { progress: null, attemptInfo: null };
      return {
        progress: savedAnswers,
        attemptInfo: {
          attemptId: 'attempt-1',
          startedAt: startedAt ?? new Date(0).toISOString(),
          totalQuestions: 1,
          answeredQuestions: answeredIds.length,
          progressPercentage: 100,
        },
      };
    }

    if (method === 'POST' && path === '/api/v2/question-banks/save-progress') {
      const { questionId, selectedAnswers } = body as {
        questionId: string;
        selectedAnswers: string[];
      };
      startedAt ??= new Date(0).toISOString();
      savedAnswers[questionId] = selectedAnswers;
      return { questionId, selectedAnswers, saved: true };
    }

    if (method === 'POST' && path === '/api/v2/question-banks/check-answers') {
      return result;
    }

    throw new Error(`stateful fake bank server: unexpected request ${method} ${path}`);
  });

  return { client };
}
