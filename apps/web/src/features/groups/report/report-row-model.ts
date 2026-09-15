import type { GroupScanReportEntry } from '@sector/api-client';

/**
 * Display shaping for the leader's per-learner completion report.
 *
 * Pure, and deliberately thin: every figure in the report is decided by the
 * server's one row builder, which the CSV download and the xlsx export also
 * call. Nothing here recomputes a percentage or a count — a second definition
 * of "complete" in the browser is exactly what this report was built to
 * remove.
 */

/** The percentage as a number, for sorting. The wire carries it as `'73%'`. */
export function completionValue(entry: GroupScanReportEntry): number {
  const parsed = Number.parseFloat(entry['Completion Percentage']);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Last-active as a sortable number. A learner who has never opened the course
 * sorts as the oldest possible moment, so "least recently active first" puts
 * the people who never started at the top, which is who a leader is looking
 * for.
 */
export function lastActiveValue(entry: GroupScanReportEntry): number {
  if (!entry.lastAccessedAt) return Number.NEGATIVE_INFINITY;
  const time = new Date(entry.lastAccessedAt).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/**
 * The i18n key for a last-active cell, or the date itself. Never an empty
 * string: a blank cell reads as a rendering bug, where "Never" is a fact
 * about the learner.
 */
export function formatLastActive(
  entry: GroupScanReportEntry,
  translate: (key: string) => string,
): string {
  if (!entry.lastAccessedAt) return translate('groups.report.neverActive');
  const date = new Date(entry.lastAccessedAt);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString()
    : translate('groups.report.neverActive');
}

export function learnerName(entry: GroupScanReportEntry): string {
  const name = `${entry['First Name']} ${entry['Last Name']}`.trim();
  return name.length > 0 ? name : entry.Username;
}

export type ReportSortKey = 'name' | 'completion' | 'lastActive' | 'overdue';

/**
 * Sorted rows. Ascending means "worst first" for the two columns a leader
 * reads to find who needs chasing: the least complete, and the least recently
 * active. Overdue sorts the other way — most overdue first — because there,
 * the large number is the problem.
 */
export function sortReportRows(
  rows: readonly GroupScanReportEntry[],
  key: ReportSortKey,
  direction: 'asc' | 'desc',
): GroupScanReportEntry[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    switch (key) {
      case 'completion':
        return (completionValue(left) - completionValue(right)) * factor;
      case 'lastActive':
        return (lastActiveValue(left) - lastActiveValue(right)) * factor;
      case 'overdue':
        return (left.assignments.overdue - right.assignments.overdue) * factor;
      case 'name':
        return learnerName(left).localeCompare(learnerName(right)) * factor;
    }
  });
}
