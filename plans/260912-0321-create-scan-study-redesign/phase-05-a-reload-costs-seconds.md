---
phase: 5
title: "A reload costs seconds"
status: pending
effort: "M"
---

# Phase 5: A reload costs seconds

## Overview

A mid-upload reload loses every file that had not finished. The draft manifest survives — it
is in `localStorage` — but `localStorage` holds strings, so the `Blob` does not, and each
unfinished file comes back `detached` with the learner asked to choose it again. Move the
bytes to IndexedDB and persist the multipart sessions beside them, and the reload costs the
parts still in flight rather than the study.

## What survives today, and what does not

| | Survives a reload | Why |
|---|---|---|
| Draft manifest, scan type, findings, note | Yes | `localStorage`, `draft-storage.ts` |
| Files already `stored` | Yes | The bytes are in S3; only the key is needed |
| Files mid-transfer | **No** | The `Blob` cannot be serialised to `localStorage` |
| Multipart part ETags | **No** | `sessionsRef` is a `useRef` map, deliberately in memory |

The in-memory choice was correct when it was made: resuming is meaningless without the bytes,
and the bytes did not survive. This phase removes that premise, and the session should follow
the bytes into durable storage.

## Requirements

- Functional: a reload during upload restores the files and resumes each unfinished transfer
  from the first part that never landed.
- Functional: the restore is per draft — two create-scan tabs must not overwrite each other.
- Functional: stored blobs are cleared on submit, on discard-draft and on logout.
- Non-functional: an IndexedDB failure degrades to today's behaviour rather than breaking the
  page. Private-mode and quota-exceeded are both real.

## Architecture

**Two stores, one draft.** The manifest stays in `localStorage` — it is small, synchronous and
already works. The blobs and sessions go to IndexedDB, keyed by `draftId` so two tabs are
independent. The manifest is the index; IndexedDB is the payload.

**What a persisted session is.** Exactly the `MultipartSession` already defined in
`packages/api-client/src/multipart-upload.ts` — `{ uploadId, key, etags }` — which
`uploadScanObject` already accepts as a resume point. The orchestration needs no change at all;
only the storage of the session moves from a ref to a store. That is the whole reason this
phase is small enough to be worth doing.

**Quota.** A 200 MB study against a browser origin quota is not free. Write blobs only for
files not yet `stored`, and drop each one as soon as its upload completes — the S3 key
replaces it. The peak is therefore the in-flight set, not the study.

**Credits.** In the legacy flow a resumed submission raised a real product question: does it
re-charge a review credit? It does not arise here. Expert review is requested inside
`submitDraft`, after the upload is finished, so a resumed *upload* never touches credits. If
that ordering ever changes, this becomes a question for Liesl before it becomes code.

## Related Code Files

- Modify: `apps/web/src/features/create-scan/model/draft-storage.ts`
- Modify: `apps/web/src/features/create-scan/model/use-create-scan-draft.ts` — `sessionsRef` → store
- Create: `apps/web/src/features/create-scan/model/draft-blob-store.ts` + test
- Read: `packages/api-client/src/multipart-upload.ts` — `MultipartSession`, resume contract
- Read: `apps/web/src/features/create-scan/model/draft-types.ts` — `DraftFile.status`

## Implementation Steps

1. `draft-blob-store.ts`: a small IndexedDB wrapper — `put(draftId, fileId, blob, session)`,
   `read(draftId)`, `drop(draftId, fileId)`, `clear(draftId)`. No library; the surface is four
   functions. Every call wrapped so a rejection resolves to a no-op.
2. Write a blob on accept; drop it the moment the file reaches `stored`.
3. Persist the `MultipartSession` on every `onSession` callback — that callback already fires
   after each accepted part and exists for exactly this.
4. On restore: rehydrate blobs, set restored-but-unfinished files to `queued`, and hand the
   stored session to `uploadScanObject` so the pump resumes mid-file.
5. Clear on submit, on `reset()` and on logout.
6. Update the restore notice: today it says anything unfinished "needs choosing again", which
   will no longer be true.

## Tests / Validation

- Unit: put/read/drop/clear round-trip; a rejecting store degrades to no-op.
- Browser: start a 28 MB multipart upload, reload at ~40%, confirm the file returns and the
  network shows part PUTs resuming rather than restarting at part 1.
- Browser: two tabs with different drafts do not see each other's files.
- Browser: discard-draft leaves nothing behind in IndexedDB.

## Success Criteria

- [ ] A mid-upload reload resumes rather than asking for the file again
- [ ] Resume restarts at the first part with no stored ETag, not at part 1
- [ ] Blobs are dropped as each file completes; peak storage is the in-flight set
- [ ] Two drafts in two tabs stay independent
- [ ] IndexedDB unavailable degrades to today's behaviour with the notice intact

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Quota exceeded on a large study | Only unfinished files are stored and each is dropped on completion; a write failure degrades to no-op |
| Stale multipart uploads accumulate in S3 | Already true today. The legacy API exposes no abort-multipart route, so this belongs to the bucket's incomplete-upload lifecycle rule — flag it, do not fake it here |
| Restored session no longer valid server-side | `uploadScanObject` surfaces the failure per file; the file falls back to a fresh init on retry |
| Private browsing has no IndexedDB | Degradation path is today's behaviour, which is a working flow, not a broken one |
