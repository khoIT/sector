import { describe, expect, it } from 'vitest';

import type { DraftFile, DraftState } from './draft-types';
import { draftHoldings } from './draft-holdings';

function file(name: string, status: DraftFile['status'] = 'stored'): DraftFile {
  return {
    id: name,
    name,
    size: 10,
    type: 'image/jpeg',
    status,
    progress: status === 'stored' ? 100 : 0,
    storageKey: status === 'stored' ? `drafts/d1/${name}` : null,
    confidence: null,
    error: null,
  } as DraftFile;
}

function draft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    draftId: 'd1',
    step: 'study',
    files: [],
    scanTypeId: null,
    scanTypeName: null,
    organizationId: null,
    findings: {},
    note: '',
    externalPatientId: '',
    scanIdentifier: '',
    groupIds: null,
    expertReview: null,
    scanId: null,
    submitOutcome: null,
    ...overrides,
  } as DraftState;
}

describe('draftHoldings', () => {
  it('is empty for an untouched draft, which is what hides the discard control', () => {
    expect(draftHoldings(draft())).toEqual([]);
  });

  // The control used to be gated on files alone, so this draft — the one a
  // learner most wants to throw away — had no way to be discarded.
  it('reports a draft that has answers but no file', () => {
    expect(
      draftHoldings(draft({ scanTypeName: 'AAA', findings: { a: 'Present', b: '' }, note: 'hi' })),
    ).toEqual(['Scan type: AAA', '1 finding answered', 'A clinical note']);
  });

  it('separates files still moving from files in storage', () => {
    expect(draftHoldings(draft({ files: [file('a.jpg'), file('b.jpg', 'uploading')] }))[0]).toBe(
      '2 files, 1 already in storage',
    );
  });

  it('says so plainly when every file is up', () => {
    expect(draftHoldings(draft({ files: [file('a.jpg')] }))[0]).toBe('1 file in storage');
  });

  it('counts only answered findings', () => {
    expect(draftHoldings(draft({ findings: { a: '', b: '  ' } }))).toEqual([]);
  });

  it('names the identifiers and the review request', () => {
    expect(
      draftHoldings(
        draft({
          externalPatientId: 'P-1',
          scanIdentifier: 'S-1',
          expertReview: { label: 'Expert review', accountType: 'user', accountId: 'u1' },
        } as Partial<DraftState>),
      ),
    ).toEqual(['An external patient ID', 'A scan identifier', 'An expert review request']);
  });
});
