import type { QuestionBankResult } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { createBankAdapter } from './bank';
import { createFakeApiClient } from './fake-api-client';

const RESULT: QuestionBankResult = {
  attemptId: 'attempt-1',
  quizId: 'quiz-1',
  slug: 'bank',
  title: 'Bank',
  score: 1,
  totalScore: 2,
  percentageScore: 50,
  passed: false,
  timeSpent: 42,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:00:42.000Z',
  questions: [],
  totalAttempts: 1,
  bestScore: 50,
  averageScore: 50,
};

describe('createBankAdapter — loadProgress', () => {
  it('reports no attempt to resume when the server has none', async () => {
    const client = createFakeApiClient(() => ({ progress: null, attemptInfo: null }));
    const adapter = createBankAdapter(client, 'quiz-1');

    await expect(adapter.loadProgress()).resolves.toEqual({ answers: {}, startedAt: null });
    expect(client.requests[0]).toMatchObject({
      method: 'GET',
      path: '/api/v2/question-banks/progress/quiz-1',
    });
  });

  it('surfaces the saved answers and the attempt start time to resume from', async () => {
    const client = createFakeApiClient(() => ({
      progress: { q1: ['a'] },
      attemptInfo: {
        attemptId: 'attempt-1',
        startedAt: '2026-01-01T00:00:00.000Z',
        totalQuestions: 2,
        answeredQuestions: 1,
        progressPercentage: 50,
      },
    }));
    const adapter = createBankAdapter(client, 'quiz-1');

    await expect(adapter.loadProgress()).resolves.toEqual({
      answers: { q1: ['a'] },
      startedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('createBankAdapter — saveAnswer', () => {
  it('posts the quiz id, question id and selection to save-progress', async () => {
    const client = createFakeApiClient(() => ({
      questionId: 'q1',
      selectedAnswers: ['a'],
      saved: true,
    }));
    const adapter = createBankAdapter(client, 'quiz-1');

    await adapter.saveAnswer('q1', ['a']);

    expect(client.requests[0]).toEqual({
      method: 'POST',
      path: '/api/v2/question-banks/save-progress',
      body: { quizId: 'quiz-1', questionId: 'q1', selectedAnswers: ['a'] },
    });
  });
});

describe('createBankAdapter — finish', () => {
  it('sends every selection as an array, for both single and multi-select questions', async () => {
    const client = createFakeApiClient(() => RESULT);
    const adapter = createBankAdapter(client, 'quiz-1');

    await adapter.finish({
      answers: { q1: ['a'], q2: ['a', 'b'] },
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:42.000Z',
    });

    const [request] = client.requests;
    expect(request?.method).toBe('POST');
    expect(request?.path).toBe('/api/v2/question-banks/check-answers');
    expect(request?.body).toMatchObject({
      quizId: 'quiz-1',
      submittedAnswers: [
        { questionId: 'q1', answerId: ['a'] },
        { questionId: 'q2', answerId: ['a', 'b'] },
      ],
    });
  });

  it('converts the ISO start/finish times to the epoch milliseconds the server expects', async () => {
    const client = createFakeApiClient(() => RESULT);
    const adapter = createBankAdapter(client, 'quiz-1');

    await adapter.finish({
      answers: {},
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:42.000Z',
    });

    expect(client.requests[0]?.body).toMatchObject({
      dateTimeStarted: Date.parse('2026-01-01T00:00:00.000Z'),
      dateTimeFinished: Date.parse('2026-01-01T00:00:42.000Z'),
    });
  });

  it('never computes a score — it returns exactly what the server sent back', async () => {
    const client = createFakeApiClient(() => RESULT);
    const adapter = createBankAdapter(client, 'quiz-1');

    const result = await adapter.finish({
      answers: {},
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:42.000Z',
    });

    expect(result).toEqual(RESULT);
  });
});
