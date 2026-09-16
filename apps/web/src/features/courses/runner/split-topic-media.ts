/**
 * A topic's authored HTML, split into its player and everything else.
 *
 * The video arrives inside `content` — an `<iframe>` somewhere in a blob of
 * WordPress-era markup — but the player is not body text: it belongs above the
 * title, at the full width of the column, while the prose belongs under an
 * Overview tab. Rendering the blob whole puts a 640px box in the middle of a
 * paragraph, which is what it looks like today.
 *
 * Deliberately a string split rather than a DOM parse: the halves are handed
 * straight back to `RichText`, which sanitises them, so nothing here is trusted
 * and a miss costs only the old single-blob layout.
 *
 * Only the FIRST iframe moves. A topic with two embeds is rare and the second
 * one is invariably inline in the prose, where it should stay.
 */
export type SplitTopicMedia = {
  /** The player, or null when the topic is text only. */
  media: string | null;
  /** What is left to read, with the extracted player removed. */
  body: string;
};

const IFRAME = /<iframe\b[^>]*>[\s\S]*?<\/iframe>/i;

export function splitTopicMedia(html: string | null | undefined): SplitTopicMedia {
  if (!html) return { media: null, body: '' };

  const match = IFRAME.exec(html);
  if (!match) return { media: null, body: html };

  const body = (html.slice(0, match.index) + html.slice(match.index + match[0].length)).trim();
  return { media: match[0], body };
}

/** Whether what remains would render as anything a reader can see. */
export function hasReadableBody(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
      .replace(/\s+/g, '').length > 0
  );
}
