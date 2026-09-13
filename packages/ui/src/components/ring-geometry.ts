/**
 * The circle-stroke arithmetic behind <Ring> — an SVG circle drawn with
 * `stroke-dasharray`/`stroke-dashoffset` rather than a `<path>` arc, which
 * needs a circumference and an offset, not trigonometry.
 */
export type RingArc = {
  /** Total length of the stroke dash pattern (the circle's circumference). */
  circumference: number;
  /** How far along the circumference the dash should start (0 = full circle drawn). */
  offset: number;
};

/** 0-100, clamped — a percentage past either end is a caller bug, not a crash. */
export function clampPercentage(percentage: number): number {
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(100, Math.max(0, percentage));
}

/**
 * `radius` is the circle's drawn radius (the SVG viewBox sizes around it).
 * At 0% the full circumference is "missing" (offset === circumference, an
 * invisible ring); at 100% offset is 0 (a full circle).
 */
export function ringArc(percentage: number, radius: number): RingArc {
  const circumference = 2 * Math.PI * radius;
  const clamped = clampPercentage(percentage);
  return { circumference, offset: circumference * (1 - clamped / 100) };
}
