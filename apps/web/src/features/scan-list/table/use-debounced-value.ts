import { useEffect, useState } from 'react';

/**
 * Delays a value by `delayMs`.
 *
 * Used on the list keyword so typing does not put a new entry in the React
 * Query cache (and a new request on the wire) per keystroke. Only the keyword
 * is debounced — a filter or sort change is one deliberate act, and delaying
 * it just feels broken.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs, debounced]);

  return debounced;
}
