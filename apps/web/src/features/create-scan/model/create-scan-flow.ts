import { CLASSIC_STEPS, STUDY_STEPS, type WizardStep } from './draft-types';

/**
 * Which way through Create Scan Study this browser takes.
 *
 *   study    one working surface plus a commit screen (the default)
 *   classic  the ordered four-step wizard
 *
 * ## Why this is a per-browser preference and not an account setting
 *
 * It would be better on the account — it would follow someone to a second
 * machine. The API cannot hold it: `updateProfileSchema` accepts `firstName`,
 * `lastName` and six fixed enum-typed sections and drops unknown keys, the
 * user model has no settings field, and the `userprofiles` collection holds
 * zero documents against 3,151 users. Storing it there means a change to a
 * repo this app does not own, writing into a collection nothing has ever
 * written to. So it sits in localStorage beside the theme and the language,
 * which are per-browser for the same reason, and the settings screen says so
 * rather than letting someone discover it on their laptop.
 */
export const CREATE_SCAN_FLOWS = ['study', 'classic'] as const;
export type CreateScanFlow = (typeof CREATE_SCAN_FLOWS)[number];

export const DEFAULT_CREATE_SCAN_FLOW: CreateScanFlow = 'study';

const STORAGE_KEY = 'scanvault.create-scan.flow';

export function isCreateScanFlow(value: unknown): value is CreateScanFlow {
  return typeof value === 'string' && (CREATE_SCAN_FLOWS as readonly string[]).includes(value);
}

/**
 * Storage is taken as a parameter rather than reached for.
 *
 * Every access is guarded: Safari's private mode throws on `localStorage`
 * rather than returning null, and a preference is never worth a blank page.
 */
export function readCreateScanFlow(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): CreateScanFlow {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return isCreateScanFlow(stored) ? stored : DEFAULT_CREATE_SCAN_FLOW;
  } catch {
    return DEFAULT_CREATE_SCAN_FLOW;
  }
}

export function writeCreateScanFlow(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  flow: CreateScanFlow,
): void {
  try {
    storage?.setItem(STORAGE_KEY, flow);
  } catch {
    // A preference that cannot be saved is not a failure worth surfacing:
    // the session still honours the choice, it just will not outlive it.
  }
}

/** True when `step` is one this flow can actually render. */
export function flowOwnsStep(step: WizardStep, flow: CreateScanFlow): boolean {
  if (step === 'submitted') return true;
  const owned: readonly string[] = flow === 'classic' ? CLASSIC_STEPS : STUDY_STEPS;
  return owned.includes(step);
}

/**
 * The nearest equivalent step in `flow`.
 *
 * Both flows share one draft, so changing the preference must not strand a
 * study on a step its shell cannot draw — which would render an empty page
 * over a draft that is perfectly intact.
 *
 * The mapping keeps the one distinction that matters, before Submit versus
 * after it:
 *
 *   study ⇄ files, interpretation     still working on it
 *   submit ⇄ routing                  looking at what is about to be sent
 *   submitted                         unchanged, in both directions
 *
 * Coming back to classic lands on `files` rather than guessing how far along
 * the study was. It is the step that is always valid, and the stepper offers
 * the rest the moment their gates are met.
 */
export function stepForFlow(step: WizardStep, flow: CreateScanFlow): WizardStep {
  if (flowOwnsStep(step, flow)) return step;

  if (flow === 'classic') {
    return step === 'submit' ? 'routing' : 'files';
  }

  return step === 'routing' ? 'submit' : 'study';
}
