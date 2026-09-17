export type CommandGroup = 'nav' | 'scan' | 'course';

export type CommandItem = {
  id: string;
  group: CommandGroup;
  label: string;
  /** Secondary line — a scan's identifier, a course's status. */
  hint?: string | null;
  path: string;
};

/** Group order in the menu, and the order `filterCommands` returns. */
export const COMMAND_GROUP_ORDER: readonly CommandGroup[] = ['nav', 'scan', 'course'];

/** Enough to scan by eye; more turns the menu into a list view. */
export const MAX_PER_GROUP = 8;

/**
 * Comparable form of a label: case-folded and stripped of diacritics, so
 * "Résumé" is found by typing "resume". The corpus is seven locales and real
 * learner-authored scan titles, so this is not a theoretical case.
 */
export function normaliseForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * How well a label answers a query. Higher is better, 0 is no match.
 *
 * Three tiers rather than a fuzzy score: with three fixed sources and at most
 * eight rows each, "starts with what I typed" beats "contains it somewhere"
 * and nothing else is worth the ranking machinery — the legacy menu shipped a
 * fuzzy matcher whose top hit was regularly the longest title on screen.
 */
export function rankCommand(label: string, query: string): number {
  const haystack = normaliseForMatch(label);
  const needle = normaliseForMatch(query);
  if (!needle) return 1;

  if (haystack.startsWith(needle)) return 3;
  if (haystack.split(/[^\p{Letter}\p{Number}]+/u).some((word) => word.startsWith(needle))) return 2;
  return haystack.includes(needle) ? 1 : 0;
}

/**
 * The rows to show, ranked and capped.
 *
 * An empty query shows navigation only. The cached scans and courses are
 * there to be searched for, not to be a recently-viewed list the learner has
 * to read past to reach the thing they opened the menu for.
 */
export function filterCommands(items: readonly CommandItem[], query: string): CommandItem[] {
  const searching = normaliseForMatch(query).length > 0;

  return COMMAND_GROUP_ORDER.flatMap((group) => {
    if (!searching && group !== 'nav') return [];

    return (
      items
        .filter((item) => item.group === group)
        .map((item, index) => ({ item, index, rank: rankCommand(item.label, query) }))
        .filter((entry) => entry.rank > 0)
        // Rank first, then declaration order — `sort` is stable in every engine
        // this runs in, but tie-breaking on the index says so out loud.
        .sort((a, b) => b.rank - a.rank || a.index - b.index)
        .slice(0, MAX_PER_GROUP)
        .map((entry) => entry.item)
    );
  });
}
