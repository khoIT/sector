import type { CourseQuizQuestion } from '@sector/api-client';

import { toEngineAnswerType } from '@/features/quiz/engine/adapters/course';
import type { QuizQuestion } from '@/features/quiz/engine/types';

/** `GET /api/lms/quizzes/:quizId`'s questions into what the engine runs on —
 *  the course-quiz equivalent of `question-banks/to-quiz-questions.ts`. */
export function toCourseQuizQuestions(questions: readonly CourseQuizQuestion[]): QuizQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    title: question.title,
    content: question.content ?? '',
    answerType: toEngineAnswerType(question.answerType),
    answers: question.answers,
    correctMessage: question.correctMessage ?? '',
    incorrectMessage: question.incorrectMessage ?? '',
    points: question.points ?? 1,
  }));
}
