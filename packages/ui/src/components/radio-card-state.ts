export type RadioCardReveal = 'unrevealed' | 'correct' | 'incorrect';

/**
 * <RadioCard>'s border/background classes for one option, as a pure function
 * of (selected, reveal). The quiz runner reveals correctness only on the
 * results screen for question banks (grading happens in one batch at the
 * end) — `reveal` stays 'unrevealed' for every option until then, so this
 * function is what the results review re-uses to colour a past answer.
 */
export function radioCardStateClasses(selected: boolean, reveal: RadioCardReveal): string {
  if (reveal === 'correct') return 'border-ok bg-ok-soft';
  if (reveal === 'incorrect') return 'border-crit bg-crit-soft';
  return selected ? 'border-accent-ink bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2';
}
