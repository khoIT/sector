import { useEffect, useState } from 'react';

/**
 * Whether a CSS media query matches, as React state.
 *
 * For the cases where a `hidden sm:block` pair is the wrong tool: two
 * renderers of the same rows both MOUNT under CSS visibility, so a phone
 * showing 100 cards also builds the 100-row, eight-column table it will never
 * display — every cell, and a second row menu with its own state per row. This
 * renders one.
 *
 * Seeded synchronously from `matchMedia` rather than from a default plus an
 * effect, so the first paint is already the right renderer and there is no
 * flash of the wrong one.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true,
  );

  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;

    const update = () => setMatches(list.matches);
    // The query can have changed between the seed and this effect running.
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
