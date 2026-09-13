import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftFile } from './draft-types';

const createScan = vi.fn();
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
    storageKey: overrides.storageKey ?? 'storage/x/scan/draft/clip.mp4',
    confidence: overrides.confidence ?? 'verified',
    error: overrides.error ?? null,
    blob: overrides.blob ?? null,
  };
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
      files: [{ id: 'file-a', filename: 'a.mp4' }],
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
      files: [{ id: 'file-a', filename: 'a.mp4' }],
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
      files: [{ id: 'file-a', filename: 'a.mp4' }],
    });

    await submitDraft({ client, state, groupIds: [], onScanCreated: () => undefined });

    expect(requestExpertScanReview).toHaveBeenCalledTimes(1);
  });
});
