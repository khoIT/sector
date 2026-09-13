/**
 * The arithmetic behind <ProgressMeter>: a labelled "N of M" value clamped
 * into a 0-100 percentage for the underlying <Progress> bar.
 *
 * Split out from the component so the clamping rules (a max of 0, a value
 * past the max, a negative value — all real inputs once a quiz has zero
 * questions or a resume lands past the last answered one) are covered without
 * a DOM renderer.
 */
export function progressMeterPercentage(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}
