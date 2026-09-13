/**
 * Size limits on a study's files.
 *
 * Ported from the legacy dashboard's `MAX_TOTAL_SIZE` (form-upload.tsx),
 * which used the same 200 MB figure for both checks: a single file over the
 * study's own cap can never fit inside it either way, so one constant serves
 * both the per-file rejection and the running-total one. Kept in its own
 * tested module so the number and the two messages that quote it can never
 * drift apart.
 */

const BYTES_PER_MB = 1024 * 1024;

/** The whole study — every file it holds, added together. */
export const MAX_STUDY_BYTES = 200 * BYTES_PER_MB;

/** `200 MB`. Whole megabytes: nobody needs the exact byte count in a message. */
export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / BYTES_PER_MB)} MB`;
}

/** A single file too large to ever fit in the study cap on its own. */
export function exceedsFileLimit(sizeBytes: number): boolean {
  return sizeBytes > MAX_STUDY_BYTES;
}

/**
 * Whether adding `incomingBytes` on top of what the study already tracks
 * would push it past the cap. `existingBytes` should be the total of every
 * file still part of the study — see `trackedBytes` in file-counts.ts — so a
 * file the learner already removed never counts against a new one.
 */
export function wouldExceedStudyLimit(existingBytes: number, incomingBytes: number): boolean {
  return existingBytes + incomingBytes > MAX_STUDY_BYTES;
}
