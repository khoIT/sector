import { selectSingleAnswer, toggleMultipleAnswer } from './answers';
import { clampIndex } from './navigation';
import { canStartQuiz } from './refuse-empty-quiz';
import type { QuizAnswers, QuizQuestion, QuizResult } from './types';

/**
 * idle -> running -> finishing -> finished
 *                            \-> failed (submit-error) -> finishing (retry)
 *      \-> failed (no-questions, refused before it ever starts)
 *
 * `failed` is reachable two ways, told apart by `failureKind`: a quiz that
 * was never startable at all (nothing to retry — go back), and a submit that
 * the server rejected or a network call that never landed. The second is
 * retryable: `quiz/finish-start` is accepted from `running` (the first
 * attempt) AND from `failed`/`submit-error` (every attempt after), which is
 * what actually makes the Retry button on that screen do something.
 */
export type QuizPhase = 'idle' | 'running' | 'finishing' | 'finished' | 'failed';
export type QuizFailureKind = 'no-questions' | 'submit-error';

export type QuizState = {
  phase: QuizPhase;
  questions: readonly QuizQuestion[];
  currentIndex: number;
  answers: QuizAnswers;
  /** Set exactly once, by `quiz/start`. No other action ever touches it —
   *  this is the fix for the legacy timer that froze after the first answer
   *  and the quadratic time-on-task bug both: the clock has one source. */
  startedAt: string | null;
  result: QuizResult | null;
  failureKind: QuizFailureKind | null;
  error: string | null;
};

export function createIdleQuizState(questions: readonly QuizQuestion[]): QuizState {
  return {
    phase: 'idle',
    questions,
    currentIndex: 0,
    answers: {},
    startedAt: null,
    result: null,
    failureKind: null,
    error: null,
  };
}

export type QuizAction =
  | {
      type: 'quiz/start';
      startedAt: string;
      answers?: QuizAnswers;
      /** A question id to seed `currentIndex` from, resolved against
       *  `state.questions` — see `QuizAdapter.loadProgress`'s doc comment. */
      resumeQuestionId?: string | null;
    }
  | { type: 'quiz/select-single'; questionId: string; answerId: string }
  | { type: 'quiz/toggle-multiple'; questionId: string; answerId: string }
  | { type: 'quiz/go-to'; index: number }
  | { type: 'quiz/next' }
  | { type: 'quiz/previous' }
  | { type: 'quiz/finish-start' }
  | { type: 'quiz/finish-success'; result: QuizResult }
  | { type: 'quiz/finish-failure'; error: string }
  | { type: 'quiz/restart' };

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'quiz/start': {
      if (!canStartQuiz(state.questions.length)) {
        return {
          ...state,
          phase: 'failed',
          failureKind: 'no-questions',
          error: 'This question bank has no questions yet.',
        };
      }
      // Resolve the adapter's question-id pointer against OUR ordered list,
      // so the adapter never has to know that ordering. Not found (a stale
      // pointer to a question that no longer exists in this bank) falls back
      // to the first question exactly like "no pointer at all" does.
      const resumeIndex = action.resumeQuestionId
        ? state.questions.findIndex((question) => question.id === action.resumeQuestionId)
        : -1;
      return {
        ...state,
        phase: 'running',
        startedAt: action.startedAt,
        answers: action.answers ?? state.answers,
        currentIndex: resumeIndex >= 0 ? resumeIndex : 0,
        result: null,
        error: null,
        failureKind: null,
      };
    }

    case 'quiz/select-single': {
      if (state.phase !== 'running') return state;
      return {
        ...state,
        answers: selectSingleAnswer(state.answers, action.questionId, action.answerId),
      };
    }

    case 'quiz/toggle-multiple': {
      if (state.phase !== 'running') return state;
      return {
        ...state,
        answers: toggleMultipleAnswer(state.answers, action.questionId, action.answerId),
      };
    }

    case 'quiz/go-to': {
      if (state.phase !== 'running') return state;
      return { ...state, currentIndex: clampIndex(action.index, state.questions.length) };
    }

    case 'quiz/next': {
      if (state.phase !== 'running') return state;
      return { ...state, currentIndex: clampIndex(state.currentIndex + 1, state.questions.length) };
    }

    case 'quiz/previous': {
      if (state.phase !== 'running') return state;
      return { ...state, currentIndex: clampIndex(state.currentIndex - 1, state.questions.length) };
    }

    case 'quiz/finish-start': {
      const canRetry = state.phase === 'failed' && state.failureKind === 'submit-error';
      if (state.phase !== 'running' && !canRetry) return state;
      return { ...state, phase: 'finishing', error: null, failureKind: null };
    }

    case 'quiz/finish-success':
      return { ...state, phase: 'finished', result: action.result, error: null, failureKind: null };

    case 'quiz/finish-failure':
      return { ...state, phase: 'failed', failureKind: 'submit-error', error: action.error };

    case 'quiz/restart':
      return createIdleQuizState(state.questions);

    default:
      return state;
  }
}
