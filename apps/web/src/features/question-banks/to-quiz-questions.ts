import type { QuestionBankQuestion } from '@sector/api-client';

import type { QuizQuestion } from '@/features/quiz/engine/types';

/**
 * The wire shape (userAnswers/isAnswered inline per question, straight from
 * GET /:slug) into what the engine runs on. The engine gets the caller's real
 * saved answers from the adapter's `loadProgress()` instead of these two
 * fields — GET /progress/:quizId is the one response that also carries the
 * attempt's `startedAt`, which this per-question shape does not.
 */
export function toQuizQuestions(questions: readonly QuestionBankQuestion[]): QuizQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    title: question.title,
    content: question.content,
    answerType: question.answerType,
    answers: question.answers,
    correctMessage: question.correctMessage,
    incorrectMessage: question.incorrectMessage,
    points: question.points,
  }));
}
