import type { MediaValidationConfidence, MediaValidationFailureReason } from './validate-media-file';

/**
 * The steps a study can be parked on, across both flows.
 *
 * There are two ways through this feature and the user picks which in their
 * profile. They share one draft, one model and one set of panels; only the
 * shell around the panels differs.
 *
 *   STUDY (default)      study      the working surface — files, exam type,
 *                                   findings, note, groups, all at once
 *                        submit     read-only, what is about to be sent
 *
 *   CLASSIC              files          choose and upload
 *                        interpretation exam type, findings, note
 *                        routing        groups, expert review, submit
 *
 *   both                 submitted  the receipt, after it has been
 *
 * The study flow exists because nothing here has to happen in an order: files
 * commit on selection, and neither interpretation nor routing writes anything
 * the previous step had to finish first. The one boundary that survives is
 * that everything before Submit is reversible and Submit is not.
 *
 * The classic flow is kept because an ordered wizard is a real preference —
 * it makes "what do I do next" unambiguous, which matters to someone using
 * this a handful of times rather than daily.
 */
export const STUDY_STEPS = ['study'] as const;
/**
 * Steps no shell draws any more.
 *
 * `submit` was the study flow's second screen before it submitted from its own
 * surface. It stays in the union so a draft saved on it still PARSES — losing
 * a study because its parked step retired would be the worst possible trade —
 * and `stepForFlow` maps it onto something each flow can actually render.
 */
export const RETIRED_STEPS = ['submit'] as const;
export const CLASSIC_STEPS = ['files', 'interpretation', 'routing'] as const;

/** The receipt. Shared, and the one step neither flow can leave. */
export const SUBMITTED_STEP = 'submitted';

export const WIZARD_STEPS = [
  ...STUDY_STEPS,
  ...RETIRED_STEPS,
  ...CLASSIC_STEPS,
  SUBMITTED_STEP,
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === 'string' && (WIZARD_STEPS as readonly string[]).includes(value);
}

export const WIZARD_STEP_LABEL: Record<WizardStep, string> = {
  study: 'Study',
  submit: 'Review & submit',
  files: 'Files',
  interpretation: 'Interpretation',
  routing: 'Review routing',
  submitted: 'Submitted',
};

/**
 * Where one file is in the pipeline.
 *
 *   validating   magic-byte + decode probe running
 *   rejected     validation said do not upload (corrupt / wrong type / timeout)
 *   queued       accepted, waiting for a transfer slot
 *   uploading    bytes moving to S3
 *   stored       bytes are in S3 under `storageKey` — safe across a reload
 *   failed       the transfer failed; `error` says why and it can be retried
 *   cancelled    the user aborted it
 *   detached     restored from a saved draft with no bytes and no storage key,
 *                so the file itself has to be picked again
 */
export type DraftFileStatus =
  | 'validating'
  | 'rejected'
  | 'queued'
  | 'uploading'
  | 'stored'
  | 'failed'
  | 'cancelled'
  | 'detached';

export type DraftFileError = {
  /** Short machine reason, for deciding whether a retry can help. */
  reason: 'corrupted' | 'invalid-type' | 'timeout' | 'duplicate-name' | 'presign' | 'transfer';
  /** What to tell the user. Always names the file and the next action. */
  message: string;
};

export type DraftFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: DraftFileStatus;
  /** 0-100, real bytes transferred. Never synthesised. */
  progress: number;
  /** The canonical S3 key, once the object is up. */
  storageKey: string | null;
  /** 'structure-only' = accepted, but this browser could not decode it. */
  confidence: MediaValidationConfidence | null;
  error: DraftFileError | null;
  /** The File handle. Absent after a reload; see `detached`. */
  blob: File | null;
};

export type ExpertReviewChoice = {
  accountType: 'user' | 'group';
  accountId: string;
  /** For display only; balances are re-read from the API. */
  label: string;
};

/** One attempt at turning the draft into a scan, and what actually happened. */
export type SubmitOutcome = {
  scanId: string | null;
  scanTitle: string | null;
  filesConfirmed: number;
  filesTotal: number;
  /** Files that reached storage but whose confirmation call failed. */
  unconfirmed: Array<{ name: string; message: string }>;
  expertReview: 'not-requested' | 'requested' | 'failed';
  expertReviewError: string | null;
};

export type DraftState = {
  /** The S3 prefix segment. Minted when the first file is accepted. */
  draftId: string;
  step: WizardStep;
  files: DraftFile[];
  scanTypeId: string | null;
  scanTypeName: string | null;
  organizationId: string | null;
  findings: Record<string, string>;
  note: string;
  scanIdentifier: string;
  externalPatientId: string;
  /** null = the user has not touched it, so the default cohort applies. */
  groupIds: string[] | null;
  expertReview: ExpertReviewChoice | null;
  /**
   * Set as soon as POST /api/scan/create succeeds. Persisted immediately so a
   * submit that fails halfway resumes on the same scan instead of creating a
   * second one.
   */
  scanId: string | null;
  submitOutcome: SubmitOutcome | null;
};

export type ValidationFailure = {
  name: string;
  reason: MediaValidationFailureReason | 'duplicate-name';
};
