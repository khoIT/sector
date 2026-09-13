/**
 * The zero-question guard. 143 published question banks (and 146 published
 * course quizzes, system-wide) hold no questions at all; the legacy client
 * let a learner press Start on one anyway and land on "Question data not
 * found" with no way to ever finish. This is the one predicate every reader
 * shares — the index card, the detail page's Start button, and the engine's
 * own `start` action all call this instead of re-deriving "empty" three ways.
 */
export function canStartQuiz(questionCount: number): boolean {
  return questionCount > 0;
}
