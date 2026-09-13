import {
  checkQuestionBankAnswers,
  getQuestionBankProgress,
  saveQuestionBankProgress,
  type ApiClient,
} from '@sector/api-client';

import type { QuizAdapter } from '../types';

/**
 * The question-bank adapter: autosave per question, one server-side grade at
 * the end. `loadProgress` reads GET /progress/:quizId rather than the
 * `userAnswers` already embedded on each question from the bank detail route,
 * because only the progress route also carries the attempt's `startedAt` —
 * without it, resuming would have no way to keep the "started once" clock
 * from Phase 5's engine honest.
 */
export function createBankAdapter(client: ApiClient, quizId: string): QuizAdapter {
  return {
    async loadProgress() {
      const { attemptInfo, progress } = await getQuestionBankProgress(client, quizId);
      if (!attemptInfo) return { answers: {}, startedAt: null };
      return { answers: progress ?? {}, startedAt: attemptInfo.startedAt };
    },

    async saveAnswer(questionId, answers) {
      await saveQuestionBankProgress(client, { quizId, questionId, selectedAnswers: answers });
    },

    async finish({ answers, startedAt, finishedAt }) {
      // Every selection is sent as an array regardless of answer type — the
      // server's own validation (question-bank.controller.ts
      // `checkQbankAnswers`) only ever rejects a `single`-type answer for
      // holding MORE than one id, never for arriving as a one-element array,
      // so this adapter never has to know a question's answerType to build
      // this payload.
      const submittedAnswers = Object.entries(answers).map(([questionId, selectedAnswers]) => ({
        questionId,
        answerId: selectedAnswers,
      }));

      // The client never computes a score: this call's response IS the
      // result the engine stores, unread and unmodified.
      return checkQuestionBankAnswers(client, {
        quizId,
        dateTimeStarted: Date.parse(startedAt),
        dateTimeFinished: Date.parse(finishedAt),
        submittedAnswers,
      });
    },
  };
}
