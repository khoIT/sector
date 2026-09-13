import type { Scan } from '@sector/api-client';

/**
 * What a learner's own scan actually came back as.
 *
 * On My Scans the Status column answers "has this been looked at", which the
 * learner already knows. 3,294 of 15,579 reviews came back `not_achieved` —
 * 21% — and every one of them renders today as the word "Reviewed". Someone
 * with forty reviewed scans opens forty pages to find the ones they need to
 * repeat, and the answer was on the row the whole time.
 *
 * The column keeps its position and its width; it changes what it answers.
 *
 * `competencyMeasure` is read through the schema's tolerant reader, which
 * survives the two rows storing a boolean `true` instead of an enum value.
 * Anything that does not conform reads as "no outcome recorded" rather than as
 * a failure — an unreadable field must never tell someone they did not pass.
 */

export type ScanOutcome =
  | { kind: 'achieved'; reviewedAt: string | null; turnaroundMs: number | null }
  | { kind: 'not-achieved'; reviewedAt: string | null; turnaroundMs: number | null }
  | { kind: 'no-outcome'; reviewedAt: string | null; turnaroundMs: number | null }
  | { kind: 'failed'; error: string | null }
  | { kind: 'status' };

/**
 * Pill text keys. The third one is short enough to hold the column's existing
 * width; its long form lives in a hover title, not in the cell.
 */
export const OUTCOME_KEY: Readonly<Record<'achieved' | 'not-achieved' | 'no-outcome', string>> = {
  achieved: 'outcome.achieved',
  'not-achieved': 'outcome.notAchieved',
  'no-outcome': 'outcome.noOutcome',
};

type OutcomeInput = Pick<Scan, 'status' | 'review' | 'reviewedAt' | 'createdAt' | 'processingError'>;

/**
 * How long the learner waited for the review.
 *
 * 4,168 reviewed scans — 27% — took more than a month, and the reviewed lists
 * print the two dates in separate columns and leave the subtraction to the
 * reader. Three scans carry a `reviewedAt` earlier than their `createdAt`, so
 * the result is clamped rather than rendered as a negative duration.
 */
export function reviewTurnaroundMs(
  createdAt: string | null | undefined,
  reviewedAt: string | null | undefined,
): number | null {
  if (!createdAt || !reviewedAt) return null;

  const start = Date.parse(createdAt);
  const end = Date.parse(reviewedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return Math.max(0, end - start);
}

export function scanOutcome(scan: OutcomeInput): ScanOutcome {
  if (scan.status === 'failed') {
    // Written by the ingest worker from the day that shipped; null on all
    // 2,220 failures that predate it, which render as the bare pill.
    const error = scan.processingError?.trim();
    return { kind: 'failed', error: error ? error : null };
  }

  if (scan.status !== 'reviewed') return { kind: 'status' };

  // `reviewedAt` is absent on three reviewed scans; the review's own timestamp
  // is the same event and keeps those rows from losing their date.
  const reviewedAt = scan.reviewedAt ?? scan.review?.createdAt ?? null;
  const turnaroundMs = reviewTurnaroundMs(scan.createdAt, reviewedAt);

  const measure = scan.review?.competencyMeasure;
  if (measure === 'achieved') return { kind: 'achieved', reviewedAt, turnaroundMs };
  if (measure === 'not_achieved') return { kind: 'not-achieved', reviewedAt, turnaroundMs };

  return { kind: 'no-outcome', reviewedAt, turnaroundMs };
}
