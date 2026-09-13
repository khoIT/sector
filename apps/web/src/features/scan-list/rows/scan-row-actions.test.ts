import { describe, expect, it } from 'vitest';

import { isRowActionDisabled, rowActionsFor, type RowActionContext } from './scan-row-actions';

const base: RowActionContext = {
  view: 'my',
  isOwnScan: true,
  hasFiles: true,
  canReadNotes: true,
  canDelete: true,
  canEditScan: true,
  status: 'submitted',
  tags: [],
};

describe('rowActionsFor', () => {
  it('gives My Scans every owner action, but never the reviewer completeness ones', () => {
    expect(rowActionsFor(base)).toEqual([
      'open',
      'share',
      'download',
      'comment',
      'request-expert-review',
      'delete',
    ]);
  });

  it('offers reset-upload on My Scans only when the status allows it', () => {
    expect(rowActionsFor({ ...base, status: 'failed' })).toContain('reset-upload');
    expect(rowActionsFor({ ...base, status: 'failed_upload' })).toContain('reset-upload');
    expect(rowActionsFor({ ...base, status: 'submitted' })).not.toContain('reset-upload');
    // The server 400s a partially_uploaded scan — offering it there would
    // just fail the request.
    expect(rowActionsFor({ ...base, status: 'partially_uploaded' })).not.toContain('reset-upload');
  });

  it('withholds reset-upload without edit:scan, which the route requires', () => {
    const actions = rowActionsFor({ ...base, status: 'failed', canEditScan: false });
    expect(actions).not.toContain('reset-upload');
  });

  it('offers request-expert-review only on a submitted study', () => {
    // A credit spent on a study that holds no files is spent, and the
    // server's duplicate-purchase check then refuses the request forever —
    // so the learner cannot re-issue it after recovering the upload.
    expect(rowActionsFor({ ...base, status: 'submitted' })).toContain('request-expert-review');
    for (const status of ['pending', 'failed', 'failed_upload', 'partially_uploaded'] as const) {
      expect(rowActionsFor({ ...base, status })).not.toContain('request-expert-review');
    }
  });

  it('never offers reset-upload or request-expert-review outside My Scans', () => {
    for (const view of ['pending', 'reviewed', 'expert', 'expert-reviewed'] as const) {
      const actions = rowActionsFor({ ...base, view, isOwnScan: false, status: 'failed' });
      expect(actions).not.toContain('reset-upload');
      expect(actions).not.toContain('request-expert-review');
    }
  });

  it('offers mark-complete/incomplete on the queue and reviewed lists for edit:scan', () => {
    for (const view of ['pending', 'reviewed', 'expert', 'expert-reviewed'] as const) {
      const actions = rowActionsFor({ ...base, view, isOwnScan: false });
      expect(actions).toContain('mark-complete');
      expect(actions).toContain('mark-incomplete');
    }
  });

  it('withholds the completeness actions without edit:scan', () => {
    const actions = rowActionsFor({
      ...base,
      view: 'pending',
      isOwnScan: false,
      canEditScan: false,
    });
    expect(actions).not.toContain('mark-complete');
    expect(actions).not.toContain('mark-incomplete');
  });

  it('hides mark-complete once the scan already carries it, and the reverse for incomplete', () => {
    const complete = rowActionsFor({
      ...base,
      view: 'pending',
      isOwnScan: false,
      tags: ['complete'],
    });
    expect(complete).not.toContain('mark-complete');
    expect(complete).toContain('mark-incomplete');

    const incomplete = rowActionsFor({
      ...base,
      view: 'pending',
      isOwnScan: false,
      tags: ['incomplete'],
    });
    expect(incomplete).not.toContain('mark-incomplete');
    expect(incomplete).toContain('mark-complete');
  });

  it('never offers mark-complete/incomplete on My Scans or Shared Scans', () => {
    expect(rowActionsFor(base)).not.toContain('mark-complete');
    expect(rowActionsFor({ ...base, view: 'shared', isOwnScan: false })).not.toContain(
      'mark-complete',
    );
  });

  it('never offers share or delete on a scan shared with you', () => {
    const actions = rowActionsFor({ ...base, view: 'shared', isOwnScan: false });
    expect(actions).toEqual(['open', 'download', 'comment']);
  });

  it('offers no delete on another learner’s queue row, which legacy does offer', () => {
    for (const view of ['pending', 'reviewed', 'expert', 'expert-reviewed'] as const) {
      const actions = rowActionsFor({ ...base, view, isOwnScan: false });
      expect(actions).not.toContain('delete');
      expect(actions).toContain('share');
      expect(actions).toContain('download');
    }
  });

  it('offers delete on a reviewer’s own scan sitting in the group queue', () => {
    expect(rowActionsFor({ ...base, view: 'pending', isOwnScan: true })).toContain('delete');
  });

  it('withholds delete from an owner whose role lacks the permission', () => {
    expect(rowActionsFor({ ...base, canDelete: false })).not.toContain('delete');
  });

  it('withholds comment without read:scan:note, which is permissioned separately', () => {
    expect(rowActionsFor({ ...base, canReadNotes: false })).not.toContain('comment');
  });

  it('still lists download for a scan with no files, so it can explain itself', () => {
    expect(rowActionsFor({ ...base, hasFiles: false })).toContain('download');
  });
});

describe('isRowActionDisabled', () => {
  it('disables only download, and only with nothing to fetch', () => {
    expect(isRowActionDisabled('download', { hasFiles: false })).toBe(true);
    expect(isRowActionDisabled('download', { hasFiles: true })).toBe(false);
    expect(isRowActionDisabled('share', { hasFiles: false })).toBe(false);
    expect(isRowActionDisabled('delete', { hasFiles: false })).toBe(false);
  });
});

describe('isRowActionDisabled', () => {
  it('disables download on a scan with nothing to fetch, and leaves it listed', () => {
    expect(isRowActionDisabled('download', { hasFiles: false })).toBe(true);
    expect(isRowActionDisabled('download', { hasFiles: true })).toBe(false);
  });

  it('disables the completeness actions while one is in flight', () => {
    // The server writes tags with $push and de-duplicates nothing, and the
    // row's `tags` are a cached copy that only refreshes on invalidation — so
    // a second click before then pushes the same tag twice.
    for (const action of ['mark-complete', 'mark-incomplete'] as const) {
      expect(isRowActionDisabled(action, { hasFiles: true, settingCompletion: true })).toBe(true);
      expect(isRowActionDisabled(action, { hasFiles: true, settingCompletion: false })).toBe(false);
      expect(isRowActionDisabled(action, { hasFiles: true })).toBe(false);
    }
  });

  it('leaves every other action enabled', () => {
    for (const action of ['open', 'share', 'comment', 'delete', 'reset-upload'] as const) {
      expect(isRowActionDisabled(action, { hasFiles: false, settingCompletion: true })).toBe(false);
    }
  });
});
