import { describe, expect, it } from 'vitest';

import { createIdleQuizState, quizReducer, type QuizState } from './state';
import type { QuizQuestion, QuizResult } from './types';

const question = (id: string): QuizQuestion => ({
  id,
  title: `Question ${id}`,
  content: '',
  answerType: 'single',
  answers: [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ],
  correctMessage: '',
  incorrectMessage: '',
  points: 1,
});

const TWO_QUESTIONS = [question('q1'), question('q2')];

function running(questions: readonly QuizQuestion[] = TWO_QUESTIONS): QuizState {
  return quizReducer(createIdleQuizState(questions), {
    type: 'quiz/start',
    startedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('idle -> running', () => {
  it('starts a quiz that has questions', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(state.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(state.currentIndex).toBe(0);
  });

  it('refuses a quiz with zero questions before it ever starts', () => {
    const state = quizReducer(createIdleQuizState([]), {
      type: 'quiz/start',
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(state.phase).toBe('failed');
    expect(state.failureKind).toBe('no-questions');
    expect(state.startedAt).toBeNull();
  });

  it('resumes with previously loaded answers rather than starting blank', () => {
    const state = quizReducer(createIdleQuizState(TWO_QUESTIONS), {
      type: 'quiz/start',
      startedAt: '2026-01-01T00:00:00.000Z',
      answers: { q1: ['a'] },
    });
    expect(state.answers).toEqual({ q1: ['a'] });
  });

  it("positions currentIndex at the adapter's resume pointer, resolved by question id", () => {
    const state = quizReducer(createIdleQuizState(TWO_QUESTIONS), {
      type: 'quiz/start',
      startedAt: '2026-01-01T00:00:00.000Z',
      answers: { q1: ['a'] },
      resumeQuestionId: 'q2',
    });
    expect(state.currentIndex).toBe(1);
  });

  it('falls back to the first question when there is no pointer or it does not resolve', () => {
    expect(
      quizReducer(createIdleQuizState(TWO_QUESTIONS), {
        type: 'quiz/start',
        startedAt: '2026-01-01T00:00:00.000Z',
        resumeQuestionId: null,
      }).currentIndex,
    ).toBe(0);

    expect(
      quizReducer(createIdleQuizState(TWO_QUESTIONS), {
        type: 'quiz/start',
        startedAt: '2026-01-01T00:00:00.000Z',
        resumeQuestionId: 'not-a-real-question-id',
      }).currentIndex,
    ).toBe(0);
  });
});

describe('regression: the question list a hook was first mounted with must never be reused once loaded', () => {
  // The bug this guards: `useQuizRunner` used to call `useReducer(reducer,
  // questions, createIdleQuizState)` in a component rendered BEFORE its data
  // had arrived, so `createIdleQuizState` ran once with `questions === []`
  // and `quiz/start` refused every quiz forever — a warm query cache masked
  // it on a second visit, but a first visit, a hard reload or a typed URL hit
  // it every time. The fix is structural (mount the runner only once the
  // real question list is known — see question-bank-detail-page.tsx), not
  // something the reducer can defend itself against; this test documents the
  // invariant the fix depends on: state built from an empty list and state
  // built from the real one are two independent values, not one state that
  // "fills in" later.
  it('a state built from [] stays refused even after the real list exists elsewhere', () => {
    const staleState = createIdleQuizState([]);
    const startedStale = quizReducer(staleState, {
      type: 'quiz/start',
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(startedStale.phase).toBe('failed');
    expect(startedStale.failureKind).toBe('no-questions');

    // The real list, known by the time the caller actually has data, has to
    // come from a FRESH createIdleQuizState call — nothing rehydrates the
    // stale one in place.
    const freshState = createIdleQuizState(TWO_QUESTIONS);
    const startedFresh = quizReducer(freshState, {
      type: 'quiz/start',
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(startedFresh.phase).toBe('running');
    expect(startedFresh.questions).toBe(TWO_QUESTIONS);

    // The two are independent: starting the fresh one never touched the
    // stale one, which is still refused.
    expect(staleState.phase).toBe('idle');
  });
});

describe('the clock: started once, never reset by answering', () => {
  it('select, toggle, next and previous never change startedAt', () => {
    let state = running();
    const startedAt = state.startedAt;

    state = quizReducer(state, { type: 'quiz/select-single', questionId: 'q1', answerId: 'a' });
    expect(state.startedAt).toBe(startedAt);

    state = quizReducer(state, { type: 'quiz/next' });
    expect(state.startedAt).toBe(startedAt);

    state = quizReducer(state, {
      type: 'quiz/toggle-multiple',
      questionId: 'q2',
      answerId: 'b',
    });
    expect(state.startedAt).toBe(startedAt);

    state = quizReducer(state, { type: 'quiz/previous' });
    expect(state.startedAt).toBe(startedAt);
  });
});

describe('answering while running', () => {
  it('single-select replaces the selection for that question', () => {
    let state = running();
    state = quizReducer(state, { type: 'quiz/select-single', questionId: 'q1', answerId: 'a' });
    state = quizReducer(state, { type: 'quiz/select-single', questionId: 'q1', answerId: 'b' });
    expect(state.answers.q1).toEqual(['b']);
  });

  it('multiple-select toggles independently of other questions', () => {
    let state = running();
    state = quizReducer(state, { type: 'quiz/toggle-multiple', questionId: 'q2', answerId: 'a' });
    state = quizReducer(state, { type: 'quiz/toggle-multiple', questionId: 'q2', answerId: 'b' });
    expect(state.answers.q2).toEqual(['a', 'b']);
  });

  it('ignores answer actions outside the running phase', () => {
    const idle = createIdleQuizState(TWO_QUESTIONS);
    const state = quizReducer(idle, {
      type: 'quiz/select-single',
      questionId: 'q1',
      answerId: 'a',
    });
    expect(state.answers).toEqual({});
  });
});

describe('navigation', () => {
  it('moves next and previous, clamped to the question list', () => {
    let state = running();
    state = quizReducer(state, { type: 'quiz/next' });
    expect(state.currentIndex).toBe(1);
    state = quizReducer(state, { type: 'quiz/next' });
    expect(state.currentIndex).toBe(1); // clamped: only two questions

    state = quizReducer(state, { type: 'quiz/previous' });
    state = quizReducer(state, { type: 'quiz/previous' });
    expect(state.currentIndex).toBe(0);
  });

  it('jumps directly to an index (the "jump" navigation capability)', () => {
    const state = quizReducer(running(), { type: 'quiz/go-to', index: 1 });
    expect(state.currentIndex).toBe(1);
  });
});

describe('finishing', () => {
  const RESULT: QuizResult = {
    score: 1,
    totalScore: 2,
    percentageScore: 50,
    passed: false,
    timeSpent: 42,
    questions: [],
  };

  it('moves to finishing, then finished, storing the result exactly as given', () => {
    let state = running();
    state = quizReducer(state, { type: 'quiz/finish-start' });
    expect(state.phase).toBe('finishing');

    state = quizReducer(state, { type: 'quiz/finish-success', result: RESULT });
    expect(state.phase).toBe('finished');
    // The reducer never recomputes anything — it stores what it was handed.
    expect(state.result).toBe(RESULT);
  });

  it('moves to failed with a retryable reason on a submit error', () => {
    let state = running();
    state = quizReducer(state, { type: 'quiz/finish-start' });
    state = quizReducer(state, { type: 'quiz/finish-failure', error: 'network error' });
    expect(state.phase).toBe('failed');
    expect(state.failureKind).toBe('submit-error');
    expect(state.error).toBe('network error');
  });

  it('the Retry button works: finish-start is accepted again from failed/submit-error', () => {
    let state = running();
    state = quizReducer(state, { type: 'quiz/finish-start' });
    state = quizReducer(state, { type: 'quiz/finish-failure', error: 'network error' });
    expect(state.phase).toBe('failed');

    state = quizReducer(state, { type: 'quiz/finish-start' });
    expect(state.phase).toBe('finishing');

    state = quizReducer(state, { type: 'quiz/finish-success', result: RESULT });
    expect(state.phase).toBe('finished');
  });

  it('does not accept finish-start from a no-questions failure — there is nothing to retry', () => {
    const refused = quizReducer(createIdleQuizState([]), {
      type: 'quiz/start',
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    const state = quizReducer(refused, { type: 'quiz/finish-start' });
    expect(state.phase).toBe('failed');
    expect(state.failureKind).toBe('no-questions');
  });

  it('restart returns to a fresh idle state with the same questions', () => {
    let state = running();
    state = quizReducer(state, { type: 'quiz/finish-start' });
    state = quizReducer(state, { type: 'quiz/finish-success', result: RESULT });
    state = quizReducer(state, { type: 'quiz/restart' });
    expect(state.phase).toBe('idle');
    expect(state.result).toBeNull();
    expect(state.answers).toEqual({});
    expect(state.questions).toBe(TWO_QUESTIONS);
  });
});
