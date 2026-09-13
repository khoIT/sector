import type { StatusTone } from '@sector/api-client';

/**
 * How long a scan has been sitting in a review queue.
 *
 * This is the number a reviewer actually triages on: "submitted 2026-08-14"
 * means nothing at a glance, "23d" means someone has been waiting three weeks
 * for feedback. The queues default to longest-waiting-first for the same
 * reason — the oldest scan is the one that has been failed for longest.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Past this, a queue item is late enough to call out in warn/crit colours. */
export const WAITING_WARN_DAYS = 7;
export const WAITING_CRIT_DAYS = 14;

export function waitingMs(submittedAt: string, now: number = Date.now()): number {
  const submitted = Date.parse(submittedAt);
  if (Number.isNaN(submitted)) return 0;
  return Math.max(0, now - submitted);
}

/** Compact two-unit duration: `23d 4h`, `5h 12m`, `8m`, `just now`. */
export function formatWaiting(ms: number): string {
  if (ms < MINUTE) return 'just now';

  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

export function waitingTone(ms: number): StatusTone {
  if (ms >= WAITING_CRIT_DAYS * DAY) return 'crit';
  if (ms >= WAITING_WARN_DAYS * DAY) return 'warn';
  return 'neutral';
}
