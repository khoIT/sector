import { z } from 'zod';

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Turn HTML entities in a plain-text field back into the characters they
 * stand for.
 *
 * Titles imported from the old WordPress site carry their own encoding —
 * "Renal &amp; Bladder PreCourse", "OB 2nd &amp; 3rd Trimester" — because
 * they were authored as HTML. React escapes what it renders, correctly, so
 * the learner reads the entity rather than the ampersand. Six course titles
 * in the production content show this today.
 *
 * Decoding belongs here rather than in each component: the same string is
 * rendered by the outline page, the contents pane, the module cards and the
 * course list, and a fix applied per-component is a fix that gets missed.
 * These are TEXT fields — anything genuinely HTML goes through `RichText`,
 * which is a different path and is sanitised.
 */
export function decodeHtmlEntities(value: string): string {
  if (!value.includes('&')) return value;

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** A plain-text field that may carry imported HTML entities. Use in place of
 *  `z.string()` for anything rendered as text rather than through `RichText`. */
export const displayText = () => z.string().transform(decodeHtmlEntities);
