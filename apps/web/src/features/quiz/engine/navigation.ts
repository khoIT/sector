/**
 * Question index arithmetic — prev/next/jump, all clamped to the question
 * list's bounds so a stray `next()` past the last question or a `previous()`
 * before the first is a no-op rather than an out-of-range index downstream.
 */

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function isFirstQuestion(index: number): boolean {
  return index <= 0;
}

export function isLastQuestion(index: number, length: number): boolean {
  return index >= length - 1;
}
