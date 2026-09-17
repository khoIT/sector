/**
 * The readable words inside a CMS HTML field.
 *
 * NOT a sanitiser, and never a step on the way to rendering markup: it strips
 * tags to produce a TEXT string for a length test or an excerpt, and anything
 * that actually displays the HTML goes through `RichText`, which sanitises.
 *
 * The entities are matched in their RAW form because `content` is the one
 * field on a course deliberately not decoded at the schema boundary — it is
 * HTML, so it arrives with its entities intact.
 */
export function plainTextFromHtml(html: string | null | undefined): string {
  if (!html) return '';

  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether a CMS field holds anything a reader would see. */
export function hasVisibleText(html: string | null | undefined): boolean {
  return plainTextFromHtml(html).length > 0;
}
