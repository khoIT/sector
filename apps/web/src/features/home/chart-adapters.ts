import {
  courseProgressStatusLabelKey,
  courseProgressStatusTone,
  scanProgressStatusLabelKey,
  scanStatusTone,
  type CourseProgressSegment,
  type DashboardGroupChartsQuery,
  type GroupCourseProgressSegment,
  type ScanProgressByUser,
  type ScanProgressByUserItem,
} from '@sector/api-client';
// Types only, from the charts entry point — erased at compile time, so this
// import does not pull recharts into anything that reads these adapters.
import type { BarsDatum, DonutDatum } from '@sector/ui/charts';

/**
 * What the home screen asks the dashboard routes for, and how it reads what
 * comes back. Both halves are pure, so both are unit-testable without a DOM.
 *
 * Every adapter keys colour and label off the status CODE the schema already
 * isolated (`segment.key`, `item.status`) — never off the wire's English
 * `label`/`name`, which is what let a server-side rename or localisation blank
 * a slice in the ported dashboards. `t` is the caller's `useTranslation()` —
 * kept as a parameter so this stays framework-agnostic and unit-testable with
 * a stub.
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
 * The group snapshot's scan bars, and the ONLY source they may come from:
 * `GET /api/dashboard/scan-progress-by-user?groupId=`, which the server scopes
 * to that group's members.
 *
 * `GET /api/dashboard/charts` also carries a scan array, and it must not be
 * used here. `getChartsData` only narrows its scan query
 * `if (groupUserIds.length > 0)`, and those ids are the group's LEARNERS — so
 * a group with no learners (a new group, or one holding only leaders) gets
 * counts across every scan in the database. Verified against the mirror: two
 * different empty groups both returned the instance totals, 11,576 submitted
 * and 15,499 reviewed, which the home screen would have printed under the
 * group's own name.
 *
 * Nothing to show is `[]`, which `Bars` renders as its empty state. A group
 * whose scoped counts are all zero genuinely has no scans.
 */
export function groupScanBars(t: Translate, scans: ScanProgressByUser | undefined): BarsDatum[] {
  return scanItemsToChartData(t, scans?.chartData ?? []);
}

/**
 * The `GET /api/dashboard/charts` query, or `undefined` when there is nothing
 * worth asking.
 *
 * `getChartsData` builds `courseProgressChart` from three zero segments and
 * only fills them inside `if (courseId) { … }`, so calling it with a group
 * alone returns `data: [0,0,0]` and `totalLearners: 0` no matter how many
 * learners the group has — a donut that can never draw, rendering an empty
 * state that says nobody has any progress. Returning `undefined` leaves the
 * query disabled instead of spending a request on an answer we know is empty.
 */
export function groupCourseChartQuery(
  groupId: string,
  courseId: string | undefined,
): DashboardGroupChartsQuery | undefined {
  if (!groupId || !courseId) return undefined;
  return { groupId, courseId };
}

/**
 * The option a picker should show as selected: the caller's choice while it is
 * still in the list, otherwise the first option.
 *
 * Selections outlive the list they came from — an administrator switches
 * group, a leader's course list finishes loading after the first render — and
 * a stale id sent to a group-scoped route is a request for someone else's
 * data.
 */
export function selectedOptionValue(
  options: readonly { value: string }[],
  chosen: string | undefined,
): string {
  if (chosen && options.some((option) => option.value === chosen)) return chosen;
  return options[0]?.value ?? '';
}
