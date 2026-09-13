import type { SubmitOutcome } from './draft-types';

/**
 * Whether a submit landed every file the learner intended.
 *
 * This is the line between "the draft has nothing left to do" and "the
 * draft is the only way to finish this study" — see `finish()` in
 * use-create-scan-draft.ts. A submit that confirmed fewer files than the
 * study's own total (`fileCount < fileTotal`, in the server's terms) leaves
 * real work outstanding: files still uploading, a confirmation that failed,
 * or bytes that never reached storage at all. Destroying the draft and its
 * blobs at that point is what stranded a scan in `pending` with no way back
 * to it — the audit's "receipt's advice cannot be followed".
 */
export function isFullySubmitted(outcome: SubmitOutcome): boolean {
  return (
    outcome.scanId !== null &&
    outcome.filesTotal > 0 &&
    outcome.filesConfirmed === outcome.filesTotal &&
    outcome.unconfirmed.length === 0
  );
}
