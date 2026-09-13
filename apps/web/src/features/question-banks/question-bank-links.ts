/**
 * The question-bank surface's two URLs, built here rather than by hand at
 * every call site — the same reason scan-detail-links.ts exists for the
 * Scan Vault. The nav entry, the router and every Link in this feature all
 * read these.
 */
export const QUESTION_BANK_LIST_PATH = '/learn/question-banks';

export function questionBankDetailPath(slug: string): string {
  return `${QUESTION_BANK_LIST_PATH}/${slug}`;
}
