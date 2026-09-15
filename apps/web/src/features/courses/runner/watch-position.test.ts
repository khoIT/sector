import { describe, expect, it } from 'vitest';

import {
  clampPosition,
  initialWatchWriteState,
  POSITION_SEEK_THRESHOLD_SECONDS,
  POSITION_WRITE_INTERVAL_MS,
  recordWrite,
  recordWriteFailure,
  shouldWritePosition,
  suppressAround,
  type WatchWriteState,
} from './watch-position';

/**
 * This throttle decides how often a video topic writes to the API. At one
 * write per learner per twelve seconds of playback across 14k learners, the
 * cost of getting it wrong is a load test against the progress collection —
 * and the cost of getting it too lax is a learner resuming behind where they
 * actually stopped.
 */

const T0 = 1_000_000;

function stateAfterWrite(overrides: Partial<WatchWriteState> = {}): WatchWriteState {
  return {
    ...recordWrite(initialWatchWriteState, { positionSeconds: 100, nowMs: T0 }),
    ...overrides,
  };
}

describe('clampPosition', () => {
  it('floors a float and refuses a negative or a non-number', () => {
    expect(clampPosition(12.9)).toBe(12);
    expect(clampPosition(-5)).toBe(0);
    expect(clampPosition(Number.NaN)).toBe(0);
    expect(clampPosition(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('shouldWritePosition', () => {
  it('writes the first position it sees', () => {
    expect(shouldWritePosition(initialWatchWriteState, { positionSeconds: 3, nowMs: T0 })).toBe(
      true,
    );
  });

  it('stays quiet inside the interval', () => {
    const state = stateAfterWrite();
    expect(
      shouldWritePosition(state, {
        positionSeconds: 105,
        nowMs: T0 + POSITION_WRITE_INTERVAL_MS - 1,
      }),
    ).toBe(false);
  });

  it('writes once the interval has passed', () => {
    const state = stateAfterWrite();
    expect(
      shouldWritePosition(state, {
        positionSeconds: 112,
        nowMs: T0 + POSITION_WRITE_INTERVAL_MS,
      }),
    ).toBe(true);
  });

  it('writes immediately on a seek, without waiting for the interval', () => {
    const state = stateAfterWrite();
    expect(
      shouldWritePosition(state, {
        positionSeconds: 100 + POSITION_SEEK_THRESHOLD_SECONDS + 1,
        nowMs: T0 + 500,
      }),
    ).toBe(true);
  });

  it('treats a backward seek the same as a forward one', () => {
    const state = stateAfterWrite();
    expect(shouldWritePosition(state, { positionSeconds: 20, nowMs: T0 + 500 })).toBe(true);
  });

  it('does not treat ordinary playback drift as a seek', () => {
    const state = stateAfterWrite();
    expect(
      shouldWritePosition(state, {
        positionSeconds: 100 + POSITION_SEEK_THRESHOLD_SECONDS,
        nowMs: T0 + 500,
      }),
    ).toBe(false);
  });

  it('says nothing when the playhead has not moved', () => {
    // A paused player still emits timeupdate in some browsers; there is no
    // reason to re-send the same second.
    const state = stateAfterWrite();
    expect(
      shouldWritePosition(state, {
        positionSeconds: 100,
        nowMs: T0 + POSITION_WRITE_INTERVAL_MS * 3,
      }),
    ).toBe(false);
  });

  it('forces a write on pause or page-hide regardless of cadence', () => {
    const state = stateAfterWrite();
    expect(shouldWritePosition(state, { positionSeconds: 103, nowMs: T0 + 100, force: true })).toBe(
      true,
    );
  });

  it('retries a failed write on the next tick, ahead of the interval', () => {
    // The failed write may have been the one that crossed the threshold and
    // completed the topic, so it is not a write to drop quietly.
    const state = recordWriteFailure(stateAfterWrite());
    expect(shouldWritePosition(state, { positionSeconds: 101, nowMs: T0 + 100 })).toBe(true);
  });

  it('retries even when the playhead has not moved', () => {
    const state = recordWriteFailure(stateAfterWrite());
    expect(shouldWritePosition(state, { positionSeconds: 100, nowMs: T0 + 100 })).toBe(true);
  });

  it('holds off while a track call is in flight, forced writes included', () => {
    // `/track` opens a transaction and retries a write conflict three times
    // before throwing; a position write is the cheaper of the two to move.
    const state = suppressAround(stateAfterWrite(), T0);
    expect(shouldWritePosition(state, { positionSeconds: 400, nowMs: T0 + 100 })).toBe(false);
    expect(shouldWritePosition(state, { positionSeconds: 400, nowMs: T0 + 100, force: true })).toBe(
      false,
    );
  });

  it('resumes once the suppression window has passed', () => {
    const state = suppressAround(stateAfterWrite(), T0);
    expect(shouldWritePosition(state, { positionSeconds: 400, nowMs: T0 + 2_000 })).toBe(true);
  });
});

describe('recordWrite', () => {
  it('stores the floored position and clears a pending retry', () => {
    const state = recordWrite(recordWriteFailure(initialWatchWriteState), {
      positionSeconds: 42.8,
      nowMs: T0,
    });
    expect(state.lastWrittenSeconds).toBe(42);
    expect(state.lastWrittenAtMs).toBe(T0);
    expect(state.retryArmed).toBe(false);
  });
});
