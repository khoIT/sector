import type { DraftState } from './draft-types';
import { countStored, countTracked } from './file-counts';

/**
 * What a draft would lose if it were discarded, in the user's terms.
 *
 * Kept out of the dialog so it can be tested: the web package's vitest runs in
 * a node environment over `src/**\/*.test.ts` and cannot render a `.tsx`.
 *
 * Every line names something the learner did, never an internal field. A draft
 * with no lines is a draft with nothing to lose, which is also the signal the
 * page uses to decide whether the discard control is worth offering.
 */
export function draftHoldings(state: DraftState): string[] {
  const holdings: string[] = [];

  const stored = countStored(state.files);
  const tracked = countTracked(state.files);
  if (tracked > 0) {
    holdings.push(
      stored === tracked
        ? `${tracked} file${tracked === 1 ? '' : 's'} in storage`
        : `${tracked} file${tracked === 1 ? '' : 's'}, ${stored} already in storage`,
    );
  }

  if (state.scanTypeName) holdings.push(`Scan type: ${state.scanTypeName}`);

  const answered = Object.values(state.findings).filter((value) => value.trim()).length;
  if (answered > 0) holdings.push(`${answered} finding${answered === 1 ? '' : 's'} answered`);

  if (state.note.trim()) holdings.push('A clinical note');
  if (state.externalPatientId?.trim()) holdings.push('An external patient ID');
  if (state.scanIdentifier?.trim()) holdings.push('A scan identifier');
  if (state.expertReview) holdings.push('An expert review request');

  return holdings;
}
