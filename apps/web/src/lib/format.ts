/**
 * Display formatters shared across feature surfaces.
 *
 * These live here rather than inside a feature because more than one feature
 * renders the same value: file sizes appear in the create-scan wizard's file
 * rows AND in the scan detail file list, and a full timestamp appears in the
 * detail panels AND in the list's date-cell tooltips. Two copies drifted once
 * already (one capped at MB and rounded KB, the other scaled to GB), which is
 * how the same 1.5 KB file came to render as "2 KB" on one screen and
 * "1.5 KB" on another.
 *
 * Everything here is pure and locale-aware via `undefined` locale, so it
 * follows the viewer's browser settings rather than hard-coding en-US.
 */

const BYTE_UNITS = ['KB', 'MB', 'GB'] as const;

/**
 * Byte counts as people read them.
 *
 * One decimal below 10 in a unit, none above, so a column of sizes stays the
 * same width: `938 B`, `1.5 KB`, `24 KB`, `1.2 GB`. Anything unusable — null,
 * negative, NaN, Infinity — renders as an em dash rather than "NaN B".
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;

  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${BYTE_UNITS[unit]}`;
}

/** Date and time: `14 Aug 2026, 09:31`. For panels and title tooltips. */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseIso(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Date only: `14 Aug 2026`. For the list's date columns, where time is noise. */
export function formatDate(value: string | null | undefined): string {
  const date = parseIso(value);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}
