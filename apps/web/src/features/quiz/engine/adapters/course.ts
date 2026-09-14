import {
  getCourseQuizProgress,
  trackCourseQuizProgress,
  type ApiClient,
  type QuizAttempt,
} from '@sector/api-client';

import type { AnswerType, QuizAdapter, QuizResultQuestion } from '../types';

/**
 * The course-quiz adapter: per-question submit, graded immediately by the
 * server on every call — unlike the question-bank adapter (`bank.ts`), which
 * autosaves silently and grades once at the end. There is no server route
 * that "grades the whole attempt" for a course quiz; `POST .../track` both
 * saves AND grades one question per call, so `finish()`'s job here is not to
 * submit an ungraded attempt, it is to make sure every LOCAL answer has
 * actually reached the server (some may not have, if the learner clicked
 * Finish before an in-flight autosave settled — `useQuizRunner` does not
 * await outstanding per-question saves before calling `adapter.finish()`)
 * and then read back the graded attempt for its full per-question titles,
 * which the per-call response does not carry (see
 * `trackCourseQuizProgressResultSchema`'s doc comment).
 *
 * `finish()` deliberately does NOT resubmit every answer unconditionally:
 * each `POST .../track` call ADDS its computed `timeSpent` to the attempt's
 * running total (`learners.quiz.track.ts#trackQuizAnswer`), so resubmitting
 * an already-recorded answer would double-count time already spent. Only
 * answers missing from the last read-back attempt are (re)submitted.
 */
export function createCourseQuizAdapter(
  client: ApiClient,
  courseId: string,
  quizId: string,
): QuizAdapter {
  async function currentAttempt(): Promise<QuizAttempt | undefined> {
    const progress = await getCourseQuizProgress(client, courseId);
    const entry = progress.quizzes.find((quiz) => quiz.quizId === quizId);
    return entry?.quizAttempts.at(-1);
  }

  return {
    async loadProgress() {
      const attempt = await currentAttempt();
      // No attempt yet, or the last one already finished: nothing to
      // resume — a finished attempt is reopened by an explicit retake
      // (`retakeCourseQuiz`), not by resuming into it.
      if (!attempt || attempt.completedAt) {
        return { answers: {}, startedAt: null, resumeQuestionId: null };
      }

      const answers: Record<string, string[]> = {};
      for (const answer of attempt.answers) {
        answers[answer.questionId] = answer.selectedAnswerIds;
      }

      return {
        answers,
        startedAt: attempt.startedAt,
        // The last entry in `answers[]` is the last question this caller
        // answered — the array is appended to in submission order, the
        // same "insertion order is the resume pointer" reasoning `bank.ts`
        // uses for its own progress object.
        resumeQuestionId: attempt.answers.at(-1)?.questionId ?? null,
      };
    },

    async saveAnswer(questionId, answers) {
      // Autosave. No `startedAt` is available here (the adapter contract
      // only threads it through `finish()`), so both timestamps are "now" —
      // a zero-length interval contributes no time, which is correct: this
      // call's only job is to make sure the answer is not lost, not to
      // account for time spent. `finish()` is what carries the real
      // start/finish pair, for whichever answer turns out to still be
      // missing when the attempt ends.
      const now = Date.now();
      await trackCourseQuizProgress(client, courseId, quizId, {
        questionId,
        answerId: answers,
        dateTimeStarted: now,
        dateTimeFinished: now,
      });
    },

    async finish({ answers, startedAt, finishedAt }) {
      let attempt = await currentAttempt();
      const recordedIds = new Set((attempt?.answers ?? []).map((answer) => answer.questionId));
      const missing = Object.entries(answers).filter(
        ([questionId]) => !recordedIds.has(questionId),
      );

      for (const [questionId, selected] of missing) {
        await trackCourseQuizProgress(client, courseId, quizId, {
          questionId,
          answerId: selected,
          dateTimeStarted: Date.parse(startedAt),
          dateTimeFinished: Date.parse(finishedAt),
        });
      }

      // Re-read only if something changed; the common case (every answer's
      // autosave already landed) costs no extra request.
      if (missing.length > 0) {
        attempt = await currentAttempt();
      }

      if (!attempt) {
        throw new Error('No answers were submitted for this quiz.');
      }

      return {
        score: attempt.score ?? 0,
        totalScore: attempt.totalPoints ?? attempt.answers.length,
        percentageScore: attempt.percentageScore ?? 0,
        passed: attempt.passed ?? false,
        timeSpent: attempt.timeSpent,
        questions: attempt.answers.map((answer): QuizResultQuestion => ({
          questionId: answer.questionId,
          title: answer.title,
          answerType: toEngineAnswerType(answer.answerType),
          isCorrect: answer.isCorrect,
          correctAnswers: answer.correctAnswers.map((option) => ({ title: option.title })),
          selectedAnswers: answer.selectedAnswers.map((option) => ({ title: option.title })),
        })),
      };
    },
  };
}

/**
 * A course quiz's `answerType` is a bare string on the wire (see
 * `quizAttemptAnswerSchema`'s doc comment): production holds one
 * `sort_answer` question (course `681a4f624bc509ae57597c83`, "US Guided LP
 * Scanning Technique Quiz"), which the server itself always grades
 * `isCorrect: false` regardless of what is submitted. The engine has no
 * third rendering mode for it, so it renders as a single-choice question —
 * the learner can select one option, and the result review still shows the
 * server's real (always-incorrect) grade, which is server truth, not a
 * client bug.
 */
export function toEngineAnswerType(value: string): AnswerType {
  return value === 'multiple' ? 'multiple' : 'single';
}
