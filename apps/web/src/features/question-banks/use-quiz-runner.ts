import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { toggleMultipleAnswer } from '@/features/quiz/engine/answers';
import { elapsedSeconds } from '@/features/quiz/engine/elapsed-time';
import { createIdleQuizState, quizReducer } from '@/features/quiz/engine/state';
import type { QuizAdapter, QuizQuestion } from '@/features/quiz/engine/types';

/**
 * The one place the pure engine (apps/web/src/features/quiz/engine) meets
 * React and a real adapter. Everything that decides WHAT happens lives in the
 * reducer; this hook only decides WHEN to call the adapter — on every answer
 * (autosave), once at start (resume-or-fresh) and once at the end (grade).
 */
export function useQuizRunner(questions: readonly QuizQuestion[], adapter: QuizAdapter) {
  const [state, dispatch] = useReducer(quizReducer, questions, createIdleQuizState);
  const [isResuming, setIsResuming] = useState(false);

  // A ticking display clock. `elapsedSeconds` reads state.startedAt, which
  // the reducer sets exactly once — this effect only re-renders the number,
  // it never feeds time back into the engine.
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    if (state.phase !== 'running') return;
    const id = window.setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  const elapsed = useMemo(() => elapsedSeconds(state.startedAt, now), [state.startedAt, now]);

  /** Resume the caller's last unfinished attempt, or start fresh if there is none. */
  const start = useCallback(async () => {
    setIsResuming(true);
    try {
      const progress = await adapter.loadProgress();
      dispatch({
        type: 'quiz/start',
        startedAt: progress.startedAt ?? new Date().toISOString(),
        answers: progress.answers,
      });
    } finally {
      setIsResuming(false);
    }
  }, [adapter]);

  /** Ignore any saved progress and begin a fresh attempt from question one. */
  const startNew = useCallback(() => {
    dispatch({ type: 'quiz/start', startedAt: new Date().toISOString(), answers: {} });
  }, []);

  const selectSingle = useCallback(
    (questionId: string, answerId: string) => {
      if (state.phase !== 'running') return;
      dispatch({ type: 'quiz/select-single', questionId, answerId });
      void adapter.saveAnswer(questionId, [answerId]);
    },
    [adapter, state.phase],
  );

  const toggleMultiple = useCallback(
    (questionId: string, answerId: string) => {
      if (state.phase !== 'running') return;
      const next = toggleMultipleAnswer(state.answers, questionId, answerId)[questionId] ?? [];
      dispatch({ type: 'quiz/toggle-multiple', questionId, answerId });
      void adapter.saveAnswer(questionId, next);
    },
    [adapter, state.answers, state.phase],
  );

  const next = useCallback(() => dispatch({ type: 'quiz/next' }), []);
  const previous = useCallback(() => dispatch({ type: 'quiz/previous' }), []);
  const goTo = useCallback((index: number) => dispatch({ type: 'quiz/go-to', index }), []);
  const restart = useCallback(() => dispatch({ type: 'quiz/restart' }), []);

  const finish = useCallback(async () => {
    if (state.phase !== 'running' || !state.startedAt) return;
    dispatch({ type: 'quiz/finish-start' });
    try {
      const result = await adapter.finish({
        answers: state.answers,
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
      });
      dispatch({ type: 'quiz/finish-success', result });
    } catch (error) {
      dispatch({
        type: 'quiz/finish-failure',
        error: error instanceof Error ? error.message : 'Could not submit your answers.',
      });
    }
  }, [adapter, state.answers, state.phase, state.startedAt]);

  return {
    state,
    elapsedSeconds: elapsed,
    isResuming,
    start,
    startNew,
    selectSingle,
    toggleMultiple,
    next,
    previous,
    goTo,
    finish,
    restart,
  };
}

export type QuizRunnerController = ReturnType<typeof useQuizRunner>;
