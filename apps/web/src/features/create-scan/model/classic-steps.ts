import { CLASSIC_STEPS, type DraftState, type WizardStep } from './draft-types';
import { countTracked } from './file-counts';

/**
 * Which classic step a draft may move to.
 *
 * ONE predicate, used by both the stepper and the Next buttons. The four-step
 * build had two that disagreed: the stepper allowed a jump on
 * `files.length > 0` while Next required `countTracked(files) > 0`, so a study
 * whose only file had been cancelled could go forward but could not be jumped
 * back to — and the stepper additionally demanded a stored file to reach
 * routing, which Next did not. Two rules for one question is how a wizard
 * starts disagreeing with itself.
 *
 * The gates are deliberately weak. They exist so the sequence means something,
 * not to police the submission: a study missing a stored file or an exam type
 * is stopped at Submit, where the reason can actually be explained, rather
 * than by a Next button that is simply grey.
 */
export type ClassicStepGateInput = Pick<DraftState, 'files' | 'scanTypeId'>;

export function canEnterClassicStep(step: WizardStep, state: ClassicStepGateInput): boolean {
  if (step === 'files') return true;
  // Tracked, not `files.length`: a cancelled or rejected file is not a file
  // the study has.
  if (step === 'interpretation') return countTracked(state.files) > 0;
  if (step === 'routing') return Boolean(state.scanTypeId);
  // `submitted` is reached by submitting, never by navigation.
  return false;
}

/** The step after this one, or null at the end of the ordered part. */
export function nextClassicStep(step: WizardStep): WizardStep | null {
  const index = (CLASSIC_STEPS as readonly WizardStep[]).indexOf(step);
  if (index < 0) return null;
  return CLASSIC_STEPS[index + 1] ?? null;
}

/** The step before this one, or null at the start. */
export function previousClassicStep(step: WizardStep): WizardStep | null {
  const index = (CLASSIC_STEPS as readonly WizardStep[]).indexOf(step);
  if (index <= 0) return null;
  return CLASSIC_STEPS[index - 1] ?? null;
}
