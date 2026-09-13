import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftFile } from './draft-types';

const createScan = vi.fn();
const addScanFiles = vi.fn();
const deleteScanFiles = vi.fn();
const getScanById = vi.fn();
const updateScan = vi.fn();
const updateScanFileStatus = vi.fn();
const updateFileDetailsStatus = vi.fn();
const createUserLogs = vi.fn();
const requestExpertScanReview = vi.fn();

vi.mock('@sector/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createScan: (...args: unknown[]) => createScan(...args),
    addScanFiles: (...args: unknown[]) => addScanFiles(...args),
    deleteScanFiles: (...args: unknown[]) => deleteScanFiles(...args),
    getScanById: (...args: unknown[]) => getScanById(...args),
    updateScan: (...args: unknown[]) => updateScan(...args),
    updateScanFileStatus: (...args: unknown[]) => updateScanFileStatus(...args),
    updateFileDetailsStatus: (...args: unknown[]) => updateFileDetailsStatus(...args),
    createUserLogs: (...args: unknown[]) => createUserLogs(...args),
    requestExpertScanReview: (...args: unknown[]) => requestExpertScanReview(...args),
  };
});

const { submitDraft } = await import('./submit-draft');
const { emptyDraftStateForTest } = await import('./test-support/draft-state-fixture');

const client = {} as never;

function draftFile(overrides: Partial<DraftFile>): DraftFile {
  return {
    id: overrides.id ?? 'file-1',
    name: overrides.name ?? 'clip.mp4',
    size: overrides.size ?? 1024,
    type: overrides.type ?? 'video/mp4',
    status: overrides.status ?? 'stored',
    progress: overrides.progress ?? 100,
    // Where the bytes really are. The resume path matches records to draft
    // files on exactly this, so a fixture that shares one key across two files
    // would be testing nothing.
    storageKey: overrides.storageKey ?? `storage/x/scan/draft/${overrides.name ?? 'clip.mp4'}`,
    confidence: overrides.confidence ?? 'verified',
    error: overrides.error ?? null,
    blob: overrides.blob ?? null,
  };
}

/** A File record as the scan detail route sends it. */
function scanRecord(overrides: {
  id: string;
  filename: string;
  filepath: string;
  status?: string;
}) {
  return { status: 'pending', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateScan.mockResolvedValue(undefined);
  updateScanFileStatus.mockResolvedValue(undefined);
  updateFileDetailsStatus.mockResolvedValue({ filename: 'clip.mp4', status: 'completed' });
  createUserLogs.mockResolvedValue(['log-1']);
  requestExpertScanReview.mockResolvedValue(undefined);
});

describe('submitDraft — fileTotal', () => {
  it('sends the number of files the learner intended, not only the ones that reached storage', async () => {
    // Reproduces the audit's "a partial submit records itself as complete":
    // one file is stored (ready to register), a second failed its transfer
    // and never reached S3. The study still intends 2 files.
    const state = emptyDraftStateForTest({
      files: [
        draftFile({ id: 'a', name: 'a.mp4', status: 'stored' }),
        draftFile({ id: 'b', name: 'b.mp4', status: 'failed' }),
      ],
      scanTypeId: 'type-1',
    });

    createScan.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      files: [{ id: 'file-a', filename: 'a.mp4' }],
    });

    await submitDraft({ client, state, groupIds: [], onScanCreated: () => undefined });

    expect(createScan).toHaveBeenCalledTimes(1);
    const payload = createScan.mock.calls[0]?.[1] as { fileTotal: number };
    // Only 1 of the 2 intended files is registered in `files`, but fileTotal
    // must still say 2 — that mismatch is what the server and the UI use to
    // know the study is short a file.
    expect(payload.fileTotal).toBe(2);
  });

  it('reports the true intended total on the outcome, not the stored-file count', async () => {
    const state = emptyDraftStateForTest({
      files: [
        draftFile({ id: 'a', name: 'a.mp4', status: 'stored' }),
        draftFile({ id: 'b', name: 'b.mp4', status: 'failed' }),
      ],
      scanTypeId: 'type-1',
    });

    createScan.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      files: [{ id: 'file-a', filename: 'a.mp4' }],
    });

    const outcome = await submitDraft({
      client,
      state,
      groupIds: [],
      onScanCreated: () => undefined,
    });

    expect(outcome.filesTotal).toBe(2);
    expect(outcome.filesConfirmed).toBe(1);
  });
});

describe('submitDraft — resuming an already-created scan', () => {
  it('never creates a second scan once state.scanId is set', async () => {
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      files: [draftFile({ id: 'a', name: 'a.mp4', status: 'stored' })],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 1,
      tags: [],
      files: [
        scanRecord({ id: 'file-a', filename: 'a.mp4', filepath: 'storage/x/scan/draft/a.mp4' }),
      ],
    });

    const outcome = await submitDraft({
      client,
      state,
      groupIds: [],
      onScanCreated: () => undefined,
    });

    expect(createScan).not.toHaveBeenCalled();
    expect(getScanById).toHaveBeenCalledWith(client, 'my', 'scan-1');
    expect(outcome.scanId).toBe('scan-1');
  });

  it('does not re-issue an expert review request the scan already carries', async () => {
    // Reproduces the audit's "a resumed submit re-issues the expert-review
    // request with no record it already succeeded": the scan is already
    // tagged from a first, partially-failed attempt.
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      expertReview: { accountType: 'user', accountId: 'user-1', label: 'Me' },
      files: [draftFile({ id: 'a', name: 'a.mp4', status: 'stored' })],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 1,
      tags: ['expert_scan_review'],
      files: [
        scanRecord({ id: 'file-a', filename: 'a.mp4', filepath: 'storage/x/scan/draft/a.mp4' }),
      ],
    });

    const outcome = await submitDraft({
      client,
      state,
      groupIds: [],
      onScanCreated: () => undefined,
    });

    expect(requestExpertScanReview).not.toHaveBeenCalled();
    expect(outcome.expertReview).toBe('requested');
  });

  it('still requests the review on resume when the scan has not been tagged yet', async () => {
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      expertReview: { accountType: 'user', accountId: 'user-1', label: 'Me' },
      files: [draftFile({ id: 'a', name: 'a.mp4', status: 'stored' })],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 1,
      tags: [],
      files: [
        scanRecord({ id: 'file-a', filename: 'a.mp4', filepath: 'storage/x/scan/draft/a.mp4' }),
      ],
    });

    await submitDraft({ client, state, groupIds: [], onScanCreated: () => undefined });

    expect(requestExpertScanReview).toHaveBeenCalledTimes(1);
  });

  it('touches no file routes when every record already points at the uploaded bytes', async () => {
    // The ordinary resume — a confirmation that failed, nothing else. The
    // records were stored verbatim by create, so there is nothing to
    // reconcile and reconciliation must stay out of the way.
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      files: [draftFile({ id: 'a', name: 'a.mp4', status: 'stored' })],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 1,
      tags: [],
      files: [
        scanRecord({ id: 'file-a', filename: 'a.mp4', filepath: 'storage/x/scan/draft/a.mp4' }),
      ],
    });

    const outcome = await submitDraft({
      client,
      state,
      groupIds: [],
      onScanCreated: () => undefined,
    });

    expect(addScanFiles).not.toHaveBeenCalled();
    expect(deleteScanFiles).not.toHaveBeenCalled();
    expect(updateScanFileStatus).toHaveBeenCalledWith(client, 'file-a', {
      status: 'completed',
      scanId: 'scan-1',
    });
    expect(outcome.filesConfirmed).toBe(1);
    expect(outcome.filesTotal).toBe(1);
  });
});

describe('submitDraft — recovering a study that was reset for re-upload', () => {
  /**
   * The reset case end to end, in the shape the server actually leaves behind:
   * the scan still holds a record per file of the failed attempt, under THAT
   * attempt's key, and the learner has re-uploaded under the scan's own prefix.
   */
  function resetScenario() {
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      files: [
        draftFile({
          id: 'a',
          name: 'a.mp4',
          status: 'stored',
          storageKey: 'storage/x/scan/scan-1/a.mp4',
        }),
      ],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 1,
      tags: [],
      files: [
        scanRecord({
          id: 'stale-a',
          filename: 'a.mp4',
          filepath: 'storage/x/scan/old-draft/a.mp4',
          status: 'failed',
        }),
      ],
    });

    deleteScanFiles.mockResolvedValue({ fileTotal: 0, files: [] });
    addScanFiles.mockResolvedValue({
      fileTotal: 1,
      files: [{ id: 'file-new-a', filename: 'a.mp4', filepath: 'storage/x/scan/scan-1/a.mp4' }],
    });

    return state;
  }

  it('drops the record of the attempt whose bytes never landed', async () => {
    // Matching by FILENAME finds `stale-a`, whose object was never written.
    // Confirming it makes the server verify that path and 400, which is what
    // left every file reported as "uploaded but not attached".
    await submitDraft({
      client,
      state: resetScenario(),
      groupIds: [],
      onScanCreated: () => undefined,
    });

    expect(deleteScanFiles).toHaveBeenCalledWith(client, 'scan-1', ['stale-a']);
  });

  it('registers the re-uploaded file and confirms the NEW record, not the stale one', async () => {
    const outcome = await submitDraft({
      client,
      state: resetScenario(),
      groupIds: [],
      onScanCreated: () => undefined,
    });

    expect(addScanFiles).toHaveBeenCalledWith(client, 'scan-1', [
      expect.objectContaining({
        filename: 'a.mp4',
        filepath: 'storage/x/scan/scan-1/a.mp4',
        // Pending, so the confirmation below can still increment fileCount:
        // updateFileById guards that on the record not already being complete.
        status: 'pending',
      }),
    ]);
    expect(updateScanFileStatus).toHaveBeenCalledWith(client, 'file-new-a', {
      status: 'completed',
      scanId: 'scan-1',
    });
    expect(updateScanFileStatus).not.toHaveBeenCalledWith(client, 'stale-a', expect.anything());
    expect(outcome.unconfirmed).toEqual([]);
  });

  it('reports the fileTotal the server ended up with, not the one it started with', async () => {
    // Both routes move fileTotal — delete decrements, add increments — and
    // whether the draft is destroyed hangs on this number.
    const outcome = await submitDraft({
      client,
      state: resetScenario(),
      groupIds: [],
      onScanCreated: () => undefined,
    });

    expect(outcome.filesTotal).toBe(1);
    expect(outcome.filesConfirmed).toBe(1);
  });

  it('leaves a legacy record with no status alone rather than deleting it', async () => {
    // `File.status` was added in Feb 2026 and more than half the File
    // documents in production predate it. Absence means the upload arrived —
    // the same rule the server applies in scan-completeness.ts — so reading it
    // as "never landed" would hard-delete files the learner still has.
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      files: [
        draftFile({
          id: 'b',
          name: 'b.mp4',
          status: 'stored',
          storageKey: 'storage/x/scan/scan-1/b.mp4',
        }),
      ],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 1,
      tags: [],
      files: [
        // A legacy upload: elsewhere, and no status at all.
        { id: 'legacy-a', filename: 'a.mp4', filepath: 'storage/x/scan/old/a.mp4' },
      ],
    });
    addScanFiles.mockResolvedValue({
      fileTotal: 2,
      files: [{ id: 'file-b', filename: 'b.mp4', filepath: 'storage/x/scan/scan-1/b.mp4' }],
    });

    await submitDraft({ client, state, groupIds: [], onScanCreated: () => undefined });

    expect(deleteScanFiles).not.toHaveBeenCalled();
  });

  it('leaves a completed record elsewhere alone — it is a file the learner still has', async () => {
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      files: [
        draftFile({
          id: 'b',
          name: 'b.mp4',
          status: 'stored',
          storageKey: 'storage/x/scan/scan-1/b.mp4',
        }),
      ],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 1,
      tags: [],
      files: [
        scanRecord({
          id: 'kept-a',
          filename: 'a.mp4',
          filepath: 'storage/x/scan/old/a.mp4',
          status: 'completed',
        }),
      ],
    });
    addScanFiles.mockResolvedValue({
      fileTotal: 2,
      files: [{ id: 'file-b', filename: 'b.mp4', filepath: 'storage/x/scan/scan-1/b.mp4' }],
    });

    await submitDraft({ client, state, groupIds: [], onScanCreated: () => undefined });

    expect(deleteScanFiles).not.toHaveBeenCalled();
  });

  it('registers a file added after the scan row existed instead of orphaning it', async () => {
    // The audit's other half: a file that reached storage only after `create`
    // had already run has no record, and used to be reported as "the study has
    // no record for this file" with its bytes stranded in S3 forever.
    const state = emptyDraftStateForTest({
      scanId: 'scan-1',
      scanTypeId: 'type-1',
      files: [
        draftFile({
          id: 'a',
          name: 'a.mp4',
          status: 'stored',
          storageKey: 'storage/x/scan/draft/a.mp4',
        }),
        draftFile({
          id: 'b',
          name: 'b.mp4',
          status: 'stored',
          storageKey: 'storage/x/scan/scan-1/b.mp4',
        }),
      ],
    });

    getScanById.mockResolvedValue({
      id: 'scan-1',
      title: 'Study-1',
      fileTotal: 2,
      tags: [],
      files: [
        scanRecord({ id: 'file-a', filename: 'a.mp4', filepath: 'storage/x/scan/draft/a.mp4' }),
      ],
    });
    addScanFiles.mockResolvedValue({
      fileTotal: 2,
      files: [{ id: 'file-b', filename: 'b.mp4', filepath: 'storage/x/scan/scan-1/b.mp4' }],
    });

    const outcome = await submitDraft({
      client,
      state,
      groupIds: [],
      onScanCreated: () => undefined,
    });

    // `file-a` already pointed at its bytes, so it is left alone.
    expect(deleteScanFiles).not.toHaveBeenCalled();
    expect(addScanFiles).toHaveBeenCalledWith(client, 'scan-1', [
      expect.objectContaining({ filename: 'b.mp4' }),
    ]);
    expect(outcome.filesConfirmed).toBe(2);
    expect(outcome.unconfirmed).toEqual([]);
  });
});
