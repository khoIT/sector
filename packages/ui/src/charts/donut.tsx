import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { EmptyState } from '../components/empty-state';
import {
  CHART_TOOLTIP_BACKGROUND,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_TEXT,
  chartToneColor,
  type ChartTone,
} from './chart-colors';

export type DonutDatum = {
  /** The status CODE this slice represents — the value to key state off,
   *  never `label`. */
  code: string;
  /** Already-localised display text. */
  label: string;
  value: number;
  tone: ChartTone;
};

export type DonutProps = {
  data: readonly DonutDatum[];
  height?: number;
  /** Centre-of-chart total label, e.g. "24 scans". Omit for no centre label. */
  totalLabel?: string;
  emptyTitle: string;
  emptyDescription?: string;
};

/**
 * A status-breakdown donut — course progress, scan status, anything that is
 * a handful of mutually-exclusive buckets summing to a whole.
 *
 * Every caller supplies `tone` per datum (derived from the status CODE by the
 * caller, per `schemas/dashboard.ts`'s doc comment) rather than this
 * component guessing a colour from `label` — repeating that mistake here
 * would just move the bug from four dashboards into one shared component.
 */
export function Donut({
  data,
  height = 240,
  totalLabel,
  emptyTitle,
  emptyDescription,
}: DonutProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data as DonutDatum[]}
            dataKey="value"
            nameKey="label"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.code} fill={chartToneColor(entry.tone)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value}`, name]}
            contentStyle={{
              background: CHART_TOOLTIP_BACKGROUND,
              border: `1px solid ${CHART_TOOLTIP_BORDER}`,
              borderRadius: 8,
              fontSize: 12,
              color: CHART_TOOLTIP_TEXT,
            }}
            itemStyle={{ color: CHART_TOOLTIP_TEXT }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ fontSize: 12, color: 'var(--ink-dim)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      {totalLabel ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center pb-9"
        >
          <span className="sv-num text-[15px] font-semibold text-ink">{totalLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
