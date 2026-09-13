import { describe, expect, it } from 'vitest';

import { runQuizAdapterContractTests } from './adapter-contract';
import { createCourseQuizAdapter, toEngineAnswerType } from './course';
import { createFakeApiClient } from './fake-api-client';
import { createStatefulFakeCourseQuizServer } from './stateful-fake-course-quiz-server';

const STARTED_AT = '2026-01-01T00:00:00.000Z';
const FINISHED_AT = '2026-01-01T00:00:42.000Z';

/**
 * The course adapter's own run of the shared contract suite (see
 * ./adapter-contract.ts) — a two-question quiz so answering one question
 * leaves the attempt resumable rather than auto-completing it (a course quiz
 * completes the instant every question has been answered once, unlike a
 * question bank).
 */
runQuizAdapterContractTests('course quiz', () => {
  const { client } = createStatefulFakeCourseQuizServer('course-1', 'quiz-1', 2);
  return {
    adapter: createCourseQuizAdapter(client, 'course-1', 'quiz-1'),
    // Only q1 is submitted (the shared suite's `finish` test never answers
    // q2), so the attempt is not yet complete: score/percentage/passed
    // reflect exactly the one graded answer, computed by the fake server the
    // same way the real API computes them from `quizAttempts`.
    result: {
      score: 1,
      totalScore: 2,
      percentageScore: 50,
      passed: false,
      timeSpent: 42,
      questions: [
        {
          questionId: 'q1',
          title: 'Q1',
          answerType: 'single',
          isCorrect: true,
          correctAnswers: [{ title: 'A' }],
          selectedAnswers: [{ title: 'A' }],
        },
      ],
    },
  };
});

describe('createCourseQuizAdapter — loadProgress', () => {
  it('resumes at the last answered question when the attempt is not yet complete', async () => {
    const { client } = createStatefulFakeCourseQuizServer('course-1', 'quiz-1', 2);
    const adapter = createCourseQuizAdapter(client, 'course-1', 'quiz-1');

    await adapter.saveAnswer('q1', ['a']);
    const progress = await adapter.loadProgress();

    expect(progress.answers).toEqual({ q1: ['a'] });
    expect(progress.resumeQuestionId).toBe('q1');
    expect(progress.startedAt).not.toBeNull();
  });

  it('reports nothing to resume once the attempt has completed', async () => {
    const { client } = createStatefulFakeCourseQuizServer('course-1', 'quiz-1', 1);
    const adapter = createCourseQuizAdapter(client, 'course-1', 'quiz-1');

    // A one-question quiz completes on the first (and only) answer.
    await adapter.saveAnswer('q1', ['a']);

    await expect(adapter.loadProgress()).resolves.toEqual({
      answers: {},
      startedAt: null,
      resumeQuestionId: null,
    });
  });
});

describe('createCourseQuizAdapter — saveAnswer', () => {
  it('posts the question and selection to the course quiz track route', async () => {
    const client = createFakeApiClient(() => ({
      questionId: 'q1',
      questionTitle: 'Q1',
      answerType: 'single',
      selectedAnswerIds: ['a'],
      correctAnswerIds: ['a'],
      isCorrect: true,
      points: 1,
      earnedPoints: 1,
      timeSpent: 0,
      quizCompleted: false,
      courseStatus: 'in_progress',
      courseProgress: 0,
    }));
    const adapter = createCourseQuizAdapter(client, 'course-1', 'quiz-1');

    await adapter.saveAnswer('q1', ['a']);

    expect(client.requests[0]).toMatchObject({
      method: 'POST',
      path: '/api/v2/learners/courses/course-1/quizzes/quiz-1/track',
      body: { questionId: 'q1', answerId: ['a'] },
    });
  });
});

describe('createCourseQuizAdapter — finish', () => {
  it('does not resubmit an answer the server already recorded (avoids double-counting timeSpent)', async () => {
    const { client } = createStatefulFakeCourseQuizServer('course-1', 'quiz-1', 2);
    const adapter = createCourseQuizAdapter(client, 'course-1', 'quiz-1');

    await adapter.saveAnswer('q1', ['a']);
    (client.requests as unknown[]).length = 0; // only count what `finish` itself does

    await adapter.finish({
      answers: { q1: ['a'], q2: ['a'] },
      startedAt: STARTED_AT,
      finishedAt: FINISHED_AT,
    });

    const trackRequests = client.requests.filter((request) => request.path.endsWith('/track'));
    // q1 was already recorded by saveAnswer above; only q2 is genuinely missing.
    expect(trackRequests).toHaveLength(1);
    expect(trackRequests[0]?.body).toMatchObject({ questionId: 'q2' });
  });

  it('submits every answer when nothing was recorded yet (e.g. an interrupted saveAnswer chain)', async () => {
    const { client } = createStatefulFakeCourseQuizServer('course-1', 'quiz-1', 2);
    const adapter = createCourseQuizAdapter(client, 'course-1', 'quiz-1');

    const result = await adapter.finish({
      answers: { q1: ['a'], q2: ['b'] },
      startedAt: STARTED_AT,
      finishedAt: FINISHED_AT,
    });

    expect(result.questions).toHaveLength(2);
    // Fixture rule: only q1 answered 'a' ever grades correct, so 1/2 = 50%, below the fake's 70% pass mark.
    expect(result.score).toBe(1);
    expect(result.passed).toBe(false);
  });
});

describe('toEngineAnswerType', () => {
  it('maps the known multiple-choice value through', () => {
    expect(toEngineAnswerType('multiple')).toBe('multiple');
  });

  it('maps single choice, and any other production value (e.g. the one real sort_answer question), to single', () => {
    expect(toEngineAnswerType('single')).toBe('single');
    expect(toEngineAnswerType('sort_answer')).toBe('single');
  });
});
