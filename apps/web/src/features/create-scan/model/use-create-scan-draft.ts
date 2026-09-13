import {
  buildScanFilekey,
  isAbortError,
  isApiError,
  uploadScanObject,
  useApiClient,
  type MultipartSession,
} from '@sector/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  clearDraftFiles,
  dropDraftFile,
  putDraftFile,
  putDraftSession,
  readDraftFiles,
} from './draft-blob-store';
import { DEFAULT_CREATE_SCAN_FLOW, stepForFlow, type CreateScanFlow } from './create-scan-flow';
import { mintDraftId } from './draft-id';
import { useAuth } from '@/auth/auth-context';

import { clearDraft, readDraft, restoreFiles, writeDraft } from './draft-storage';
import { draftHoldings } from './draft-holdings';
import type {
  DraftFile,
  DraftFileError,
  DraftState,
  SubmitOutcome,
  ValidationFailure,
  WizardStep,
} from './draft-types';
import { isFullySubmitted } from './submit-outcome';
import { trackedBytes } from './file-counts';
import {
  exceedsFileLimit,
  formatMegabytes,
  MAX_STUDY_BYTES,
  wouldExceedStudyLimit,
} from './upload-limits';
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

function emptyDraft(draftId: string, flow: CreateScanFlow): DraftState {
  return {
    draftId,
    step: flow === 'classic' ? 'files' : 'study',
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

/**
 * Pre-existing, hard-coded English. Not part of this pass's i18n obligation
 * (create-scan's blanket extraction is separate, later work) — but the two
 * NEW reasons below (the size caps) are new strings, so they are routed
 * through `t()` in `validationMessage` instead of living here.
 */
const VALIDATION_MESSAGE: Record<
  Exclude<ValidationFailure['reason'], 'file-too-large' | 'study-too-large'>,
  (name: string) => string
> = {
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

/**
 * @param flow which shell is rendering this draft. It decides only where a
 *   restored draft lands: both flows share one draft and one model, so a
 *   study saved under one shell must open under the other without stranding
 *   itself on a step that shell cannot draw.
 */
export function useCreateScanDraft(flow: CreateScanFlow = DEFAULT_CREATE_SCAN_FLOW) {
  const client = useApiClient();
  const userId = useAuth().user?.id;
  const { t } = useTranslation();

  const [restoredDraft] = useState(() => readDraft());
  const [state, setState] = useState<DraftState>(() => {
    if (!restoredDraft) return emptyDraft(mintDraftId(), flow);
    return {
      draftId: restoredDraft.draftId,
      // A restored draft never lands on the confirmation step: it was either
      // finished (and cleared) or it was not. Then map it into the flow doing
      // the rendering, which may not be the one that saved it.
      step: stepForFlow(restoredDraft.step === 'submitted' ? 'submit' : restoredDraft.step, flow),
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

  // Set the first time a file's bytes fail to reach IndexedDB — a private
  // window, or a full quota — and never cleared again this session: once one
  // file's bytes are unprotected, the draft as a whole can no longer promise
  // to survive a reload, even if a later file's write happens to succeed.
  // The wizard keeps working from memory either way; this is only about what
  // the learner is told a reload will do to it.
  const [blobStorageDegraded, setBlobStorageDegraded] = useState(false);

  // Persist on every change. Cheap (a manifest, not bytes) and it means the
  // draft survives a crash, not just a deliberate navigation.
  //
  // Once the study is submitted there is nothing left to resume, and writing
  // again here would resurrect the draft that `finish()` just cleared.
  useEffect(() => {
    if (state.step === 'submitted') return;

    // The same predicate the Discard control is offered on, so the two cannot
    // disagree. The guard used to name three fields, which meant a draft whose
    // only content was a patient id, a group choice or a review request was
    // never written at all — and a draft emptied back down to those left its
    // manifest on disk to be restored next time.
    if (draftHoldings(state).length === 0) {
      clearDraft();
      return;
    }

    // Stamped with the owner so a shared machine can purge the RIGHT bytes at
    // the next sign-in, instead of purging every learner's at a token lapse.
    writeDraft(state, userId);
  }, [state, userId]);

  /**
   * Bring back the bytes of anything that had not finished, and the point its
   * transfer had reached.
   *
   * `restoreFiles` marks an unfinished file `detached` from the manifest alone,
   * because the manifest is all it can see. IndexedDB usually has more: the
   * blob, and the multipart session listing the parts S3 already accepted. A
   * file with both goes back to `queued` and the pump picks it up and resumes
   * mid-object rather than restarting at part one.
   *
   * Anything genuinely missing stays `detached` and is named, which is the
   * honest answer — the bytes are not in this browser.
   */
  useEffect(() => {
    if (!restoredDraft) return;

    // No "already ran" ref here, deliberately. StrictMode mounts an effect
    // twice — run, clean up, run again — and a latch set before the await
    // combines with the cleanup's cancel flag to abort the only attempt ever
    // made, leaving every restored file stuck on "needs re-selecting". The
    // read is idempotent and cheap, so the second mount simply redoes it.
    let cancelled = false;
    void readDraftFiles(restoredDraft.draftId).then((records) => {
      if (cancelled || records.length === 0) return;

      const byFileId = new Map(records.map((record) => [record.fileId, record]));

      setState((previous) => ({
        ...previous,
        files: previous.files.map((file) => {
          const record = byFileId.get(file.id);
          if (!record || file.status !== 'detached') return file;

          if (record.session) sessionsRef.current.set(file.id, record.session);

          return {
            ...file,
            status: 'queued' as const,
            progress: 0,
            error: null,
            // The stored Blob is not a File, and the pump only needs the bytes
            // and the type; the name comes off the manifest.
            blob: new File([record.blob], file.name, { type: file.type }),
          };
        }),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [restoredDraft]);

  // ─── transfer engine ───────────────────────────────────────────────────────

  const controllersRef = useRef(new Map<string, AbortController>());
  // Multipart sessions for files still in flight, so a retry resumes from the
  // parts S3 already accepted instead of re-sending the whole object.
  //
  // Mirrored into IndexedDB alongside the blob. The ref was correct while the
  // bytes died on reload — a resume point is meaningless without the bytes —
  // but the blobs are durable now, so the session follows them.
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
            onSession: (session) => {
              sessionsRef.current.set(file.id, session);
              // Fires after every accepted part, which is exactly the cadence a
              // resume point needs. Writes only the session, never the blob.
              void putDraftSession(draftIdRef.current, file.id, session);
            },
          },
        );

        sessionsRef.current.delete(file.id);
        // The S3 key replaces the bytes, so the local copy goes immediately:
        // the quota peak is the in-flight set, not the whole study.
        void dropDraftFile(draftIdRef.current, file.id);
        patchFile(file.id, {
          status: 'stored',
          progress: 100,
          storageKey: stored.key,
          error: null,
        });
      } catch (error) {
        if (isAbortError(error)) {
          patchFile(file.id, { status: 'cancelled', progress: 0 });
          // A cancelled file is not part of the study any more (see
          // countTracked), so its blob has nothing left to do in storage —
          // left there, it would sit for the rest of the session.
          void dropDraftFile(draftIdRef.current, file.id);
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
      // Running total of what the study already holds, kept alongside
      // `existingNames` for the same reason: state has not re-rendered yet, so
      // `filesRef.current` would not see a file this same batch just accepted.
      let runningBytes = trackedBytes(filesRef.current);

      // Phase 1, synchronous and in selection order: duplicate names and the
      // size caps need no I/O, and the study-cap math needs a stable order —
      // deciding it inside the concurrent phase below would make which file
      // "wins" a shared byte budget depend on which one happened to validate
      // first.
      const pending: Array<{ id: string; file: File }> = [];
      for (const file of incoming) {
        // PATCH /api/scan/:id/file-details/status matches an entry by FILENAME,
        // so two files with the same name in one study cannot be told apart.
        if (existingNames.has(file.name)) {
          failures.push({ name: file.name, reason: 'duplicate-name' });
          continue;
        }
        if (exceedsFileLimit(file.size)) {
          failures.push({ name: file.name, reason: 'file-too-large' });
          continue;
        }
        if (wouldExceedStudyLimit(runningBytes, file.size)) {
          failures.push({ name: file.name, reason: 'study-too-large' });
          continue;
        }

        existingNames.add(file.name);
        runningBytes += file.size;
        pending.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, file });
      }

      // Phase 2: every file that passed the cheap checks appears immediately,
      // as `validating` — a learner picking five clips used to see nothing
      // until the FIRST one's decode probe finished, which can take up to a
      // minute on a large file; now every row shows up at once.
      if (pending.length > 0) {
        setState((previous) => ({
          ...previous,
          files: [
            ...previous.files,
            ...pending.map(({ id, file }): DraftFile => ({
              id,
              name: file.name,
              size: file.size,
              type: file.type,
              status: 'validating',
              progress: 0,
              storageKey: null,
              confidence: null,
              error: null,
              blob: file,
            })),
          ],
        }));
      }

      // Phase 3: the decode probe itself runs for every file AT ONCE rather
      // than one at a time, so five clips take as long as the slowest one to
      // validate rather than the sum of all five.
      await Promise.all(
        pending.map(async ({ id, file }) => {
          const result = await validateMediaFile(file);

          if (blocksMediaUpload(result)) {
            failures.push({ name: file.name, reason: result.reason });
            setState((previous) => ({
              ...previous,
              files: previous.files.filter((entry) => entry.id !== id),
            }));
            return;
          }

          patchFile(id, {
            status: 'queued',
            // A structure-only file is a real scan the browser cannot decode.
            // It uploads exactly like any other; the badge only sets expectations.
            confidence: result.ok ? result.confidence : null,
          });
          // Durable from the moment it is accepted, so a reload two seconds
          // later still has the bytes. Dropped again once the upload completes.
          const stored = await putDraftFile(draftIdRef.current, id, file);
          if (!stored) setBlobStorageDegraded(true);
        }),
      );

      setValidationFailures(failures);
    },
    [patchFile],
  );

  const cancelFile = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
  }, []);

  const cancelAll = useCallback(() => {
    for (const controller of controllersRef.current.values()) controller.abort();
    // A queued file has no controller yet, so aborting alone would leave it to
    // start the moment a slot frees up — the opposite of what Cancel all means.
    const cancelledQueuedIds = filesRef.current
      .filter((file) => file.status === 'queued')
      .map((file) => file.id);

    setState((previous) => ({
      ...previous,
      files: previous.files.map((file) =>
        file.status === 'queued' ? { ...file, status: 'cancelled' as const, progress: 0 } : file,
      ),
    }));

    // A cancelled file is not part of the study (see countTracked), so its
    // blob has nothing left to do in IndexedDB — left there, it would sit
    // for the rest of the session. A file already transferring is cleaned up
    // where its status actually flips to `cancelled`, inside `transfer()`.
    for (const id of cancelledQueuedIds) void dropDraftFile(draftIdRef.current, id);
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

  const removeFile = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    // The file is gone, so its part ETags are worth nothing. The multipart
    // upload itself is left for the bucket's incomplete-upload lifecycle
    // rule: the legacy API exposes no abort-multipart route to call.
    sessionsRef.current.delete(id);
    // Its blob has nothing left to do in IndexedDB either — left behind, it
    // would sit there for the rest of the session with nothing pointing at it.
    void dropDraftFile(draftIdRef.current, id);
    setState((previous) => ({
      ...previous,
      files: previous.files.filter((file) => file.id !== id),
    }));
  }, []);

  /**
   * Re-attach bytes to an entry restored from a saved draft.
   *
   * "Choose again" used to accept whatever was picked with no check at all,
   * and submitted it under the OLD entry's name, size and MIME type — so a
   * learner who picked a different file by mistake had it silently relabelled
   * as the one the draft still remembered. This runs the same validation and
   * duplicate-name check a first pick gets, and records the file actually
   * chosen rather than the one it is replacing.
   */
  const reattachFile = useCallback(async (id: string, blob: File) => {
    const existingNames = new Set(
      filesRef.current
        .filter(
          (file) => file.id !== id && file.status !== 'rejected' && file.status !== 'cancelled',
        )
        .map((file) => file.name),
    );

    if (existingNames.has(blob.name)) {
      setValidationFailures([{ name: blob.name, reason: 'duplicate-name' }]);
      return;
    }

    if (exceedsFileLimit(blob.size)) {
      setValidationFailures([{ name: blob.name, reason: 'file-too-large' }]);
      return;
    }

    // The entry being replaced is excluded from the running total: its old
    // size is leaving the study along with its old bytes.
    const otherTrackedBytes = trackedBytes(filesRef.current.filter((file) => file.id !== id));
    if (wouldExceedStudyLimit(otherTrackedBytes, blob.size)) {
      setValidationFailures([{ name: blob.name, reason: 'study-too-large' }]);
      return;
    }

    const result = await validateMediaFile(blob);
    if (blocksMediaUpload(result)) {
      setValidationFailures([{ name: blob.name, reason: result.reason }]);
      return;
    }

    setState((previous) => ({
      ...previous,
      files: previous.files.map((file) =>
        file.id === id
          ? {
              ...file,
              name: blob.name,
              size: blob.size,
              type: blob.type,
              blob,
              status: 'queued' as const,
              progress: 0,
              storageKey: null,
              confidence: result.ok ? result.confidence : null,
              error: null,
            }
          : file,
      ),
    }));

    const stored = await putDraftFile(draftIdRef.current, id, blob);
    if (!stored) setBlobStorageDegraded(true);
  }, []);

  // ─── form actions ──────────────────────────────────────────────────────────

  const update = useCallback((patch: Partial<DraftState>) => {
    setState((previous) => ({ ...previous, ...patch }));
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setState((previous) => ({ ...previous, step }));
  }, []);

  const finish = useCallback((outcome: SubmitOutcome) => {
    setState((previous) => ({
      ...previous,
      step: 'submitted',
      submitOutcome: outcome,
      scanId: outcome.scanId ?? previous.scanId,
    }));

    // Only a fully-landed submit has nothing left to resume. A short one —
    // a file that never reached storage, a confirmation that failed after
    // the scan row was already created — leaves real work outstanding, and
    // the draft plus its blobs are the ONLY way back to finishing it: the
    // scan id is already on the receipt, and a later retry resumes against
    // it rather than creating a second study. Destroying them here
    // regardless of the outcome is what used to strand a short submit in
    // `pending` forever with no draft left to retry from.
    if (isFullySubmitted(outcome)) {
      clearDraft();
      void clearDraftFiles(draftIdRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    cancelAll();
    clearDraft();
    void clearDraftFiles(draftIdRef.current);
    setValidationFailures([]);
    setState(emptyDraft(mintDraftId(), flow));
  }, [cancelAll, flow]);

  /**
   * Leave the receipt and go back to finishing a submit that landed short.
   *
   * Only reachable when `finish()` kept the draft — i.e. the receipt itself
   * is short a file. The scan id is still on `state.scanId`, so the next
   * submit takes `submitDraft`'s resume branch and confirms against the SAME
   * scan rather than creating a second one.
   */
  const resumeSubmit = useCallback(() => {
    setState((previous) => ({
      ...previous,
      step: stepForFlow('submit', flow),
      submitOutcome: null,
    }));
  }, [flow]);

  const dismissValidationFailures = useCallback(() => setValidationFailures([]), []);

  return {
    state,
    wasRestored,
    validationFailures,
    dismissValidationFailures,
    blobStorageDegraded,
    addFiles,
    cancelFile,
    cancelAll,
    retryFile,
    removeFile,
    reattachFile,
    update,
    goToStep,
    finish,
    resumeSubmit,
    reset,
    validationMessage: (failure: ValidationFailure) => {
      const limit = formatMegabytes(MAX_STUDY_BYTES);
      if (failure.reason === 'file-too-large') {
        return t('createScan.validationFileTooLarge', { name: failure.name, limit });
      }
      if (failure.reason === 'study-too-large') {
        return t('createScan.validationStudyTooLarge', { name: failure.name, limit });
      }
      return VALIDATION_MESSAGE[failure.reason](failure.name);
    },
    storageDegradedMessage: {
      title: t('createScan.storageDegradedTitle'),
      body: t('createScan.storageDegradedBody'),
    },
  };
}
