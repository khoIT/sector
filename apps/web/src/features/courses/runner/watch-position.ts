/**
 * When to write the learner's playhead back, and what number to send.
 *
 * Pure and separate from the player so the throttle is testable without a
 * Vimeo iframe. The hook owns the events; this owns the arithmetic.
 *
 * The client reports seconds observed and nothing else — no duration, no
 * "completed" claim. The server holds the runtime and decides completion from
 * the mark it wrote itself; a browser that could assert either would hand back
 * the trust boundary that rule exists to hold.
 */

/** Ordinary cadence during playback. */
export const POSITION_WRITE_INTERVAL_MS = 12_000;

/**
 * A jump larger than this is a seek, not playback, and is worth a write
 * immediately: it is the difference between resuming where the learner left
 * off and resuming up to twelve seconds behind it.
 */
/**
 * The share of a video that marks its topic complete.
 *
 * The rule is the SERVER's — it decides completion from the high-water mark it
 * stores, and the browser only reports where the playhead is. This constant
 * exists so the contents pane can tell a learner what the rule is; it must
 * never be used to decide completion on the client, which is exactly the claim
 * the old `videoCompleted: true` report made and the reason it was removed.
 */
export const WATCH_COMPLETION_PERCENT = 80;

export const POSITION_SEEK_THRESHOLD_SECONDS = 15;

/**
 * How long to hold off after a `/track` call. That route opens a transaction
 * and retries a write conflict three times before throwing, so a position
 * write landing in the middle of one is the cheapest thing to move.
 */
export const TRACK_SUPPRESSION_MS = 2_000;

export type WatchWriteState = {
  /** When the last accepted write went out. Null before the first one. */
  lastWrittenAtMs: number | null;
  /** The seconds that write carried. Null before the first one. */
  lastWrittenSeconds: number | null;
  /**
   * Set when a write failed. The next tick writes regardless of cadence,
   * because the failed one may have been the write that crossed the
   * threshold and completed the topic.
   */
  retryArmed: boolean;
  /** Writes are held until this timestamp; see `TRACK_SUPPRESSION_MS`. */
  suppressedUntilMs: number | null;
};

export const initialWatchWriteState: WatchWriteState = {
  lastWrittenAtMs: null,
  lastWrittenSeconds: null,
  retryArmed: false,
  suppressedUntilMs: null,
};

/**
 * Whole, non-negative seconds.
 *
 * The server clamps and floors again — this is not the trust boundary — but
 * sending a float that a player reported as `12.999999` and having the server
 * store `12` would make the two disagree for no reason.
 */
export function clampPosition(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.floor(seconds));
}

export type ShouldWriteInput = {
  positionSeconds: number;
  nowMs: number;
  /** True for `pause`, `ended` and page-hide: write whatever we have. */
  force?: boolean;
};

/**
 * Whether this tick earns a write.
 *
 * A forced write still respects nothing but suppression — a pause or a closing
 * tab is the last chance to record where the learner got to.
 */
export function shouldWritePosition(
  state: WatchWriteState,
  { positionSeconds, nowMs, force = false }: ShouldWriteInput,
): boolean {
  if (state.suppressedUntilMs !== null && nowMs < state.suppressedUntilMs) return false;

  const clamped = clampPosition(positionSeconds);

  // Nothing to say: the playhead has not moved since the last accepted write.
  if (state.lastWrittenSeconds === clamped && !state.retryArmed) return false;

  if (force) return true;
  if (state.retryArmed) return true;
  if (state.lastWrittenAtMs === null) return true;

  const movedBy = Math.abs(clamped - (state.lastWrittenSeconds ?? 0));
  if (movedBy > POSITION_SEEK_THRESHOLD_SECONDS) return true;

  return nowMs - state.lastWrittenAtMs >= POSITION_WRITE_INTERVAL_MS;
}

/** Fold an accepted write into the state. */
export function recordWrite(
  state: WatchWriteState,
  { positionSeconds, nowMs }: { positionSeconds: number; nowMs: number },
): WatchWriteState {
  return {
    ...state,
    lastWrittenAtMs: nowMs,
    lastWrittenSeconds: clampPosition(positionSeconds),
    retryArmed: false,
  };
}

/** Fold a failed write into the state, so the next tick retries it. */
export function recordWriteFailure(state: WatchWriteState): WatchWriteState {
  return { ...state, retryArmed: true };
}

/** Hold position writes off for a moment around a `/track` call. */
export function suppressAround(state: WatchWriteState, nowMs: number): WatchWriteState {
  return { ...state, suppressedUntilMs: nowMs + TRACK_SUPPRESSION_MS };
}
