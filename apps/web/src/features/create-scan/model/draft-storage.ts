import { z } from 'zod';

import { clearDraftFiles } from './draft-blob-store';
import { isWizardStep, WIZARD_STEPS, type DraftFile, type DraftState } from './draft-types';
import { isDraftId } from './draft-id';

/**
 * The draft lives in localStorage so closing the tab is survivable.
 *
 * What is persisted is the MANIFEST, not the bytes: name, size, type and the
 * S3 key of every file already in storage. A file that made it to S3 needs no
 * blob to be submitted later — it is already where the server will look — so a
 * reload can finish the study. A file that had not finished is restored as
 * `detached` and named, so the user re-picks exactly that one rather than
 * guessing.
 *
 * This is deliberately not IndexedDB-backed blob storage (which the legacy
 * wizard used): copying a 400MB clip into IndexedDB alongside the upload
 * doubles the write and can fail its own quota, and the S3 object is a better
 * store than the browser anyway.
 */
export const DRAFT_STORAGE_KEY = 'sector.create-scan.draft';

/** Legacy expiry: a week of inactivity. */
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const persistedFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  storageKey: z.string().nullable(),
  confidence: z.enum(['verified', 'structure-only']).nullable(),
});

const persistedDraftSchema = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  draftId: z.string(),
  /**
   * Who the draft belongs to.
   *
   * Optional because drafts written before this field existed must still
   * parse. It is what lets a shared machine purge one learner's bytes when the
   * NEXT learner signs in, rather than destroying them the moment a token
   * lapses — which is the same event as a sign-out to the transport and the
   * opposite of it to the person sitting there.
   */
  ownerId: z.string().optional(),
  /**
   * Tolerant on purpose. A draft carries whichever step its flow was on when
   * it was saved, and the user can change flows between one sitting and the
   * next — so a value that is real but belongs to the other flow must survive
   * the parse and be mapped afterwards, not rejected here.
   *
   * Anything unrecognisable reads as `study`. A strict enum would throw away
   * a learner's whole study over one unknown string.
   */
  step: z.preprocess((value) => (isWizardStep(value) ? value : 'study'), z.enum(WIZARD_STEPS)),
  files: z.array(persistedFileSchema),
  scanTypeId: z.string().nullable(),
  scanTypeName: z.string().nullable(),
  organizationId: z.string().nullable(),
  findings: z.record(z.string()),
  note: z.string(),
  scanIdentifier: z.string(),
  externalPatientId: z.string(),
  groupIds: z.array(z.string()).nullable(),
  expertReview: z
    .object({
      accountType: z.enum(['user', 'group']),
      accountId: z.string(),
      label: z.string(),
    })
    .nullable(),
  scanId: z.string().nullable(),
});

export type PersistedDraft = z.infer<typeof persistedDraftSchema>;

/**
 * Parse a stored payload, migrations included.
 *
 * Separate from `readDraft` so the step migration can be tested against a real
 * pre-migration payload without a `localStorage` stub. That migration is this
 * module's only silent failure mode: get it wrong and someone's saved study
 * opens as a blank page with no error anywhere.
 */
export function parsePersistedDraft(value: unknown): PersistedDraft | null {
  const result = persistedDraftSchema.safeParse(value);
  if (!result.success || !isDraftId(result.data.draftId)) return null;
  return result.data;
}

export function writeDraft(state: DraftState, ownerId?: string): void {
  const payload: PersistedDraft = {
    version: 1,
    savedAt: Date.now(),
    draftId: state.draftId,
    ...(ownerId ? { ownerId } : {}),
    step: state.step,
    files: state.files
      // A rejected or cancelled file is not part of the study; keeping it would
      // resurrect an error the user already dealt with.
      .filter((file) => file.status !== 'rejected' && file.status !== 'cancelled')
      .map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        storageKey: file.status === 'stored' ? file.storageKey : null,
        confidence: file.confidence,
      })),
    scanTypeId: state.scanTypeId,
    scanTypeName: state.scanTypeName,
    organizationId: state.organizationId,
    findings: state.findings,
    note: state.note,
    scanIdentifier: state.scanIdentifier,
    externalPatientId: state.externalPatientId,
    groupIds: state.groupIds,
    expertReview: state.expertReview,
    scanId: state.scanId,
  };

  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // A private window, a full quota, or blocked site data. The wizard keeps
    // working in memory; only the reload-resume is lost.
  }
}

export function clearDraft(): void {
  expiredThisLoad = false;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* see writeDraft */
  }
}

/**
 * Whether `readDraft` has retired an expired draft during this page load.
 *
 * Set-only, and read as many times as anyone likes: a StrictMode double mount
 * asks twice and must get the same answer both times, which rules out the
 * obvious one-shot consumer.
 *
 * It exists because expiry stopped being a housekeeping detail. A draft is now
 * the only route back to a study whose submit landed short — the scan id lives
 * on it, and a retry resumes against that scan instead of creating a second
 * one — so a draft going silently is a recovery route going silently.
 */
let expiredThisLoad = false;

export function draftExpiredThisLoad(): boolean {
  return expiredThisLoad;
}

/** Returns null when there is no draft, it is unreadable, or it has expired. */
export function readDraft(): PersistedDraft | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearDraft();
    return null;
  }

  const draft = parsePersistedDraft(parsed);
  if (!draft) {
    clearDraft();
    return null;
  }

  if (Date.now() - draft.savedAt > EXPIRY_MS) {
    clearDraft();
    // The manifest is what points at the blobs, so dropping it without them
    // strands every unfinished file's bytes in IndexedDB for good: nothing
    // knows the draft id any more, and `clearDraftFiles` is keyed by it.
    // Fire-and-forget because this function has to stay synchronous — it runs
    // inside a useState initialiser — and because a failed delete costs quota,
    // not correctness.
    void clearDraftFiles(draft.draftId);
    expiredThisLoad = true;
    return null;
  }

  return draft;
}

/** Rebuild in-memory files from a manifest. Bytes are gone; keys are not. */
export function restoreFiles(persisted: PersistedDraft): DraftFile[] {
  return persisted.files.map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.type,
    status: file.storageKey ? ('stored' as const) : ('detached' as const),
    progress: file.storageKey ? 100 : 0,
    storageKey: file.storageKey,
    confidence: file.confidence,
    error: null,
    blob: null,
  }));
}

/**
 * The draft id currently on disk, without parsing the rest.
 *
 * Sign-out needs it to clear that draft's bytes out of IndexedDB: leaving one
 * user's unfinished ultrasound clips in the browser for the next person to
 * sign in on a shared teaching-room machine is not acceptable, and the blobs
 * outlive the manifest unless something goes and gets them.
 */
/**
 * Who the stored draft belongs to, if it says.
 *
 * Read straight out of localStorage rather than through the full parse: the
 * caller is the auth layer deciding whether to purge, and a draft too damaged
 * to parse is exactly one it should still be able to purge.
 */
export function currentDraftOwnerId(): string | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const owner = (parsed as { ownerId?: unknown }).ownerId;
    return typeof owner === 'string' && owner ? owner : null;
  } catch {
    return null;
  }
}

export function currentDraftId(): string | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const id = (parsed as { draftId?: unknown }).draftId;
    return typeof id === 'string' && isDraftId(id) ? id : null;
  } catch {
    return null;
  }
}
