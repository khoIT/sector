/**
 * The runner's elapsed-time clock.
 *
 * The legacy timer read `Date.now() - startTime` on every tick from a
 * `startTime` that never changed, which sounds right — until the per-question
 * submit resent that SAME original `dateTimeStarted` alongside a fresh
 * `dateTimeFinished` on every question, so the SERVER's stored time-on-task
 * grew by the whole elapsed duration again each time (quadratic accumulation:
 * a real 10-minute attempt logged roughly 55). The fix is not a smarter clock
 * — `elapsedSeconds` below is exactly as naive as the legacy one — it is
 * sending the start timestamp to the server exactly ONCE, in `finish()`,
 * which is the adapter's job, not this function's.
 *
 * "Started once, never reset by answering": `startedAt` lives on the quiz
 * state and is set only by the `start` action (see state.ts); no answer
 * action ever touches it, which is what state.test.ts asserts directly.
 */
export function elapsedSeconds(startedAt: string | null, now: string): number {
  if (!startedAt) return 0;

  const started = Date.parse(startedAt);
  const current = Date.parse(now);
  if (Number.isNaN(started) || Number.isNaN(current)) return 0;

  return Math.max(0, Math.floor((current - started) / 1000));
}
