import { describe, expect, it } from 'vitest';

import type { UserLogEntry } from '@sector/api-client';

import type { DraftFile } from './draft-types';
import { statusAfterSubmit, submitLogEntries } from './submit-logs';

/** Indexing with a thrown miss, so a short list fails here and not two lines on. */
function at(entries: UserLogEntry[], index: number): UserLogEntry {
  const entry = entries[index];
  if (!entry) throw new Error(`no entry at ${index} in ${entries.length}`);
  return entry;
}

function file(name: string, size: number, status: DraftFile['status'] = 'stored'): DraftFile {
  return {
    id: name,
    name,
    size,
    type: 'image/jpeg',
    status,
    progress: status === 'stored' ? 100 : 0,
    storageKey: status === 'stored' ? `drafts/d1/${name}` : null,
    confidence: null,
    error: null,
  } as DraftFile;
}

const base = {
  userId: 'u1',
  scanTypeName: 'AAA',
  files: [file('a.jpg', 100), file('b.jpg', 200)],
  confirmed: 2,
  unconfirmed: [] as string[],
  groupNames: ['Class of 2029'],
  expertReviewLabel: null,
};

describe('statusAfterSubmit', () => {
  it('is submitted when every file was confirmed', () => {
    expect(statusAfterSubmit(2, 2)).toBe('submitted');
  });

  it('is partially uploaded when some file was left behind', () => {
    expect(statusAfterSubmit(1, 2)).toBe('partially_uploaded');
  });

  // Not reachable through the UI - submit refuses an empty study - but the
  // status must not read `submitted` if it ever were.
  it('is partially uploaded when nothing was confirmed', () => {
    expect(statusAfterSubmit(0, 2)).toBe('partially_uploaded');
  });
});

describe('submitLogEntries', () => {
  it('records the upload and the submission', () => {
    const entries = submitLogEntries(base);
    expect(entries.map((entry) => entry.action)).toEqual(['scan.files.uploaded', 'scan.submit']);
    expect(at(entries, 0).message).toBe('2 files uploaded (300 bytes)');
    expect(at(entries, 1).message).toBe('Study submitted with 2 files');
    expect(entries.every((entry) => entry.severity === 'info')).toBe(true);
  });

  // The submitted record counts only what was submitted, so without this entry
  // a study short of what the learner meant to send reads as complete forever.
  it('records the files that were added but never uploaded', () => {
    const entries = submitLogEntries({
      ...base,
      files: [...base.files, file('c.jpg', 999, 'failed'), file('d.jpg', 5, 'rejected')],
    });
    expect(entries.map((entry) => entry.action)).toEqual([
      'scan.files.uploaded',
      'scan.files.left_behind',
      'scan.submit',
    ]);
    expect(at(entries, 1).message).toContain('c.jpg, d.jpg');
    expect(at(entries, 1).severity).toBe('warning');
  });

  it('counts only the files that reached storage', () => {
    const entries = submitLogEntries({
      ...base,
      files: [...base.files, file('c.jpg', 999, 'failed')],
    });
    expect(at(entries, 0).details?.fileCount).toBe(2);
    expect(at(entries, 0).details?.totalSizeBytes).toBe(300);
  });

  it('singularises one file', () => {
    const entries = submitLogEntries({ ...base, files: [file('a.jpg', 5)], confirmed: 1 });
    expect(at(entries, 0).message).toBe('1 file uploaded (5 bytes)');
    expect(at(entries, 1).message).toBe('Study submitted with 1 file');
  });

  // The learner has to be able to tell WHICH file did not make it; a count
  // leaves them to work it out from a list they can no longer see.
  it('names every unconfirmed file and warns on the submission entry', () => {
    const entries = submitLogEntries({ ...base, confirmed: 1, unconfirmed: ['b.jpg'] });
    expect(entries.map((entry) => entry.action)).toEqual([
      'scan.files.uploaded',
      'scan.file.confirm_failed',
      'scan.submit',
    ]);
    expect(at(entries, 1).message).toContain('b.jpg');
    expect(at(entries, 1).severity).toBe('warning');
    expect(at(entries, 2).severity).toBe('warning');
    expect(at(entries, 2).message).toBe('Study submitted with 1 of 2 files');
  });

  it('carries the routing and the review onto the submission entry', () => {
    const entries = submitLogEntries({ ...base, expertReviewLabel: 'Expert review' });
    expect(at(entries, 1).details?.groups).toEqual(['Class of 2029']);
    expect(at(entries, 1).details?.expertReview).toBe('Expert review');
    expect(at(entries, 1).details?.scanType).toBe('AAA');
  });

  it('attributes every entry to the submitting user', () => {
    expect(submitLogEntries(base).every((entry) => entry.user === 'u1')).toBe(true);
  });

  // A blank id is not an object id: sending it 400s the whole batch, which
  // would cost the trail AND the notification it gates.
  it('omits the subject rather than sending a blank one', () => {
    const entries = submitLogEntries({ ...base, userId: '' });
    expect(entries.every((entry) => !('user' in entry))).toBe(true);
  });
});
