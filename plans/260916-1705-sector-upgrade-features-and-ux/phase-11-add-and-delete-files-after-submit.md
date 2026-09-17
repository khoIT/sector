---
phase: 11
title: "Add and delete files after submit"
status: pending
priority: P1
effort: "3d"
dependencies: [9]
---

# Phase 11: Add and delete files after submit

## Overview

Let the owner add files to a submitted scan and remove a single file, from
the scan detail page, while the scan is still unreviewed. The api-client
already wraps both writes (`addScanFiles`, `deleteScanFiles` in
`scan-write.ts`) but only create-scan's draft recovery calls them; the server
side of delete has no ownership check and hard-deletes File documents. Guard
first, then UI. This reverses the flag-doc decision that recorded
`scan-vault-scan-details-page-add-file` as permanently dropped.

## Requirements

**Functional**

- Scan detail (owner, scan `pending`/`submitted`, no review yet): an
  "Add files" control opens the same drop zone and upload pipeline create-scan
  uses; new files upload, confirm, and appear in the file list.
- Each file row (same conditions) gets a "Remove" action with confirm; the
  last file cannot be removed (a scan with zero files is not a study — delete
  the scan instead, which already exists).
- Once any review exists, both controls are absent, and the server refuses.
- Reviewers see nothing new.

**Non-functional**

- Server: ownership + state checks on `POST /api/scan/:id/files`
  (add) and `DELETE /api/scan/:id/files`; soft-delete File documents
  (`deletedAt`) instead of hard delete, and write a `scanLogs` entry for both.
- Web feature-detects: against the staging API the controls hide on 403/404.
- Reuse, do not duplicate: the upload machinery in
  `apps/web/src/features/create-scan/model/` (blob store, part uploads,
  confirm) is lifted into a hook usable by scan detail; no second uploader.
- Strings via `t()` (`scanDetail.files.*`) in seven locales.

## Architecture

```
API (worktree, feat/sector-*)
  scan.route.ts
    POST   /api/scan/:id/files     authUser + assertScanOwner + assertUnreviewed
    DELETE /api/scan/:id/files     authUser + assertScanOwner + assertUnreviewed + notLastFile
  scan-access.ts                    assertScanOwner already exists for reads — extend for writes
  file.service                      softDelete(fileIds) sets deletedAt; readers filter it
  scanLogs                          'files_added' / 'file_removed'

api-client
  endpoints/scan-write.ts           addScanFiles / deleteScanFiles unchanged signatures;
                                    response schemas get a fidelity decision if widened
web
  features/create-scan/model/use-upload-pipeline.ts   NEW: extracted from the draft hook
  features/scan-detail/components/scan-file-list.tsx  + Remove action, confirm dialog
  features/scan-detail/components/add-files-panel.tsx NEW: drop zone + progress, owner-only
  features/scan-detail/scan-detail-page.tsx           mounts both, gated by capability probe
```

Capability probe: the detail page already knows owner + review state from the
scan payload; server support is inferred from the first write's status — a
403/404 flips a per-session flag that hides the controls (same pattern phase 9
establishes).

## Related Code Files

- API side — Modify: `src/app/scan/scan.route.ts`, `src/app/scan/scan-access.ts`,
  the files controller under `src/app/scan/controllers/`, the File service
  under `src/database/file/`; Create: functional tests under `tests/functional/scan/`
  (`scan-files-ownership.test.ts`, `scan-files-soft-delete.test.ts`).
- api-client — Modify: `packages/api-client/src/endpoints/scan-write.ts`
  (only if response shapes change); `packages/api-client/src/fidelity/manifest.ts`
  (decision for any new schema).
- web — Create: `apps/web/src/features/create-scan/model/use-upload-pipeline.ts`,
  `apps/web/src/features/scan-detail/components/add-files-panel.tsx`,
  `.../components/remove-file-dialog.tsx`; Modify:
  `apps/web/src/features/scan-detail/components/scan-file-list.tsx`,
  `apps/web/src/features/scan-detail/scan-detail-page.tsx`,
  `apps/web/src/features/create-scan/model/use-create-scan-draft.ts` (consume
  the extracted hook), `apps/web/src/i18n/locales/*.json`.
- docs — Modify: `docs/feature-flags-decision.md` row for
  `scan-vault-scan-details-page-add-file`: "reinstated as a native surface,
  16 Sep 2026 brainstorm; server-guarded".

## Tests Before

- API: functional tests proving today's behaviour — a non-owner with
  `edit:scan` can DELETE files (expected to pass now, then flip to 403 after
  the guard); a delete hard-removes the File document.
- Web: `submit-draft.ts` tests pin the add-files call sequence during draft
  recovery; they must pass unchanged after the pipeline extraction.
- Web: `scan-file-list` render test pins current rows (no Remove action).

## Refactor

- Extract `use-upload-pipeline.ts` from `use-create-scan-draft.ts` with an
  identical public surface for the draft; the draft hook becomes a consumer.
- File readers (list, media viewer, counts) filter `deletedAt: null`.

## Tests After

- API: owner adds → 200 + scanLog; non-owner → 403; reviewed scan → 409;
  removing the last file → 409; removed file is soft-deleted and absent from
  GET scan.
- Web: Remove shows confirm, calls `deleteScanFiles`, optimistic row removal
  rolls back on error; Add files uploads through the shared pipeline and
  refreshes the list; controls hidden for reviewer, for reviewed scans, and
  after a 403.

## Implementation Steps

1. API guard + soft delete + logs + tests (API repo, its own branch and PR).
2. Extract the upload pipeline hook; run create-scan tests unchanged.
3. `add-files-panel.tsx` and `remove-file-dialog.tsx`; wire into the file list
   and detail page; capability flag on 403/404.
4. Locale keys; flag-doc row update.
5. Browser pass: add two files and remove one on a fresh scan against the
   local API; confirm the controls are absent against staging.

## Regression Gate

```
# API repo
pnpm vitest run --no-file-parallelism tests/functional/scan
# scanvault
pnpm --filter @sector/api-client test
pnpm --filter @sector/web test -- src/features/scan-detail src/features/create-scan
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] Server refuses add/delete for non-owners (403) and for reviewed scans (409).
- [ ] File removal is soft; the document survives with `deletedAt`.
- [ ] Owner can add files and remove one from scan detail; last file protected.
- [ ] Controls absent against the staging API (feature-detect), for reviewers,
      and after review.
- [ ] Draft recovery in create-scan unchanged (its tests pass untouched).
- [ ] No horizontal scroll at 390px on scan detail with the panel open.

## Risk Assessment

- **Exposure before the guard lands** → UI work may start, but nothing merges
  to `main` until the API guard is on staging; tracked as a blocker in plan.md.
- **Hard-delete history**: files already hard-deleted are gone; nothing to
  recover, note it.
- **Pipeline extraction regressions** → the draft tests are the net; extract
  with zero public-surface change.

## Security Considerations

- Ownership check server-side on both routes; state check (no reviews) so a
  learner cannot alter evidence after assessment.
- Soft delete preserves the audit trail and the `scanLogs` entry names the
  actor and file ids.
- Uploads go through the existing presigned flow; no new S3 permission.
