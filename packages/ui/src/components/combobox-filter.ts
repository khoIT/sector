/**
 * Matching for <Combobox>, kept apart from the component so it can be tested.
 *
 * The package's vitest runs in a node environment over `src/**\/*.test.ts`, so
 * anything with behaviour worth asserting has to live in a `.ts` module rather
 * than inside the `.tsx` that renders it.
 */

export type ComboboxOption = {
  value: string;
  label: string;
  /** Second line, searched as well — a group's parent, a type's version. */
  description?: string;
  /**
   * Small picture for the row, e.g. a scan type's icon. Not searched: it is
   * decoration beside the label, never the thing a person types to find.
   */
  imageUrl?: string | null;
};

/**
 * Options whose label or description contains every whitespace-separated term.
 *
 * Every term rather than the whole string: "msk knee" should find
 * "MSK - Knee" even though that exact sequence never appears in it. Order is
 * preserved so a list that arrived sorted stays sorted — a search box that
 * also reorders makes the eye re-scan from the top on every keystroke.
 */
export function filterComboboxOptions(
  options: readonly ComboboxOption[],
  query: string,
): ComboboxOption[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...options];

  return options.filter((option) => {
    const haystack = `${option.label} ${option.description ?? ''}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * The index arrow keys should move to.
 *
 * Wraps in both directions, and answers 0 for an empty or absent current index
 * so the first Down on a fresh popover lands on the first option rather than
 * the second.
 */
export function nextHighlight(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
}
