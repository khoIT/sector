import { describe, expect, it } from 'vitest';

import type { DraftFile, DraftFileStatus } from './draft-types';
import { canAutoCollapseFiles, countStored, countTracked, trackedBytes } from './file-counts';

function file(status: DraftFileStatus, size = 1_000, id = `${status}-${size}`): DraftFile {
  return { id, name: `${id}.mp4`, size, type: 'video/mp4', status } as unknown as DraftFile;
}

describe('countTracked', () => {
  it('excludes rejected and cancelled files, so cleaning up never lowers the total', () => {
    expect(countTracked([file('stored'), file('rejected'), file('cancelled')])).toBe(1);
  });
});

describe('countStored', () => {
  it('counts only bytes confirmed in S3', () => {
    expect(countStored([file('stored'), file('uploading'), file('failed')])).toBe(1);
  });
});

describe('canAutoCollapseFiles', () => {
  it('collapses once every tracked file is safely stored', () => {
    expect(canAutoCollapseFiles([file('stored', 1), file('stored', 2)])).toBe(true);
  });

  it('stays open over a file that still needs attention', () => {
    // An area that folds itself shut over a failure is how a failure goes
    // unnoticed until submit.
    for (const status of ['validating', 'queued', 'uploading', 'failed', 'detached'] as const) {
      expect(canAutoCollapseFiles([file('stored', 1), file(status, 2)])).toBe(false);
    }
  });

  it('stays open on an empty study, where the drop zone is the whole point', () => {
    expect(canAutoCollapseFiles([])).toBe(false);
    expect(canAutoCollapseFiles([file('rejected')])).toBe(false);
  });
});

describe('trackedBytes', () => {
  it('sums what counts toward the study', () => {
    expect(trackedBytes([file('stored', 100), file('uploading', 250)])).toBe(350);
  });

  it('ignores what was rejected or cancelled', () => {
    expect(trackedBytes([file('stored', 100), file('rejected', 900), file('cancelled', 50)])).toBe(
      100,
    );
  });
});
