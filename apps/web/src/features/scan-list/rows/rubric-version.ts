import type { ScanTypeRef } from '@sector/api-client';

/**
 * Which generation of the protocol a scan was submitted under.
 *
 * Six rubric versions are live in the queue at once — v1 2,314, v2 1,513,
 * v3 1,300, v4 2,682, v5 630, v6 3,954 across 12,393 queued scans — and the
 * scan type's name is the same word in all of them. "FAST" does not say which
 * of six FAST rubrics this scan's findings are keyed to, and the reviewer is
 * about to answer that rubric's questions.
 *
 * ## Why this is printed always, and not only when it is out of date
 *
 * The design asked for the version to appear only on a scan behind the
 * organisation's current rubric, on the understanding that would be rare.
 * Measured, it is not: comparing each scan's `scanType.version` against its
 * organisation's `scanTypeVersion`, 5,127 of 12,393 queued scans are behind —
 * 41% — and 9,544 of 15,566 reviewed ones, 61%.
 *
 * A warning that fires on two rows in five is not a warning, it is a second
 * permanent line that people learn to stop reading. And the framing was wrong
 * in the first place: a v2 scan is reviewed against the v2 rubric, because its
 * findings are keyed to it. Being on an older version is not an error state,
 * it is which protocol applies. So it renders as a plain dim qualifier beside
 * the type name, on every row, with no tone and no extra line.
 */

/** `v5`, or null when the type carries no version. */
export function rubricVersionLabel(scanType: Pick<ScanTypeRef, 'version'>): string | null {
  const version = scanType.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version <= 0) return null;
  return `v${version}`;
}
