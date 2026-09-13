import type { UserLogEntry } from '@sector/api-client';

import type { DraftFile } from './draft-types';

/**
 * What the API's user-log records as the client that wrote the entry.
 *
 * Deliberately still "ScanVault" after the rename. Nothing here reads the
 * field back, but the server renders these entries into the submission email
 * and anything querying the log by `details.source` would silently stop
 * matching records written from this client. Changing it is a data decision
 * for whoever owns those queries, not a consequence of the rebrand.
 */
const LOG_SOURCE = 'ScanVault';

/**
 * The activity trail a submitted study is announced with.
 *
 * Not bookkeeping. The API renders these entries into the submission email and
 * lists them under Activity log on the scan, and — the part that is easy to
 * miss — it sends the owner NO email at all unless the scan has at least one
 * of them (`scan.controller.ts` guards the notification on
 * `updatedScan.scanLogs.length > 0`). A study submitted without these is a
 * study nobody is told about.
 *
 * Written at submit rather than buffered through the session: these are the
 * facts that are actually true of the record being created, and a log that
 * describes a click the user later undid is worse than no log.
 */

export type SubmitLogInput = {
  /** Empty when the caller has no user in hand; the field is then omitted
   *  rather than sent blank, which the API rejects as a malformed object id. */
  userId: string;
  scanTypeName: string;
  files: readonly DraftFile[];
  /** Files the server confirmed as `completed`. */
  confirmed: number;
  /** Files whose confirmation failed, by name. */
  unconfirmed: readonly string[];
  groupNames: readonly string[];
  expertReviewLabel: string | null;
};

/**
 * What the scan's status should read after the confirmations.
 *
 * The server already flips a fully-confirmed scan to `submitted` on the last
 * file, so this agrees with it rather than overriding it; it matters for the
 * SHORT case, where the scan is left `pending` and the group leaders' notice —
 * which the server gates on the status — would never fire.
 */
export function statusAfterSubmit(
  confirmed: number,
  total: number,
): 'submitted' | 'partially_uploaded' {
  return confirmed > 0 && confirmed >= total ? 'submitted' : 'partially_uploaded';
}

export function submitLogEntries(input: SubmitLogInput): UserLogEntry[] {
  const { userId, scanTypeName, files, confirmed, unconfirmed, groupNames } = input;
  const stored = files.filter((file) => file.status === 'stored');
  const bytes = stored.reduce((sum, file) => sum + file.size, 0);

  const about = userId ? { user: userId } : {};

  const entries: UserLogEntry[] = [
    {
      action: 'scan.files.uploaded',
      severity: 'info',
      message:
        stored.length === 1
          ? `1 file uploaded (${bytes} bytes)`
          : `${stored.length} files uploaded (${bytes} bytes)`,
      ...about,
      details: {
        source: LOG_SOURCE,
        fileCount: stored.length,
        totalSizeBytes: bytes,
        fileNames: stored.map((file) => file.name),
      },
    },
  ];

  // Files the learner added that never reached storage. Nothing else in the
  // record mentions them: fileTotal counts what was submitted, so a study
  // short of what was intended otherwise reads as complete forever.
  const leftBehind = files.filter(
    (file) => file.status === 'rejected' || file.status === 'failed' || file.status === 'cancelled',
  );
  if (leftBehind.length > 0) {
    entries.push({
      action: 'scan.files.left_behind',
      severity: 'warning',
      message: `${leftBehind.length} file${leftBehind.length === 1 ? '' : 's'} added but never uploaded: ${leftBehind
        .map((file) => file.name)
        .join(', ')}`,
      ...about,
      details: {
        source: LOG_SOURCE,
        fileNames: leftBehind.map((file) => file.name),
        reasons: leftBehind.map((file) => file.error?.reason ?? file.status),
      },
    });
  }

  // One entry per failure, named. A count would tell the learner that
  // something was left behind without telling them which thing.
  for (const name of unconfirmed) {
    entries.push({
      action: 'scan.file.confirm_failed',
      severity: 'warning',
      message: `${name} finished uploading but the server did not confirm it`,
      ...about,
      details: { source: LOG_SOURCE, filename: name },
    });
  }

  entries.push({
    action: 'scan.submit',
    severity: unconfirmed.length > 0 ? 'warning' : 'info',
    message:
      unconfirmed.length > 0
        ? `Study submitted with ${confirmed} of ${confirmed + unconfirmed.length} files`
        : `Study submitted with ${confirmed} file${confirmed === 1 ? '' : 's'}`,
    ...about,
    details: {
      source: LOG_SOURCE,
      scanType: scanTypeName,
      filesConfirmed: confirmed,
      filesTotal: confirmed + unconfirmed.length,
      groups: groupNames,
      expertReview: input.expertReviewLabel ?? null,
    },
  });

  return entries;
}
