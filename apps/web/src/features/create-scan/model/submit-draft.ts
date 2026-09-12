import {
  createScan,
  createUserLogs,
  getScanById,
  isApiError,
  requestExpertScanReview,
  updateFileDetailsStatus,
  updateScan,
  updateScanFileStatus,
  type ApiClient,
  type CreateScanPayload,
  type ScanFilePayload,
} from '@scanvault/api-client';

import type { DraftFile, DraftState, SubmitOutcome } from './draft-types';
import { toFindingsPayload } from './finding-controls';
import { statusAfterSubmit, submitLogEntries } from './submit-logs';

/**
 * Turn a draft whose bytes are already in storage into a submitted scan.
 *
 * This is a METADATA write. Nothing here transfers a file; every object was
 * PUT to S3 while the user was working through steps 1-3. What remains is one
 * create, one confirmation per file, and an optional review request.
 *
 * WHY THE SCAN IS CREATED HERE RATHER THAN AT THE FIRST FILE
 * ---------------------------------------------------------
 * `POST /api/scan/create` is the only route on the API that accepts
 * `groupIds`: `PUT /api/scan/:id/update` has no such field, and the only other
 * writer of the group link is the expert-review request, which spends a
 * credit. Creating the record earlier would therefore mean creating it before
 * the user has chosen a review routing — and then having no way to apply that
 * choice. Create also requires `scanTypeId`, which the wizard does not have
 * until step 2, and `scanTypeId` cannot be changed afterwards either.
 *
 * So the record is created at the last moment that can carry every decision,
 * and the transfer — the only slow part — has already happened. The draft id
 * persisted in localStorage is what makes that safe across a reload: the S3
 * objects are addressable by it, so a resumed draft submits the same bytes
 * rather than orphaning them.
 *
 * The create response's `id` is handed back through `onScanCreated` BEFORE the
 * per-file confirmations run, so a failure halfway through resumes against the
 * same scan instead of creating a second one.
 */

export type SubmitDraftInput = {
  client: ApiClient;
  state: DraftState;
  /** Resolved group ids (the default cohort when the user never touched it). */
  groupIds: string[];
  /** Those groups by name, for the activity trail. Ids mean nothing in an email. */
  groupNames?: readonly string[];
  /** The submitter, so the trail is attributed to them and not only authored by them. */
  userId?: string;
  onScanCreated: (scanId: string) => void;
};

/**
 * Announce the finished study: write its activity trail, then update the scan
 * so the server sends the notifications.
 *
 * Both halves are needed and neither is optional bookkeeping. `notifyUser`
 * on the update is what reaches the GROUP LEADERS, and the owner's own email
 * and push are additionally gated on the scan having at least one entry in
 * `scanLogs` — create cannot carry those, because the logs reference a scan
 * that does not exist yet. Without this call a submitted study is announced to
 * nobody and opens with an empty Activity log.
 *
 * Never throws. The study exists and is submitted by the time this runs; a
 * failed announcement is not something the learner can act on, and turning it
 * into a submit failure would invite a second study for the same files.
 */
async function announce(
  client: ApiClient,
  scanId: string,
  state: DraftState,
  groupNames: readonly string[],
  userId: string,
  confirmed: number,
  unconfirmed: readonly string[],
): Promise<void> {
  try {
    const scanLogs = await createUserLogs(
      client,
      submitLogEntries({
        userId,
        scanTypeName: state.scanTypeName ?? '',
        files: state.files,
        confirmed,
        unconfirmed,
        groupNames,
        expertReviewLabel: state.expertReview?.label ?? null,
      }),
    );

    await updateScan(client, scanId, {
      status: statusAfterSubmit(confirmed, confirmed + unconfirmed.length),
      scanLogs,
      notifyUser: true,
    });
  } catch {
    // Deliberately swallowed: see above.
  }
}

export class NoStoredFilesError extends Error {
  constructor() {
    super('No files have finished uploading yet, so there is nothing to submit.');
    this.name = 'NoStoredFilesError';
  }
}

function storedFiles(files: DraftFile[]): DraftFile[] {
  return files.filter((file) => file.status === 'stored' && file.storageKey);
}

function toFilePayload(draftId: string, file: DraftFile): ScanFilePayload {
  return {
    batchId: draftId,
    filename: file.name,
    filesize: file.size,
    filetype: file.type,
    // The key the bytes really landed under. create() stores it verbatim.
    filepath: file.storageKey as string,
    originalFilename: file.name,
    // Registered as pending, then confirmed one by one below. Registering them
    // as completed up front would skip the fileCount bookkeeping that flips
    // the scan to `submitted`.
    status: 'pending',
  };
}

export async function submitDraft({
  client,
  state,
  groupIds,
  groupNames = [],
  userId = '',
  onScanCreated,
}: SubmitDraftInput): Promise<SubmitOutcome> {
  const ready = storedFiles(state.files);
  if (ready.length === 0) throw new NoStoredFilesError();
  if (!state.scanTypeId) throw new Error('Pick a scan type before submitting.');

  const files = ready.map((file) => toFilePayload(state.draftId, file));

  // Resume path: an earlier attempt already created the scan (the id is
  // persisted the instant create returns). Re-confirm against the ids the
  // server holds rather than creating a second study.
  if (state.scanId) {
    const scan = await getScanById(client, 'my', state.scanId);
    const fileIds = new Map(scan.files.map((file) => [file.filename, file.id]));

    const confirmation = await confirmFiles(client, state.scanId, ready, fileIds);
    const review = await requestReview(client, state.scanId, state);
    await announce(
      client,
      state.scanId,
      state,
      groupNames,
      userId,
      confirmation.confirmed,
      confirmation.unconfirmed.map((file) => file.name),
    );

    return {
      scanId: state.scanId,
      scanTitle: scan.title,
      filesConfirmed: confirmation.confirmed,
      filesTotal: ready.length,
      unconfirmed: confirmation.unconfirmed,
      expertReview: review.status,
      expertReviewError: review.error,
    };
  }

  const payload: CreateScanPayload = {
    scanTypeId: state.scanTypeId,
    fileTotal: files.length,
    findings: toFindingsPayload(state.findings),
    note: state.note || undefined,
    scanIdentifier: state.scanIdentifier || undefined,
    externalPatientId: state.externalPatientId || undefined,
    groupIds,
    notifyUser: false,
    files,
    fileDetails: files,
  };

  const created = await createScan(client, payload);
  onScanCreated(created.id);

  // Names line up because the wizard refuses duplicate filenames in one study.
  const fileIds = new Map(created.files.map((file) => [file.filename, file.id]));

  const confirmation = await confirmFiles(client, created.id, ready, fileIds);
  const review = await requestReview(client, created.id, state);
  await announce(
    client,
    created.id,
    state,
    groupNames,
    userId,
    confirmation.confirmed,
    confirmation.unconfirmed.map((file) => file.name),
  );

  return {
    scanId: created.id,
    scanTitle: created.title,
    filesConfirmed: confirmation.confirmed,
    filesTotal: ready.length,
    unconfirmed: confirmation.unconfirmed,
    expertReview: review.status,
    expertReviewError: review.error,
  };
}

/**
 * Mark each uploaded file `completed`.
 *
 * Confirmations run in parallel and are collected rather than thrown: one
 * file's confirmation failing does not make the other nine, or the study
 * itself, any less real. The caller reports exactly which ones did not land.
 */
async function confirmFiles(
  client: ApiClient,
  scanId: string,
  files: DraftFile[],
  fileIds: Map<string, string>,
): Promise<{ confirmed: number; unconfirmed: SubmitOutcome['unconfirmed'] }> {
  const unconfirmed: SubmitOutcome['unconfirmed'] = [];
  let confirmed = 0;

  await Promise.all(
    files.map(async (file) => {
      const fileId = fileIds.get(file.name);
      if (!fileId) {
        unconfirmed.push({
          name: file.name,
          message: 'The study has no record for this file.',
        });
        return;
      }

      try {
        // No `filepath` in the body: see updateFilePayloadSchema. Sending one
        // makes the server rebuild the key around the scan id, where nothing
        // exists, and answer 400.
        await updateScanFileStatus(client, fileId, { status: 'completed', scanId });
        // Best-effort mirror onto the fileDetails manifest the failed-upload
        // panel reads. Failing here does not make the file less uploaded, so
        // it must not fail the submit.
        await updateFileDetailsStatus(client, scanId, {
          filename: file.name,
          status: 'completed',
        }).catch(() => undefined);
        confirmed += 1;
      } catch (error) {
        unconfirmed.push({
          name: file.name,
          message: isApiError(error) ? error.message : 'The confirmation call failed.',
        });
      }
    }),
  );

  return { confirmed, unconfirmed };
}

async function requestReview(
  client: ApiClient,
  scanId: string,
  state: DraftState,
): Promise<{ status: SubmitOutcome['expertReview']; error: string | null }> {
  if (!state.expertReview) return { status: 'not-requested', error: null };

  try {
    await requestExpertScanReview(client, {
      scanId,
      type: state.expertReview.accountType === 'group' ? 'group' : 'user',
      typeId: state.expertReview.accountId,
    });
    return { status: 'requested', error: null };
  } catch (error) {
    // The scan is saved either way. Surfacing the server's own message matters:
    // "No group has pending scan reviews available" tells the user to buy
    // credits, where a generic failure would not.
    return {
      status: 'failed',
      error: isApiError(error) ? error.message : 'The expert review request did not go through.',
    };
  }
}
