import { describe, expect, it } from 'vitest';

import { parsePersistedDraft } from './draft-storage';

/**
 * A draft exactly as the four-step build wrote it, including a retired step
 * value. Reproduced in full rather than built from a factory: the point of the
 * test is that a REAL pre-migration payload still loads, and a factory built
 * from today's types could not express the old shape.
 */
function preMigrationDraft(step: string) {
  return {
    version: 1,
    savedAt: Date.now(),
    draftId: '6aa42b45e7e36ea28c4e73d9',
    step,
    files: [
      {
        id: 'f1',
        name: 'AAA-long.mp4',
        size: 4_211_004,
        type: 'video/mp4',
        storageKey: 'storage/6aa4/scan/abc/AAA-long.mp4',
        confidence: 'verified',
      },
    ],
    scanTypeId: '69e7d0456d1cfa1d40770e06',
    scanTypeName: 'AAA',
    organizationId: '68d3449adbae8462f01f68e5',
    findings: { v5_aaa_long_lvl1: '≤ 3cm' },
    note: 'Poor window, obese habitus.',
    scanIdentifier: 'SESSION-4',
    externalPatientId: '',
    groupIds: ['g1'],
    expertReview: null,
    scanId: null,
  };
}

describe('parsePersistedDraft — the step a draft was saved on', () => {
  it.each(['files', 'interpretation', 'routing'])(
    'keeps the classic %s step, for a browser set to the classic flow',
    (step) => {
      // These were retired once and are live again as the classic flow's
      // steps, so the parse must hand them back rather than rewriting them.
      // Mapping a step into the flow that is actually rendering belongs to
      // stepForFlow, which knows which flow that is; this layer does not.
      const draft = parsePersistedDraft(preMigrationDraft(step));

      expect(draft).not.toBeNull();
      expect(draft?.step).toBe(step);
      // Everything else has to survive intact — a step it cannot place must
      // never cost the learner the study.
      expect(draft?.findings).toEqual({ v5_aaa_long_lvl1: '≤ 3cm' });
      expect(draft?.files).toHaveLength(1);
      expect(draft?.note).toBe('Poor window, obese habitus.');
      expect(draft?.groupIds).toEqual(['g1']);
    },
  );

  it('keeps a submitted draft on the receipt, never back on the working surface', () => {
    // A draft parked here has a scan id; showing it the working surface again
    // would invite a second submission of the same study.
    expect(parsePersistedDraft(preMigrationDraft('submitted'))?.step).toBe('submitted');
  });

  it('keeps the current step values', () => {
    expect(parsePersistedDraft(preMigrationDraft('study'))?.step).toBe('study');
    expect(parsePersistedDraft(preMigrationDraft('submit'))?.step).toBe('submit');
  });

  it('falls back rather than rejecting a payload with an unknown step', () => {
    expect(parsePersistedDraft(preMigrationDraft('some-future-step'))?.step).toBe('study');
    expect(parsePersistedDraft(preMigrationDraft(''))?.step).toBe('study');
  });

  it('still rejects a payload that is genuinely not a draft', () => {
    expect(parsePersistedDraft({ version: 1 })).toBeNull();
    expect(parsePersistedDraft(null)).toBeNull();
    expect(parsePersistedDraft({ ...preMigrationDraft('study'), draftId: 'not-a-draft-id' })).toBeNull();
  });
});
