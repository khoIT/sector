import {
  buildScanFilekey,
  isAbortError,
  isApiError,
  uploadScanObject,
  useApiClient,
  type MultipartSession,
} from '@scanvault/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mintDraftId } from './draft-id';
import { clearDraft, readDraft, restoreFiles, writeDraft } from './draft-storage';
import type {
  DraftFile,
  DraftFileError,
  DraftState,
  SubmitOutcome,
  ValidationFailure,
  WizardStep,
} from './draft-types';
import { blocksMediaUpload, validateMediaFile } from './validate-media-file';

/**
 * The create-scan draft: wizard state, the background transfer engine, and
 * localStorage persistence.
 *
 * The one structural change from the legacy wizard: bytes start moving the
 * moment a file passes validation, in parallel with the user filling in the
 * rest of the form. Nothing waits for Submit. By the time the user reaches
 * step 4 the objects are already in storage, so Submit is a metadata write —
 * which is also why this flow needs no "do not close the browser" warning and
 * deliberately registers no `beforeunload` handler.
 */

/** Parallel transfers. Three keeps a slow link usable without starving it. */
const MAX_CONCURRENT_UPLOADS = 3;

function emptyDraft(draftId: string): DraftState {
  return {
    draftId,
    step: 'files',
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
  };
}

const VALIDATION_MESSAGE: Record<ValidationFailure['reason'], (name: string) => string> = {
  corrupted: (name) => `"${name}" is not a readable image or video. Re-export it and add it again.`,
  'invalid-type': (name) =>
    `"${name}" is not a supported format. Add a JPEG, PNG, GIF, WebP, BMP, SVG, MP4, MOV, WebM, AVI or MKV file.`,
  timeout: (name) =>
    `"${name}" took too long to open. It may be very large or damaged — try again, or re-export it.`,
  'duplicate-name': (name) =>
    `"${name}" is already in this study. Upload progress is tracked by filename, so rename the copy before adding it.`,
  // Never produced as a blocking failure: a file this browser cannot decode is
  // ACCEPTED with a "structure only" badge, because the server transcodes
  // codecs Chrome will not play. Present so the map stays exhaustive.
  'unsupported-in-browser': (name) =>
    `"${name}" cannot be previewed in this browser, but it uploaded normally.`,
};

let filekeyCounter = 0;

/**
 * `${timestamp}_${sanitized name}`, matching the legacy key format. The
 * counter guarantees two files added in the same millisecond cannot collide.
 */
function nextFilekey(name: string): string {
  filekeyCounter += 1;
  return buildScanFilekey(name, Date.now() + filekeyCounter);
}

export type UseCreateScanDraft = ReturnType<typeof useCreateScanDraft>;

export function useCreateScanDraft() {
  const client = useApiClient();

  const [restoredDraft] = useState(() => readDraft());
  const [state, setState] = useState<DraftState>(() => {
    if (!restoredDraft) return emptyDraft(mintDraftId());
    return {
      draftId: restoredDraft.draftId,
      // A restored draft never lands on the confirmation step: it was either
      // finished (and cleared) or it was not.
      step: restoredDraft.step === 'submitted' ? 'routing' : restoredDraft.step,
      files: restoreFiles(restoredDraft),
      scanTypeId: restoredDraft.scanTypeId,
      scanTypeName: restoredDraft.scanTypeName,
      organizationId: restoredDraft.organizationId,
      findings: restoredDraft.findings,
      note: restoredDraft.note,
      scanIdentifier: restoredDraft.scanIdentifier,
      externalPatientId: restoredDraft.externalPatientId,
      groupIds: restoredDraft.groupIds,
      expertReview: restoredDraft.expertReview,
      scanId: restoredDraft.scanId,
      submitOutcome: null,
    };
  });

  const [validationFailures, setValidationFailures] = useState<ValidationFailure[]>([]);
  const wasRestored = restoredDraft !== null;

  // Persist on every change. Cheap (a manifest, not bytes) and it means the
  // draft survives a crash, not just a deliberate navigation.
  //
  // Once the study is submitted there is nothing left to resume, and writing
  // again here would resurrect the draft that `finish()` just cleared.
  useEffect(() => {
    if (state.step === 'submitted') return;
    if (state.files.length === 0 && !state.scanTypeId && !state.note) return;
    writeDraft(state);
  }, [state]);

  // ─── transfer engine ───────────────────────────────────────────────────────

  const controllersRef = useRef(new Map<string, AbortController>());
  // Multipart sessions for files still in flight, so a retry resumes from the
  // parts S3 already accepted instead of re-sending the whole object. Held in
  // a ref rather than draft state: it is meaningless without the Blob, which
  // does not survive a reload.
  const sessionsRef = useRef(new Map<string, MultipartSession>());
  const filesRef = useRef<DraftFile[]>(state.files);
  filesRef.current = state.files;
  const draftIdRef = useRef(state.draftId);
  draftIdRef.current = state.draftId;
  const runningRef = useRef(false);

  const patchFile = useCallback((id: string, patch: Partial<DraftFile>) => {
    setState((previous) => ({
      ...previous,
      files: previous.files.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    }));
  }, []);

  const transfer = useCallback(
    async (file: DraftFile) => {
      const blob = file.blob;
      if (!blob) {
        patchFile(file.id, { status: 'detached', progress: 0 });
        return;
      }

      const controller = new AbortController();
      controllersRef.current.set(file.id, controller);
      patchFile(file.id, { status: 'uploading', progress: 0, error: null });

      try {
        // The draft id is only a valid ObjectId, not a real scan: the presign
        // and init routes check the format and never look it up. That is what
        // lets the transfer start before the study exists.
        //
        // A fresh key is minted per attempt; a resumed multipart upload ignores
        // it and keeps writing to the object its session already opened.
        const stored = await uploadScanObject(
          client,
          {
            scanId: draftIdRef.current,
            key: nextFilekey(file.name),
            blob,
            contentType: blob.type,
          },
          {
            signal: controller.signal,
            onProgress: ({ percent }) => patchFile(file.id, { progress: percent }),
            session: sessionsRef.current.get(file.id) ?? null,
            onSession: (session) => sessionsRef.current.set(file.id, session),
          },
        );

        sessionsRef.current.delete(file.id);
        patchFile(file.id, {
          status: 'stored',
          progress: 100,
          storageKey: stored.key,
          error: null,
        });
      } catch (error) {
        if (isAbortError(error)) {
          patchFile(file.id, { status: 'cancelled', progress: 0 });
          return;
        }

        const isPresignFailure = isApiError(error);
        const detail =
          error instanceof Error && error.message ? error.message : 'the transfer did not complete';

        const draftError: DraftFileError = {
          reason: isPresignFailure ? 'presign' : 'transfer',
          message: isPresignFailure
            ? `Storage refused "${file.name}": ${detail}. Retry, or remove the file to continue without it.`
            : `"${file.name}" stopped uploading: ${detail}. Retry when your connection is back.`,
        };

        patchFile(file.id, { status: 'failed', error: draftError });
      } finally {
        controllersRef.current.delete(file.id);
      }
    },
    [client, patchFile],
  );

  /**
   * Drain the queue up to the concurrency limit. Re-entrant by design: every
   * state change calls it, and the `runningRef` latch stops two passes from
   * starting the same file twice.
   */
  const pump = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      const active = filesRef.current.filter((file) => file.status === 'uploading').length;
      const free = MAX_CONCURRENT_UPLOADS - active;
      if (free <= 0) return;

      const next = filesRef.current
        .filter((file) => file.status === 'queued' && file.blob)
        .slice(0, free);

      for (const file of next) {
        // Claim the slot synchronously so the next pump does not re-pick it.
        filesRef.current = filesRef.current.map((entry) =>
          entry.id === file.id ? { ...entry, status: 'uploading' as const } : entry,
        );
        void transfer(file);
      }
    } finally {
      runningRef.current = false;
    }
  }, [transfer]);

  useEffect(() => {
    pump();
  }, [state.files, pump]);

  // Abort everything still in flight when the wizard unmounts, so navigating
  // away does not leave orphaned requests writing to a draft nobody is reading.
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, []);

  // ─── file actions ──────────────────────────────────────────────────────────

  const addFiles = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return;

      const failures: ValidationFailure[] = [];
      const existingNames = new Set(
        filesRef.current
          .filter((file) => file.status !== 'rejected' && file.status !== 'cancelled')
          .map((file) => file.name),
      );

      // Each file is added to state the instant IT validates, not after the
      // whole batch does: the first clip starts transferring while the rest
      // are still being probed, which is the entire point of the flow.
      for (const file of incoming) {
        // PATCH /api/scan/:id/file-details/status matches an entry by FILENAME,
        // so two files with the same name in one study cannot be told apart.
        if (existingNames.has(file.name)) {
          failures.push({ name: file.name, reason: 'duplicate-name' });
          continue;
        }
        existingNames.add(file.name);

        const result = await validateMediaFile(file);

        if (blocksMediaUpload(result)) {
          failures.push({ name: file.name, reason: result.reason });
          continue;
        }

        const accepted: DraftFile = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'queued',
          progress: 0,
          storageKey: null,
          // A structure-only file is a real scan the browser cannot decode.
          // It uploads exactly like any other; the badge only sets expectations.
          confidence: result.ok ? result.confidence : null,
          error: null,
          blob: file,
        };

        setState((previous) => ({ ...previous, files: [...previous.files, accepted] }));
      }

      setValidationFailures(failures);
    },
    [],
  );

  const cancelFile = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
  }, []);

  const cancelAll = useCallback(() => {
    for (const controller of controllersRef.current.values()) controller.abort();
    // A queued file has no controller yet, so aborting alone would leave it to
    // start the moment a slot frees up — the opposite of what Cancel all means.
    setState((previous) => ({
      ...previous,
      files: previous.files.map((file) =>
        file.status === 'queued' ? { ...file, status: 'cancelled' as const, progress: 0 } : file,
      ),
    }));
  }, []);

  const retryFile = useCallback((id: string) => {
    setState((previous) => ({
      ...previous,
      files: previous.files.map((file) =>
        file.id === id
          ? {
              ...file,
              status: file.blob ? ('queued' as const) : ('detached' as const),
              progress: 0,
              error: null,
            }
          : file,
      ),
    }));
  }, []);

  const removeFile = useCallback(
    (id: string) => {
      controllersRef.current.get(id)?.abort();
      // The file is gone, so its part ETags are worth nothing. The multipart
      // upload itself is left for the bucket's incomplete-upload lifecycle
      // rule: the legacy API exposes no abort-multipart route to call.
      sessionsRef.current.delete(id);
      setState((previous) => ({
        ...previous,
        files: previous.files.filter((file) => file.id !== id),
      }));
    },
    [],
  );

  /** Re-attach bytes to an entry restored from a saved draft. */
  const reattachFile = useCallback((id: string, blob: File) => {
    setState((previous) => ({
      ...previous,
      files: previous.files.map((file) =>
        file.id === id
          ? { ...file, blob, status: 'queued' as const, progress: 0, error: null }
          : file,
      ),
    }));
  }, []);

  // ─── form actions ──────────────────────────────────────────────────────────

  const update = useCallback((patch: Partial<DraftState>) => {
    setState((previous) => ({ ...previous, ...patch }));
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setState((previous) => ({ ...previous, step }));
  }, []);

  const finish = useCallback((outcome: SubmitOutcome) => {
    setState((previous) => ({ ...previous, step: 'submitted', submitOutcome: outcome }));
    // The scan now exists server-side, so the draft has nothing left to resume.
    clearDraft();
  }, []);

  const reset = useCallback(() => {
    cancelAll();
    clearDraft();
    setValidationFailures([]);
    setState(emptyDraft(mintDraftId()));
  }, [cancelAll]);

  const dismissValidationFailures = useCallback(() => setValidationFailures([]), []);

  return {
    state,
    wasRestored,
    validationFailures,
    dismissValidationFailures,
    addFiles,
    cancelFile,
    cancelAll,
    retryFile,
    removeFile,
    reattachFile,
    update,
    goToStep,
    finish,
    reset,
    validationMessage: (failure: ValidationFailure) =>
      VALIDATION_MESSAGE[failure.reason](failure.name),
  };
}
