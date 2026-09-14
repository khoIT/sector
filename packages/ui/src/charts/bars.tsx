import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState } from '../components/empty-state';
import {
  CHART_AXIS_TEXT_COLOR,
  CHART_TOOLTIP_BACKGROUND,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_TEXT,
  chartToneColor,
  type ChartTone,
} from './chart-colors';

export type BarsDatum = {
  code: string;
  label: string;
  value: number;
  tone: ChartTone;
};

export type BarsProps = {
  data: readonly BarsDatum[];
  height?: number;
  /** Ranked-list style: category names down the Y axis, value along X. The
   *  default (false) draws categories along the X axis instead. */
  horizontal?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
};

const AXIS_TICK = { fill: CHART_AXIS_TEXT_COLOR, fontSize: 12 };

/**
 * A ranked or categorical bar chart — scan-status counts, top courses by
 * progress. Same tone-per-datum contract as `Donut`: colour is the caller's
 * decision, derived from a status code, never a label.
 */
export function Bars({
  data,
  height = 240,
  horizontal = false,
  emptyTitle,
  emptyDescription,
}: BarsProps) {
  if (data.length === 0 || data.every((item) => item.value === 0)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as BarsDatum[]}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 4, right: 12, bottom: 4, left: horizontal ? 12 : 0 }}
        >
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={AXIS_TICK}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={false}
              />
              <YAxis
                type="number"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            contentStyle={{
              background: CHART_TOOLTIP_BACKGROUND,
              border: `1px solid ${CHART_TOOLTIP_BORDER}`,
              borderRadius: 8,
              fontSize: 12,
              color: CHART_TOOLTIP_TEXT,
            }}
            itemStyle={{ color: CHART_TOOLTIP_TEXT }}
          />
          <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28}>
            {data.map((entry) => (
              <Cell key={entry.code} fill={chartToneColor(entry.tone)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
