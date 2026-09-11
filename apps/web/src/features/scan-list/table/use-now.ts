import { useEffect, useState } from 'react';

/**
 * A clock that ticks on an interval, so relative times re-render on their own.
 *
 * One clock per list rather than one per row: every Waiting cell in a table
 * has to agree, and 100 independent timers would be 100 renders a minute.
 */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);

  return now;
}
