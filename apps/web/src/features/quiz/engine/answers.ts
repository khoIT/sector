import type { QuizAnswers, QuizQuestion } from './types';

/**
 * Answer-set operations, pure and framework-free. `single` replaces the
 * question's whole selection with one id; `multiple` toggles one id in or out
 * of the set. Both always store a `string[]` — the engine never has a
 * separate "one id" representation to keep in sync with the array one.
 */

export function selectSingleAnswer(
  answers: QuizAnswers,
  questionId: string,
  answerId: string,
): QuizAnswers {
  return { ...answers, [questionId]: [answerId] };
}

export function toggleMultipleAnswer(
  answers: QuizAnswers,
  questionId: string,
  answerId: string,
): QuizAnswers {
  const current = answers[questionId] ?? [];
  const next = current.includes(answerId)
    ? current.filter((id) => id !== answerId)
    : [...current, answerId];
  return { ...answers, [questionId]: next };
}

export function isQuestionAnswered(answers: QuizAnswers, questionId: string): boolean {
  return (answers[questionId]?.length ?? 0) > 0;
}

export function answeredCount(answers: QuizAnswers, questions: readonly QuizQuestion[]): number {
  return questions.filter((question) => isQuestionAnswered(answers, question.id)).length;
}

export function allQuestionsAnswered(
  answers: QuizAnswers,
  questions: readonly QuizQuestion[],
): boolean {
  return questions.length > 0 && answeredCount(answers, questions) === questions.length;
}
