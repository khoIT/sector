/**
 * Scan tags, as the list renders them.
 *
 * Two of the five stored tags are suppressed rather than labelled. Measured
 * over 31,495 scans, `complete` and `incomplete` do not agree with the file
 * counts they sit beside:
 *
 *   2,651 scans are short on files and tagged `complete`
 *   2,428 scans have every file and are tagged `incomplete`
 *   5,841 scans are short on files and carry no tag at all
 *
 * A badge reading "incomplete" one word from a count reading 3/3 is not a
 * second opinion, it is a contradiction, and the count is the side with the
 * live value behind it. So the completeness tags never render; the file count
 * carries that fact on its own, in warn when it is short.
 *
 * Anything with no label here is dropped too. A raw database token shown to a
 * user is a leak, not a feature, and a new tag should be added deliberately.
 */
/** The two completeness tags a reviewer writes. Mutually exclusive. */
export const COMPLETE_TAG = 'complete';
export const INCOMPLETE_TAG = 'incomplete';

/** Set by POST /api/scan-review/request-expert; read wherever a caller needs
 *  to know a review was already requested rather than re-issuing one. */
export const EXPERT_REVIEW_TAG = 'expert_scan_review';

const SCAN_TAG_KEY: Readonly<Record<string, string>> = {
  [EXPERT_REVIEW_TAG]: 'row.expertReview',
  resubmitted: 'row.resubmitted',
  dicom: 'row.dicom',
};

/** Stored, deliberately never rendered. See the note above. */
const SUPPRESSED_TAGS: ReadonlySet<string> = new Set([COMPLETE_TAG, INCOMPLETE_TAG]);

export type DisplayTag = { id: string; labelKey: string };

/**
 * The tags worth a chip, in the order the server sent them, de-duplicated.
 */
export function displayTags(tags: readonly string[] | null | undefined): DisplayTag[] {
  if (!tags?.length) return [];

  const seen = new Set<string>();
  const result: DisplayTag[] = [];

  for (const raw of tags) {
    const id = raw.trim().toLowerCase();
    if (!id || seen.has(id) || SUPPRESSED_TAGS.has(id)) continue;

    const labelKey = SCAN_TAG_KEY[id];
    if (!labelKey) continue;

    seen.add(id);
    result.push({ id, labelKey });
  }

  return result;
}

/** True when fewer files arrived than the scan declared. */
export function isMissingFiles(fileCount: number, fileTotal: number): boolean {
  return fileTotal > 0 && fileCount < fileTotal;
}

export type CompletionTag = typeof COMPLETE_TAG | typeof INCOMPLETE_TAG;

export type CompletionTagMutation = {
  /** The tag to add, or null when the scan already carries it. */
  add: CompletionTag | null;
  /** The opposite tag to remove, or null when it was never there. */
  remove: CompletionTag | null;
};

/**
 * What it takes to set a scan's completeness to `next`.
 *
 * The server writes tags with `$push`, not `$addToSet` or a replace, so
 * mutual exclusion is not enforced there: without this, marking a scan
 * `complete` twice would push a duplicate, and marking a scan tagged
 * `incomplete` as `complete` would leave BOTH tags on the same scan — the
 * write-only state the audit found. This is what the client sends instead:
 * add the new tag only when it is not already there, and always drop the
 * opposite one when present.
 */
export function completionTagMutation(
  currentTags: readonly string[] | null | undefined,
  next: CompletionTag,
): CompletionTagMutation {
  const opposite = next === COMPLETE_TAG ? INCOMPLETE_TAG : COMPLETE_TAG;
  const normalized = new Set((currentTags ?? []).map((tag) => tag.trim().toLowerCase()));

  return {
    add: normalized.has(next) ? null : next,
    remove: normalized.has(opposite) ? opposite : null,
  };
}
