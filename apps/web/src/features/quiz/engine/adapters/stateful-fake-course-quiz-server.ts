import { createFakeApiClient, type FakeApiClient } from './fake-api-client';

type FakeAnswer = {
  questionId: string;
  title: string;
  answerType: string;
  isCorrect: boolean;
  points: number;
  earnedPoints: number;
  correctAnswerIds: string[];
  correctAnswers: { title: string }[];
  selectedAnswers: { title: string }[];
  selectedAnswerIds: string[];
  answeredAt: string;
};

type FakeAttempt = {
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  percentageScore: number | null;
  totalPoints: number | null;
  passed: boolean | null;
  timeSpent: number;
  answers: FakeAnswer[];
};

/**
 * A fake `GET .../quizzes/progress` + `POST .../quizzes/:quizId/track` server
 * that actually remembers what was submitted — same reasoning as
 * `stateful-fake-bank-server.ts`. Only `q1` is ever graded correct, and only
 * when its lone selection is `'a'`; a two-question quiz (`q1`, `q2`) so that
 * answering one question leaves the attempt genuinely resumable rather than
 * auto-completing it, which a one-question fixture would (a course quiz
 * completes the instant every question has been answered once).
 */
export function createStatefulFakeCourseQuizServer(
  courseId: string,
  quizId: string,
  totalQuestions = 2,
): { client: FakeApiClient } {
  const attempts: FakeAttempt[] = [];

  function progressPath(): string {
    return `/api/v2/learners/courses/${courseId}/quizzes/progress`;
  }

  function trackPath(): string {
    return `/api/v2/learners/courses/${courseId}/quizzes/${quizId}/track`;
  }

  const client = createFakeApiClient(({ method, path, body }) => {
    if (method === 'GET' && path === progressPath()) {
      const attempt = attempts.at(-1);
      return {
        courseId,
        status: 'in_progress',
        progress: 0,
        quizzes: [
          {
            quizId,
            quiz: null,
            path: null,
            status: attempt?.completedAt
              ? attempt.passed
                ? 'completed'
                : 'failed'
              : attempts.length > 0
                ? 'in_progress'
                : 'not_started',
            startedAt: attempt?.startedAt ?? null,
            completedAt: attempt?.completedAt ?? null,
            lastAccessedAt: attempt?.startedAt ?? null,
            timeSpent: attempts.reduce((sum, entry) => sum + entry.timeSpent, 0),
            quizAttempts: attempts,
            totalAnsweredCorrect: attempt?.answers.filter((answer) => answer.isCorrect).length ?? 0,
            totalAnsweredQuestions: attempt?.answers.length ?? 0,
            totalQuestions,
          },
        ],
      };
    }

    if (method === 'POST' && path === trackPath()) {
      const { questionId, answerId, dateTimeStarted, dateTimeFinished } = body as {
        questionId: string;
        answerId: string | string[];
        dateTimeStarted: number;
        dateTimeFinished: number;
      };
      const selected = Array.isArray(answerId) ? answerId : [answerId];
      const isCorrect = questionId === 'q1' && selected.length === 1 && selected[0] === 'a';
      const timeSpent = Math.max(0, Math.floor((dateTimeFinished - dateTimeStarted) / 1000));

      let attempt = attempts.find((entry) => !entry.completedAt);
      if (!attempt) {
        attempt = {
          startedAt: new Date(dateTimeStarted).toISOString(),
          completedAt: null,
          score: 0,
          percentageScore: 0,
          totalPoints: totalQuestions,
          passed: null,
          timeSpent: 0,
          answers: [],
        };
        attempts.push(attempt);
      }

      const answerEntry: FakeAnswer = {
        questionId,
        title: questionId === 'q1' ? 'Q1' : 'Q2',
        answerType: 'single',
        isCorrect,
        points: 1,
        earnedPoints: isCorrect ? 1 : 0,
        correctAnswerIds: ['a'],
        correctAnswers: [{ title: 'A' }],
        selectedAnswers: selected.map((id) => ({ title: id === 'a' ? 'A' : 'B' })),
        selectedAnswerIds: selected,
        answeredAt: new Date(dateTimeFinished).toISOString(),
      };

      const existingIndex = attempt.answers.findIndex((answer) => answer.questionId === questionId);
      if (existingIndex >= 0) {
        attempt.answers[existingIndex] = answerEntry;
      } else {
        attempt.answers.push(answerEntry);
      }
      attempt.timeSpent += timeSpent;

      const correctCount = attempt.answers.filter((answer) => answer.isCorrect).length;
      attempt.score = correctCount;
      attempt.percentageScore = Math.round((correctCount / totalQuestions) * 100);

      const quizCompleted = attempt.answers.length >= totalQuestions;
      if (quizCompleted && !attempt.completedAt) {
        attempt.completedAt = new Date(dateTimeFinished).toISOString();
        attempt.passed = attempt.percentageScore >= 70;
      }

      return {
        questionId,
        questionTitle: answerEntry.title,
        answerType: answerEntry.answerType,
        selectedAnswerIds: selected,
        correctAnswerIds: answerEntry.correctAnswerIds,
        isCorrect,
        points: 1,
        earnedPoints: answerEntry.earnedPoints,
        timeSpent,
        quizCompleted,
        quizScore: quizCompleted ? (attempt.score ?? undefined) : undefined,
        quizPassed: quizCompleted ? (attempt.passed ?? undefined) : undefined,
        totalQuestions,
        answeredQuestions: attempt.answers.length,
        courseStatus: 'in_progress',
        courseProgress: 0,
      };
    }

    if (
      method === 'POST' &&
      path === `/api/v2/learners/courses/${courseId}/quizzes/${quizId}/retake`
    ) {
      const startedAt = new Date().toISOString();
      attempts.push({
        startedAt,
        completedAt: null,
        score: 0,
        percentageScore: 0,
        totalPoints: totalQuestions,
        passed: null,
        timeSpent: 0,
        answers: [],
      });
      return { courseId, quizId, attemptNumber: attempts.length, startedAt };
    }

    throw new Error(`stateful fake course quiz server: unexpected request ${method} ${path}`);
  });

  return { client };
}
