import type { DraftFile } from './draft-types';

/** Files whose bytes are confirmed in S3. */
export function countStored(files: DraftFile[]): number {
  return files.filter((file) => file.status === 'stored').length;
}

/**
 * Files that count toward the study. A rejected or cancelled file is not part
 * of it, so neither the "N of M" indicator nor the three-file nudge should see
 * one — otherwise removing a corrupt file makes the total go DOWN and the
 * nudge appear, which reads as a punishment for cleaning up.
 */
export function countTracked(files: DraftFile[]): number {
  return files.filter((file) => file.status !== 'rejected' && file.status !== 'cancelled').length;
}
