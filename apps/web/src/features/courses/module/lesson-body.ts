/**
 * Whether a lesson's authored body is worth showing.
 *
 * Lesson bodies in this library are two different things wearing the same
 * field. Measured over all 606 non-deleted lessons:
 *
 *   - 399 carry under 100 characters of text once links are discounted.
 *     These are navigation — a hand-maintained table of links to the
 *     lesson's own topics, which the outline already knows and the card grid
 *     now renders with status, runtime and a thumbnail the table never had.
 *   - 207 carry real teaching prose: scanning technique, probe selection,
 *     series overviews, some of it thousands of characters long.
 *
 * The two populations barely overlap in length, so one threshold separates
 * them without a heuristic that needs tuning. The body is rendered when it
 * teaches something and suppressed when it is only a worse copy of the list
 * printed underneath it.
 *
 * Text INSIDE a link does not count. A table of twelve topic links is a lot
 * of characters and none of them are content.
 */

/** Below this many non-link characters, a body is navigation, not teaching. */
const SUBSTANTIVE_PROSE_CHARS = 100;

export function proseLength(html: string | null | undefined): number {
  if (!html) return 0;
  return html
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

export function hasSubstantiveProse(html: string | null | undefined): boolean {
  return proseLength(html) >= SUBSTANTIVE_PROSE_CHARS;
}
