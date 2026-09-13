import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { selectSingleAnswer, toggleMultipleAnswer } from '@/features/quiz/engine/answers';
import { elapsedSeconds } from '@/features/quiz/engine/elapsed-time';
import { createIdleQuizState, quizReducer } from '@/features/quiz/engine/state';
import type { QuizAdapter, QuizAnswers, QuizQuestion } from '@/features/quiz/engine/types';

/**
 * The one place the pure engine (apps/web/src/features/quiz/engine) meets
 * React and a real adapter. Everything that decides WHAT happens lives in the
 * reducer; this hook only decides WHEN to call the adapter — on every answer
 * (autosave), once at start (resume-or-fresh) and once at the end (grade).
 *
 * `useReducer`'s init function runs exactly ONCE, on mount — so `questions`
 * must already be the real, loaded list the first time this hook is called.
 * Calling it above a loading guard (so the first render passes `[]`) leaves
 * the reducer permanently convinced the bank has no questions; the caller
 * (question-bank-detail-page.tsx) mounts a child component only once the
 * bank has loaded, and remounts it (via `key={bank.id}`) if the slug changes,
 * for exactly this reason.
 */
export function useQuizRunner(questions: readonly QuizQuestion[], adapter: QuizAdapter) {
  const [state, dispatch] = useReducer(quizReducer, questions, createIdleQuizState);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFinishingRef = useRef(false);

  // The reducer's answers, mirrored synchronously (not via an effect — an
  // effect runs after commit, which is exactly the window where two rapid
  // toggles would both still see the pre-update value). `selectSingle` and
  // `toggleMultiple` update this ref themselves, at the same moment they
  // compute the value they dispatch, so it is never behind React's own
  // render/commit timing.
  const answersRef = useRef<QuizAnswers>(state.answers);

  // A save queue per question id, so answering the same question twice in
  // quick succession cannot land out of order: without this, a fast second
  // save can reach the server before a slow first one, and the FIRST answer
  // becomes the one that sticks on resume even though it was superseded.
  // Serialising per question is also what keeps the server from opening two
  // attempts for one caller's very first save (qbank-progress.service.ts's
  // `startNewAttempt`/`saveQuestionProgress` read the existing progress
  // document and then push into it; two concurrent first calls both read
  // "no attempt yet" and both push a new one, orphaning whichever loses the
  // race) — do not "optimise" this back into firing saves in parallel.
  const saveChains = useRef<Map<string, Promise<void>>>(new Map());

  const queueSave = useCallback(
    (questionId: string, answers: string[]) => {
      const previous = saveChains.current.get(questionId) ?? Promise.resolve();
      const attempt = previous.then(
        () => adapter.saveAnswer(questionId, answers),
        () => adapter.saveAnswer(questionId, answers), // a prior failure must not block this one
      );
      saveChains.current.set(questionId, attempt);
      attempt
        .then(() => setSaveError(null))
        .catch((error: unknown) => {
          setSaveError(error instanceof Error ? error.message : 'Could not save your answer.');
        });
    },
    [adapter],
  );

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
    setResumeError(null);
    try {
      const progress = await adapter.loadProgress();
      answersRef.current = progress.answers;
      dispatch({
        type: 'quiz/start',
        startedAt: progress.startedAt ?? new Date().toISOString(),
        answers: progress.answers,
        resumeQuestionId: progress.resumeQuestionId,
      });
    } catch (error) {
      setResumeError(
        error instanceof Error ? error.message : 'Could not load your saved progress.',
      );
    } finally {
      setIsResuming(false);
    }
  }, [adapter]);

  /** Ignore any saved progress and begin a fresh attempt from question one. */
  const startNew = useCallback(() => {
    setResumeError(null);
    answersRef.current = {};
    dispatch({
      type: 'quiz/start',
      startedAt: new Date().toISOString(),
      answers: {},
      resumeQuestionId: null,
    });
  }, []);

  const selectSingle = useCallback(
    (questionId: string, answerId: string) => {
      if (state.phase !== 'running') return;
      const next = selectSingleAnswer(answersRef.current, questionId, answerId);
      answersRef.current = next;
      dispatch({ type: 'quiz/select-single', questionId, answerId });
      queueSave(questionId, next[questionId] ?? []);
    },
    [queueSave, state.phase],
  );

  const toggleMultiple = useCallback(
    (questionId: string, answerId: string) => {
      if (state.phase !== 'running') return;
      const next = toggleMultipleAnswer(answersRef.current, questionId, answerId);
      answersRef.current = next;
      dispatch({ type: 'quiz/toggle-multiple', questionId, answerId });
      queueSave(questionId, next[questionId] ?? []);
    },
    [queueSave, state.phase],
  );

  const next = useCallback(() => dispatch({ type: 'quiz/next' }), []);
  const previous = useCallback(() => dispatch({ type: 'quiz/previous' }), []);
  const goTo = useCallback((index: number) => dispatch({ type: 'quiz/go-to', index }), []);

  const restart = useCallback(() => {
    answersRef.current = {};
    saveChains.current.clear();
    setSaveError(null);
    setResumeError(null);
    dispatch({ type: 'quiz/restart' });
  }, []);

  const finish = useCallback(async () => {
    const canRetry = state.phase === 'failed' && state.failureKind === 'submit-error';
    // A render-time `disabled` prop cannot stop a second click that lands
    // before React re-renders; this ref is checked and set synchronously, so
    // it is what actually keeps a double submit from reaching the server and
    // inflating the attempt's totalAttempts/averageScore twice.
    if (isFinishingRef.current) return;
    if (state.phase !== 'running' && !canRetry) return;
    if (!state.startedAt) return;

    isFinishingRef.current = true;
    dispatch({ type: 'quiz/finish-start' });
    try {
      const result = await adapter.finish({
        answers: answersRef.current,
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
      });
      dispatch({ type: 'quiz/finish-success', result });
    } catch (error) {
      dispatch({
        type: 'quiz/finish-failure',
        error: error instanceof Error ? error.message : 'Could not submit your answers.',
      });
    } finally {
      isFinishingRef.current = false;
    }
  }, [adapter, state.failureKind, state.phase, state.startedAt]);

  return {
    state,
    elapsedSeconds: elapsed,
    isResuming,
    resumeError,
    saveError,
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
