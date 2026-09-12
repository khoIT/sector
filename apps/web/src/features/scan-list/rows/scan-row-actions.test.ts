import { describe, expect, it } from 'vitest';

import { isRowActionDisabled, rowActionsFor, type RowActionContext } from './scan-row-actions';

const base: RowActionContext = {
  view: 'my',
  isOwnScan: true,
  hasFiles: true,
  canReadNotes: true,
  canDelete: true,
};

describe('rowActionsFor', () => {
  it('gives My Scans every action', () => {
    expect(rowActionsFor(base)).toEqual(['open', 'share', 'download', 'comment', 'delete']);
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
