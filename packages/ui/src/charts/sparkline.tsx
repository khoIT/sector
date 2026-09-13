import { Line, LineChart, ResponsiveContainer } from 'recharts';

import { CHART_SERIES_PRIMARY } from './chart-colors';

export type SparklineProps = {
  /** Bare numbers, oldest first — no axes, legend or tooltip. */
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
};

/**
 * A minimal inline trend — beside a KPI number, not a chart in its own right.
 * No axes/grid/legend on purpose: at this size they would be noise, and the
 * full `LineTrend` right below it (every caller pairs the two) already
 * carries the labelled version.
 */
export function Sparkline({ values, width = 72, height = 24, className }: SparklineProps) {
  if (values.length < 2) return null;

  const data = values.map((value, index) => ({ index, value }));

  return (
    <div style={{ width, height }} className={className} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_SERIES_PRIMARY}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
