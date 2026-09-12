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

/**
 * Whether the files area may collapse itself.
 *
 * Only when every tracked file is safely in storage. A file that is
 * validating, queued, uploading, failed or detached still needs the learner's
 * attention — a failed one needs a retry and a detached one needs re-picking —
 * and an area that folds itself shut over an error is how an error goes
 * unnoticed until submit.
 *
 * An empty study never collapses either: there is nothing to summarise and the
 * drop zone is the first thing to do.
 */
export function canAutoCollapseFiles(files: DraftFile[]): boolean {
  const tracked = countTracked(files);
  return tracked > 0 && countStored(files) === tracked;
}

/** Total bytes of the files that count toward the study. */
export function trackedBytes(files: DraftFile[]): number {
  return files
    .filter((file) => file.status !== 'rejected' && file.status !== 'cancelled')
    .reduce((total, file) => total + file.size, 0);
}
