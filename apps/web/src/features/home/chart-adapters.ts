import {
  GROUP_SCAN_PROGRESS_STATUS_ORDER,
  courseProgressStatusLabelKey,
  courseProgressStatusTone,
  scanProgressStatusLabelKey,
  scanStatusTone,
  type CourseProgressSegment,
  type GroupCourseProgressSegment,
  type GroupScanProgressChart,
  type ScanProgressByUserItem,
} from '@sector/api-client';
import type { BarsDatum, DonutDatum } from '@sector/ui';

/**
 * Turn a dashboard response into chart data, in exactly one place.
 *
 * Every function here keys colour and label off the status CODE the schema
 * already isolated (`segment.key`, `item.status`) — never off the wire's
 * English `label`/`name`, which is what let a server-side rename or
 * localisation blank a slice in the ported dashboards. `t` is the caller's
 * `useTranslation()` — kept as a parameter so this stays framework-agnostic
 * and unit-testable with a stub.
 */
export type Translate = (key: string) => string;

/** Course-progress segments (either the individual or the group shape carry
 *  the same `key`/`count`) → donut slices. Zero-count buckets are dropped so
 *  the legend does not carry a status nobody is in. */
export function courseSegmentsToChartData(
  t: Translate,
  segments: readonly (CourseProgressSegment | GroupCourseProgressSegment)[],
): DonutDatum[] {
  return segments
    .filter((segment) => segment.count > 0)
    .map((segment) => ({
      code: segment.key,
      label: t(courseProgressStatusLabelKey(segment.key)),
      value: segment.count,
      tone: courseProgressStatusTone(segment.key),
    }));
}

/** `scan-progress-by-user`'s chartData (already status-CODEd) → bars. */
export function scanItemsToChartData(
  t: Translate,
  items: readonly ScanProgressByUserItem[],
): BarsDatum[] {
  return items
    .filter((item) => item.value > 0)
    .map((item) => ({
      code: item.status,
      label: t(scanProgressStatusLabelKey(item.status)),
      value: item.value,
      tone: scanStatusTone(item.status),
    }));
}

/**
 * The group scan chart from `GET /api/dashboard/charts` → bars, read by FIXED
 * POSITION against `GROUP_SCAN_PROGRESS_STATUS_ORDER` rather than against the
 * wire's shorter, mismatched `labels` array — see `schemas/dashboard.ts`.
 */
export function groupScanChartToChartData(
  t: Translate,
  chart: GroupScanProgressChart,
): BarsDatum[] {
  return GROUP_SCAN_PROGRESS_STATUS_ORDER.map((code, index) => ({
    code,
    label: t(scanProgressStatusLabelKey(code)),
    value: chart.data[index] ?? 0,
    tone: scanStatusTone(code),
  })).filter((datum) => datum.value > 0);
}
