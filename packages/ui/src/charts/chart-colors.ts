/**
 * The chart palette, as CSS custom-property references rather than resolved
 * hex values.
 *
 * A recharts `fill`/`stroke` prop accepts any CSS colour string, including
 * `var(--token)` — the browser resolves it at paint time against whichever
 * theme is active on `<html>`, so a chart never needs its own light/dark
 * branch and never goes stale if `tokens.css` changes a hex. The token pairs
 * themselves are proved AA-legible in both themes by
 * `styles/token-contrast.test.ts`; this module only has to get the MAPPING
 * from a semantic tone to the right token right, which is what its test does.
 *
 * `ChartTone` is deliberately the same five-value union as `BadgeTone` (see
 * `components/badge.tsx`) — a status pill and a chart slice for the same
 * status should read as the same colour. `--accent` (the GUSI orange fill) is
 * never one of them: the accent is the product's own colour and using it as
 * one series among several would make a chart look like it is highlighting
 * one status as "the brand", which is not what any of these charts mean.
 * `--accent-ink` (the teal text-accent) fills the `accent` tone instead —
 * a real, AA-checked token, just not the orange.
 */

export type ChartTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'crit';

const CHART_TONE_COLOR: Readonly<Record<ChartTone, string>> = {
  neutral: 'var(--ink-dim)',
  accent: 'var(--accent-ink)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
};

/** The series fill for a semantic tone. Never `var(--accent)` — see above. */
export function chartToneColor(tone: ChartTone): string {
  return CHART_TONE_COLOR[tone];
}

export const CHART_GRID_COLOR = 'var(--line)';
export const CHART_AXIS_TEXT_COLOR = 'var(--ink-dim)';
export const CHART_TOOLTIP_BACKGROUND = 'var(--surface)';
export const CHART_TOOLTIP_BORDER = 'var(--line)';
export const CHART_TOOLTIP_TEXT = 'var(--ink)';
export const CHART_SERIES_PRIMARY = 'var(--accent-ink)';
