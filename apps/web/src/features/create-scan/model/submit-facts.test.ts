import { describe, expect, it } from 'vitest';

import { submitFacts, type SubmitFactsInput } from './submit-facts';

function input(overrides: Partial<SubmitFactsInput> = {}): SubmitFactsInput {
  return {
    scanTypeName: 'AAA',
    stored: 3,
    tracked: 3,
    answered: 5,
    definitions: 5,
    missingRequired: 0,
    groupNames: ['Class of 2029'],
    expertReviewLabel: null,
    ...overrides,
  };
}

function valueOf(facts: ReturnType<typeof submitFacts>, label: string) {
  return facts.find((fact) => fact.label === label);
}

describe('submitFacts', () => {
  it('lists every fact, in the order the study was built', () => {
    expect(submitFacts(input()).map((fact) => fact.label)).toEqual([
      'Scan type',
      'Files',
      'Findings',
      'Shared with',
      'Expert review',
    ]);
  });

  it('flags nothing when the study is complete', () => {
    expect(submitFacts(input()).some((fact) => fact.concerning)).toBe(false);
  });

  describe('files', () => {
    it('counts what is in storage', () => {
      expect(valueOf(submitFacts(input()), 'Files')).toEqual({
        label: 'Files',
        value: '3 in storage',
      });
    });

    it('names the shortfall rather than the optimistic total', () => {
      // "3 files" over a study where one upload failed is the most expensive
      // thing this dialog could say.
      expect(valueOf(submitFacts(input({ stored: 2, tracked: 3 })), 'Files')).toEqual({
        label: 'Files',
        value: '2 of 3 — the rest will be left out',
        concerning: true,
      });
    });

    it('is explicit when nothing has landed yet', () => {
      expect(valueOf(submitFacts(input({ stored: 0, tracked: 2 })), 'Files')).toEqual({
        label: 'Files',
        value: 'None of 2 in storage yet',
        concerning: true,
      });
    });

    it('is explicit when no file was ever added', () => {
      expect(valueOf(submitFacts(input({ stored: 0, tracked: 0 })), 'Files')).toEqual({
        label: 'Files',
        value: 'None',
        concerning: true,
      });
    });
  });

  describe('findings', () => {
    it('counts answered against declared', () => {
      expect(valueOf(submitFacts(input({ answered: 3, definitions: 5 })), 'Findings')).toEqual({
        label: 'Findings',
        value: '3 of 5 answered',
      });
    });

    it('names required rows left blank, and flags them', () => {
      expect(
        valueOf(
          submitFacts(input({ answered: 3, definitions: 5, missingRequired: 2 })),
          'Findings',
        ),
      ).toEqual({
        label: 'Findings',
        value: '3 of 5 answered · 2 required still blank',
        concerning: true,
      });
    });

    it('does not flag a scan type that declares no findings', () => {
      expect(valueOf(submitFacts(input({ answered: 0, definitions: 0 })), 'Findings')).toEqual({
        label: 'Findings',
        value: 'None for this scan type',
      });
    });
  });

  describe('groups', () => {
    it('names them, because routing cannot be changed afterwards', () => {
      expect(valueOf(submitFacts(input({ groupNames: ['A', 'B'] })), 'Shared with')).toEqual({
        label: 'Shared with',
        value: 'A, B',
      });
    });

    // "No group reviewer" rather than "nobody": named people can still be
    // added afterwards and an expert review reaches a GUSI reviewer. The group
    // routing is the part no route can repair.
    it('flags a study no group reviewer will see', () => {
      expect(valueOf(submitFacts(input({ groupNames: [] })), 'Shared with')).toEqual({
        label: 'Shared with',
        value: 'No group — no group reviewer',
        concerning: true,
      });
    });
  });

  describe('scan type', () => {
    it('flags a missing type', () => {
      expect(valueOf(submitFacts(input({ scanTypeName: null })), 'Scan type')).toEqual({
        label: 'Scan type',
        value: 'Not chosen',
        concerning: true,
      });
    });
  });

  describe('expert review', () => {
    it('names the credit source when one was chosen', () => {
      expect(
        valueOf(
          submitFacts(input({ expertReviewLabel: 'Demo Learner · 2 credits' })),
          'Expert review',
        ),
      ).toEqual({ label: 'Expert review', value: 'Demo Learner · 2 credits' });
    });

    it('is not a problem when it was not requested', () => {
      expect(valueOf(submitFacts(input()), 'Expert review')).toEqual({
        label: 'Expert review',
        value: 'Not requested',
      });
    });
  });
});
