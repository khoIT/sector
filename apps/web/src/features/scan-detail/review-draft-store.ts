import type { AddScanReviewPayload } from '@sector/api-client';

/**
 * Per-scan review drafts in localStorage.
 *
 * A review is long-form writing — several paragraphs of feedback — and the
 * reviewer is one accidental back-navigation, tab close or token expiry away
 * from losing all of it. Nothing on the server holds a partial review, so the
 * draft lives in the browser until the review is submitted.
 *
 * Per-viewer and per-device by design: a draft is not shared state, and it must
 * never be mistaken for a submitted review. Every access is wrapped, because
 * storage throws in a private window and can be full or disabled.
 */

const KEY_PREFIX = 'scanvault.review-draft.';

export type ReviewDraft = Pick<
  AddScanReviewPayload,
  | 'competencyMeasure'
  | 'overAllFeed'
  | 'technicalFeed'
  | 'teachingPoints'
  | 'teachingContent'
  | 'note'
  | 'customReviews'
> & {
  /** Epoch ms, so the UI can say when it last saved. */
  savedAt: number;
};

function keyFor(scanId: string): string {
  return `${KEY_PREFIX}${scanId}`;
}

export function readReviewDraft(scanId: string): ReviewDraft | null {
  try {
    const raw = window.localStorage.getItem(keyFor(scanId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as ReviewDraft;
  } catch {
    // Unreadable or corrupt: behave exactly as if there were no draft.
    return null;
  }
}

export function writeReviewDraft(scanId: string, draft: Omit<ReviewDraft, 'savedAt'>): number | null {
  const savedAt = Date.now();
  try {
    window.localStorage.setItem(keyFor(scanId), JSON.stringify({ ...draft, savedAt }));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearReviewDraft(scanId: string): void {
  try {
    window.localStorage.removeItem(keyFor(scanId));
  } catch {
    // Nothing to do — a draft that cannot be cleared is harmless once the
    // review is submitted, because the form is gone.
  }
}

/** True when a draft holds anything a reviewer would be sad to lose. */
export function draftHasContent(draft: Omit<ReviewDraft, 'savedAt'>): boolean {
  if (draft.competencyMeasure) return true;
  if (draft.overAllFeed?.trim()) return true;
  if (draft.technicalFeed?.trim()) return true;
  if (draft.teachingPoints?.trim()) return true;
  if (draft.teachingContent?.trim()) return true;
  if (draft.note?.trim()) return true;
  return Boolean(draft.customReviews?.some((entry) => entry.question.trim() || entry.answer.trim()));
}
