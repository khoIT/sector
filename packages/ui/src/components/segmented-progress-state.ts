export type SegmentState = 'current' | 'done' | 'todo';

/**
 * The per-segment visual state for <SegmentedProgress> — the quiz runner's
 * "one tick per question" bar. `current` wins over `done`: a question you
 * are looking at right now reads as current even if you already answered it
 * (going back to review a previous answer should not look like the bar has
 * regressed).
 */
export function segmentState(index: number, currentIndex: number, isDone: boolean): SegmentState {
  if (index === currentIndex) return 'current';
  return isDone ? 'done' : 'todo';
}

/** One state per segment, 0 to `total - 1`. */
export function segmentStates(
  total: number,
  currentIndex: number,
  isDoneAt: (index: number) => boolean,
): SegmentState[] {
  return Array.from({ length: Math.max(0, total) }, (_, index) =>
    segmentState(index, currentIndex, isDoneAt(index)),
  );
}
