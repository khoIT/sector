import { selectSingleAnswer, toggleMultipleAnswer } from './answers';
import { clampIndex } from './navigation';
import { canStartQuiz } from './refuse-empty-quiz';
import type { QuizAnswers, QuizQuestion, QuizResult } from './types';

/**
 * idle -> running -> finishing -> finished
 *                            \-> failed
 *      \-> failed (zero questions, refused before it ever starts)
 *
 * `failed` is reachable two ways, told apart by `failureKind`: a quiz that
 * was never startable at all (nothing to retry — go back), and a submit that
 * the server rejected or a network call that never landed (retryable —
 * `quiz/finish-start` can be dispatched again from here).
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
  | { type: 'quiz/start'; startedAt: string; answers?: QuizAnswers }
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
      return {
        ...state,
        phase: 'running',
        startedAt: action.startedAt,
        answers: action.answers ?? state.answers,
        currentIndex: 0,
        result: null,
        error: null,
        failureKind: null,
      };
    }

    case 'quiz/select-single': {
      if (state.phase !== 'running') return state;
      return { ...state, answers: selectSingleAnswer(state.answers, action.questionId, action.answerId) };
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

    case 'quiz/finish-start':
      return state.phase === 'running' ? { ...state, phase: 'finishing', error: null } : state;

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
