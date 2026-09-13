import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '../components/empty-state';
import {
  CHART_AXIS_TEXT_COLOR,
  CHART_GRID_COLOR,
  CHART_SERIES_PRIMARY,
  CHART_TOOLTIP_BACKGROUND,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_TEXT,
} from './chart-colors';

export type LinePoint = {
  /** X-axis category — already formatted for display (e.g. "Sep 3"). */
  label: string;
  value: number;
};

export type LineTrendProps = {
  data: readonly LinePoint[];
  height?: number;
  /** Formats the Y-axis tick and the tooltip value, e.g. `(v) => `${v}%``. */
  valueFormatter?: (value: number) => string;
  emptyTitle: string;
  emptyDescription?: string;
};

const AXIS_TICK = { fill: CHART_AXIS_TEXT_COLOR, fontSize: 12 };

/**
 * A single-series trend line — course-completion-timeline's daily progress.
 * One series only: `CHART_SERIES_PRIMARY` (`--accent-ink`) is a deliberate,
 * AA-checked token, not the orange brand fill (see chart-colors.ts).
 */
export function LineTrend({
  data,
  height = 220,
  valueFormatter,
  emptyTitle,
  emptyDescription,
}: LineTrendProps) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const format = valueFormatter ?? ((value: number) => `${value}`);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data as LinePoint[]} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={{ stroke: 'var(--line)' }}
            tickLine={false}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={format}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => format(value)}
            contentStyle={{
              background: CHART_TOOLTIP_BACKGROUND,
              border: `1px solid ${CHART_TOOLTIP_BORDER}`,
              borderRadius: 8,
              fontSize: 12,
              color: CHART_TOOLTIP_TEXT,
            }}
            itemStyle={{ color: CHART_TOOLTIP_TEXT }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_SERIES_PRIMARY}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
