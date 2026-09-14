/**
 * @sector/ui/charts — the recharts-backed primitives, behind their own entry
 * point.
 *
 * Separate from the package root on purpose. recharts and its d3 dependencies
 * are 566 kB raw / 160 kB gzipped, and while these lived on the root export
 * every consumer of `@sector/ui` risked pulling them into the entry chunk. One
 * screen uses charts; it can pay for them when it renders, with a dynamic
 * `import('@sector/ui/charts')`.
 *
 * Colour still comes from `chart-colors`, which resolves design tokens at
 * paint time — see that module for why `--accent` is never a series colour.
 */
export {
  CHART_AXIS_TEXT_COLOR,
  CHART_GRID_COLOR,
  CHART_SERIES_PRIMARY,
  CHART_TOOLTIP_BACKGROUND,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_TEXT,
  chartToneColor,
  type ChartTone,
} from './chart-colors';
export { Donut, type DonutDatum, type DonutProps } from './donut';
export { Bars, type BarsDatum, type BarsProps } from './bars';
export { LineTrend, type LinePoint, type LineTrendProps } from './line';
export { Sparkline, type SparklineProps } from './sparkline';
