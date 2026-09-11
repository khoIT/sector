import { z } from 'zod';

import type { DraftFile, DraftState } from './draft-types';
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
const STORAGE_KEY = 'scanvault.create-scan.draft';

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
  step: z.enum(['files', 'interpretation', 'routing', 'submitted']),
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

export function writeDraft(state: DraftState): void {
  const payload: PersistedDraft = {
    version: 1,
    savedAt: Date.now(),
    draftId: state.draftId,
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // A private window, a full quota, or blocked site data. The wizard keeps
    // working in memory; only the reload-resume is lost.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see writeDraft */
  }
}

/** Returns null when there is no draft, it is unreadable, or it has expired. */
export function readDraft(): PersistedDraft | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
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

  const result = persistedDraftSchema.safeParse(parsed);
  if (!result.success || !isDraftId(result.data.draftId)) {
    clearDraft();
    return null;
  }

  if (Date.now() - result.data.savedAt > EXPIRY_MS) {
    clearDraft();
    return null;
  }

  return result.data;
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
