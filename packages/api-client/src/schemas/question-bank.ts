import { z } from 'zod';

/**
 * Question banks: `/api/v2/question-banks*`, a Mongoose `V2Quiz` document with
 * `isQbank: true` and its populated `V2Question` children.
 *
 * Only two answer types are modelled — `single` and `multiple` — because
 * those are the only two the engine builds (see the quiz engine's README-level
 * comment for the production split: 95.1% single, 4.8% multiple, one stray
 * `sort_answer` question system-wide that the server itself hard-codes to
 * `isCorrect = false`). Every published question-bank question in the mirror
 * (781 of 809 references; 28 are dangling, see the fidelity manifest) is one
 * of these two, which `pnpm fidelity` proves; a bank that ever grows a
 * question of another type fails that replay loudly rather than silently
 * rendering an unscorable question.
 */
export const questionBankAnswerTypeSchema = z.enum(['single', 'multiple']);
export type QuestionBankAnswerType = z.infer<typeof questionBankAnswerTypeSchema>;

/** The list route's summary shape: GET /api/v2/question-banks. */
export const questionBankSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  // The controller presigns this into an https URL per request; a static
  // replay of the mirror can never reproduce that call, so it is null there.
  // A live app talking to a live API sees a real URL here.
  photoIcon: z.string().nullable(),
  // `.populate({ path: 'questions', select: 'id title slug' })` — Mongoose
  // drops any reference that does not resolve, so this can be shorter than
  // however many ids the underlying document actually holds.
  questions: z.array(z.object({ id: z.string(), title: z.string(), slug: z.string() })),
  isQbank: z.boolean(),
});
export type QuestionBankSummary = z.infer<typeof questionBankSummarySchema>;

/** One selectable option on a question, before it has been answered. */
export const questionBankAnswerOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  mediaUrl: z.string().nullable().optional(),
  allowHtml: z.boolean().optional().default(false),
});
export type QuestionBankAnswerOption = z.infer<typeof questionBankAnswerOptionSchema>;

/**
 * A question as the detail route shapes it — deliberately WITHOUT
 * `answers[].correct`: the controller strips it (question-bank.controller.ts
 * `getQbankBySlug`), so a learner cannot inspect the answer key before
 * finishing. Correctness only ever arrives via the check-answers result.
 */
export const questionBankQuestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string().optional().default(''),
  answerType: questionBankAnswerTypeSchema,
  answers: z.array(questionBankAnswerOptionSchema),
  correctMessage: z.string().optional().default(''),
  incorrectMessage: z.string().optional().default(''),
  sort: z.number(),
  points: z.number(),
  // Whatever the caller previously saved for this question, if anything.
  userAnswers: z.array(z.string()),
  isAnswered: z.boolean(),
});
export type QuestionBankQuestion = z.infer<typeof questionBankQuestionSchema>;

/** The in-progress branch of the progress union — an attempt under way. */
export const questionBankAttemptInfoSchema = z.object({
  attemptId: z.string(),
  startedAt: z.string(),
  totalQuestions: z.number(),
  answeredQuestions: z.number(),
  progressPercentage: z.number(),
});
export type QuestionBankAttemptInfo = z.infer<typeof questionBankAttemptInfoSchema>;

/** The no-attempt branch: nothing to resume, only a fresh start. */
export const questionBankRestartInfoSchema = z.object({
  canRestart: z.literal(true),
  message: z.string(),
});
export type QuestionBankRestartInfo = z.infer<typeof questionBankRestartInfoSchema>;

/**
 * `getQbankBySlug` sends the attempt-info shape when a signed-in caller has
 * an unfinished attempt, and the canRestart shape otherwise. Both branches
 * key off `qbankProgressService.getCurrentAttemptInfo`, which returns null the
 * moment the caller's most recent attempt is completed — so "just finished" and
 * "never started" render identically here, and the client is right to treat
 * them the same way: nothing to resume, only a fresh start.
 */
export const questionBankDetailProgressSchema = z.union([
  questionBankAttemptInfoSchema,
  questionBankRestartInfoSchema,
]);
export type QuestionBankDetailProgress = z.infer<typeof questionBankDetailProgressSchema>;

/** GET /api/v2/question-banks/:slug. */
export const questionBankDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string().optional().default(''),
  photoIcon: z.string().nullable(),
  questions: z.array(questionBankQuestionSchema),
  // Absent only for a caller with no session, which the app never is —
  // `authUser` middleware guards every question-bank route.
  progress: questionBankDetailProgressSchema.optional(),
});
export type QuestionBankDetail = z.infer<typeof questionBankDetailSchema>;

/** GET /api/v2/question-banks/progress/:quizId. */
export const questionBankProgressResultSchema = z.object({
  progress: z.record(z.string(), z.array(z.string())).nullable(),
  attemptInfo: questionBankAttemptInfoSchema.nullable(),
});
export type QuestionBankProgressResult = z.infer<typeof questionBankProgressResultSchema>;

/** POST /api/v2/question-banks/save-progress request body. */
export const saveQuestionBankProgressPayloadSchema = z.object({
  quizId: z.string(),
  questionId: z.string(),
  selectedAnswers: z.array(z.string()),
});
export type SaveQuestionBankProgressPayload = z.infer<typeof saveQuestionBankProgressPayloadSchema>;

export const saveQuestionBankProgressResultSchema = z.object({
  questionId: z.string(),
  selectedAnswers: z.array(z.string()),
  saved: z.boolean(),
});
export type SaveQuestionBankProgressResult = z.infer<typeof saveQuestionBankProgressResultSchema>;

/**
 * POST /api/v2/question-banks/check-answers request body.
 *
 * `answerId` always carries the FULL selection as an array here — the server
 * (question-bank.controller.ts `checkQbankAnswers`) normalises a bare string
 * to a one-element array before validating it, and its validation only ever
 * rejects a `single`-type answer for having MORE than one id, never for
 * arriving as a one-element array. Sending an array uniformly for both answer
 * types means this client never has to know a question's answerType at the
 * point it builds this payload.
 */
export const checkQuestionBankAnswersPayloadSchema = z.object({
  quizId: z.string(),
  dateTimeStarted: z.number(),
  dateTimeFinished: z.number(),
  submittedAnswers: z.array(
    z.object({
      questionId: z.string(),
      answerId: z.union([z.string(), z.array(z.string())]),
    }),
  ),
});
export type CheckQuestionBankAnswersPayload = z.infer<typeof checkQuestionBankAnswersPayloadSchema>;

/** An answer echoed back inside a graded question — same shape as an option,
 *  minus `id` being guaranteed (the server always sends it in practice, kept
 *  optional here only because it is not one of the fields it validates). */
export const questionBankAnswerRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  mediaUrl: z.string().nullable().optional(),
  allowHtml: z.boolean().optional().default(false),
});
export type QuestionBankAnswerRef = z.infer<typeof questionBankAnswerRefSchema>;

/** One graded question inside a check-answers result. */
export const questionBankResultQuestionSchema = z.object({
  questionId: z.string(),
  title: z.string(),
  answerType: questionBankAnswerTypeSchema,
  isCorrect: z.boolean(),
  points: z.number(),
  score: z.number(),
  correctAnswers: z.array(questionBankAnswerRefSchema),
  selectedAnswers: z.array(questionBankAnswerRefSchema),
  selectedAnswerIds: z.array(z.string()),
});
export type QuestionBankResultQuestion = z.infer<typeof questionBankResultQuestionSchema>;

/**
 * POST /api/v2/question-banks/check-answers response — the ONLY place a score
 * exists. `score`/`totalScore`/`percentageScore`/`passed` are the server's
 * correct-÷-total arithmetic (70% to pass); nothing on the client recomputes
 * any of them.
 */
export const checkQuestionBankAnswersResultSchema = z.object({
  attemptId: z.string(),
  quizId: z.string(),
  slug: z.string(),
  title: z.string(),
  score: z.number(),
  totalScore: z.number(),
  percentageScore: z.number(),
  passed: z.boolean(),
  timeSpent: z.number(),
  startedAt: z.string(),
  completedAt: z.string(),
  questions: z.array(questionBankResultQuestionSchema),
  totalAttempts: z.number(),
  bestScore: z.number(),
  averageScore: z.number(),
});
export type QuestionBankResult = z.infer<typeof checkQuestionBankAnswersResultSchema>;
