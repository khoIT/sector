import type { DraftState } from '../draft-types';

/**
 * A minimal, valid `DraftState` for tests, with only what a test cares about
 * overridden.
 *
 * `DraftState` carries every field the whole wizard touches; requiring each
 * test to spell all of them out is how a model change stops being reflected
 * in its own tests. Kept beside the model rather than inside one test file so
 * every model test shares one definition of "an empty draft".
 */
export function emptyDraftStateForTest(overrides: Partial<DraftState> = {}): DraftState {
  return {
    draftId: 'draft-1',
    step: 'study',
    files: [],
    scanTypeId: null,
    scanTypeName: null,
    organizationId: null,
    findings: {},
    note: '',
    scanIdentifier: '',
    externalPatientId: '',
    groupIds: null,
    expertReview: null,
    scanId: null,
    submitOutcome: null,
    ...overrides,
  };
}
