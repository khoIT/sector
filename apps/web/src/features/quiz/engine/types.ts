/**
 * The ONE quiz engine's shared vocabulary. No React here, deliberately — this
 * whole `engine/` folder is a reducer and a handful of pure functions, all
 * covered by `.test.ts` files with no DOM. `apps/web/src/features/question-banks`
 * is where a React hook wires this to a real adapter and a running UI.
 *
 * Only two answer types exist here — `single` and `multiple` — because those
 * are the only two production ever asks for: 2,227 single-choice questions,
 * 113 multiple-choice, one `sort_answer` (which the server itself hard-codes
 * to `isCorrect = false`), and zero of the three types nobody ever authored.
 */
export type AnswerType = 'single' | 'multiple';

export type QuizAnswerOption = {
  id: string;
  title: string;
  mediaUrl?: string | null;
  allowHtml?: boolean;
};

/**
 * A question as the running engine needs it — deliberately without a
 * "correct" flag on any option. The server never sends one before an attempt
 * finishes, and the engine has no business inventing what the server would
 * not tell a learner mid-attempt.
 */
export type QuizQuestion = {
  id: string;
  title: string;
  content: string;
  answerType: AnswerType;
  answers: readonly QuizAnswerOption[];
  correctMessage: string;
  incorrectMessage: string;
  points: number;
};

/** An answer as it appears in a finished result's review — just enough to
 *  label it, never the full option shape an in-progress question carries. */
export type QuizResultAnswer = {
  title: string;
};

/** One graded question inside a `QuizResult`. */
export type QuizResultQuestion = {
  questionId: string;
  title: string;
  answerType: AnswerType;
  isCorrect: boolean;
  correctAnswers: readonly QuizResultAnswer[];
  selectedAnswers: readonly QuizResultAnswer[];
};

/**
 * Exactly what the results screen renders — score, pass/fail, time, and the
 * per-question review — and nothing an adapter's own backend happens to send
 * alongside it. The question-bank check-answers response also carries
 * `attemptId`, `slug`, `totalAttempts`, `bestScore` and `averageScore`; none
 * of that is part of the contract, so a course adapter's own finalize
 * response does not have to fabricate them to satisfy this type. A concrete
 * adapter is free to return a richer object — `QuizResult` only names the
 * subset every adapter must provide and every caller may rely on.
 */
export type QuizResult = {
  score: number;
  totalScore: number;
  percentageScore: number;
  passed: boolean;
  timeSpent: number;
  questions: readonly QuizResultQuestion[];
};

/** Every selection so far, keyed by question id. Single-answer questions
 *  always hold a one-element array; the engine never special-cases the
 *  answer type when reading or writing this map. */
export type QuizAnswers = Record<string, string[]>;

/**
 * The three-method seam between the engine and a real backend. `finish()` is
 * the ONLY place a score can come from — the client never computes one, so an
 * adapter that summed points locally would be a bug in the adapter, not a
 * feature of the engine.
 */
export type QuizAdapter = {
  /** What the caller already has saved for this quiz, if anything. A null
   *  `startedAt` means "no attempt to resume — start fresh". */
  loadProgress: () => Promise<{
    answers: QuizAnswers;
    startedAt: string | null;
    /**
     * Where to resume, named by question id rather than by array position —
     * the adapter does not know (and must not need to know) the engine's
     * ordered question list, only which question a saved answer belongs to.
     * The engine resolves this id against its own `questions` array; null
     * means there is nothing to resume (no saved answers) or the adapter has
     * no pointer of its own to offer.
     */
    resumeQuestionId: string | null;
  }>;
  /** Autosave for one question. Called on every selection. */
  saveAnswer: (questionId: string, answers: string[]) => Promise<void>;
  /** Grades the whole attempt, once. */
  finish: (input: {
    answers: QuizAnswers;
    startedAt: string;
    finishedAt: string;
  }) => Promise<QuizResult>;
};
