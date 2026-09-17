---
phase: 12
title: "Reset-upload recovery"
status: pending
priority: P2
effort: "1.5d"
dependencies: [11]
---

# Phase 12: Reset-upload recovery

## Overview

Finish the recovery path for a scan whose upload failed or stalled: guard the
server reset, then make the entry points reachable and verify the whole flow
end to end. Pieces exist — `resetScanUpload` in the api-client,
`reset-upload-dialog.tsx` in scan detail, and create-scan seeding a draft
from `?reset=<id>` — but the server `scan-reset.controller` has no ownership
check and zeroes `fileCount` (491 resettable scans in the mirror), and the
parity audit found no reachable "Reset for re-upload" action.

## Requirements

**Functional**

- Owner of a scan in `pending`/`failed` with missing or failed files sees
  "Reset and re-upload" on the scan detail page and on its My Scans row.
- Confirming resets the scan server-side and lands the owner on
  `/scans/create?reset=<id>` where the existing seeding fills the draft
  (scan type, findings, note, routing) and the file list shows which files
  are still in storage and which must be chosen again.
- Submitting completes the same study (same id, same notifications), not a
  new one.
- Not offered when the scan has any review, or to non-owners.

**Non-functional**

- Server: owner-only, state-gated (only when `fileCount < fileTotal` or a
  file is `failed`), never on reviewed scans; writes a `scanLogs` entry.
- Web feature-detects (hide on 403/404 against staging).
- Strings under `scanDetail.reset.*` / `scanList.reset.*`, seven locales.

## Architecture

```
API   PUT /api/scan/:id/reset-upload
        authUser → assertScanOwner → assertResettable(scan) → reset → scanLogs('upload_reset')

web   scan-detail-page.tsx ── [Reset and re-upload] ──► ResetUploadDialog (exists)
      scan-list/rows/scan-row-actions.ts ── row action when resettable(scan)
                       │ confirm
                       ▼
      resetScanUpload(id)  ──►  navigate('/scans/create?reset=<id>')
                                      │
                                      ▼
      create-scan-page.tsx  useEffect(resetScanId) → seedFromReset()  (exists)
```

`resettable(scan)` is one pure predicate in `scan-list/rows/scan-outcome.ts`
(or a sibling) used by both the row action and the detail page, so the two
never disagree.

## Related Code Files

- API side — Modify: `src/app/scan/controllers/scan-reset.controller.ts`
  (verify exact filename in the worktree), `src/app/scan/scan.route.ts`,
  `src/app/scan/scan-access.ts`; Create: `tests/functional/scan/scan-reset-upload.test.ts`.
- api-client — Read: `packages/api-client/src/endpoints/scan-reset-upload.ts`
  (no change expected).
- web — Modify: `apps/web/src/features/scan-detail/scan-detail-page.tsx`,
  `apps/web/src/features/scan-detail/components/reset-upload-dialog.tsx`,
  `apps/web/src/features/scan-list/rows/scan-row-actions.ts` (+ its test),
  `apps/web/src/features/scan-list/rows/scan-row-menu.tsx`,
  `apps/web/src/features/scan-list/rows/scan-outcome.ts` (predicate),
  `apps/web/src/i18n/locales/*.json`. Read: `apps/web/src/features/create-scan/create-scan-page.tsx`
  (the `resetScanId` seeding, lines ~100–120).

## Tests Before

- API: functional test showing a non-owner can reset today (then flips to 403).
- Web: `scan-row-actions.test.ts` pins the current action set per role and
  state; `create-scan-page` seeding tests (or add one) pin that `?reset=<id>`
  fills the draft and asks confirmation when a draft already exists.

## Refactor

- Detail page and row menu call the shared `resettable()` predicate; dialog
  gains the navigate-after-success step if it lacks it.

## Tests After

- API: owner + resettable → 200 + log; non-owner → 403; reviewed → 409;
  complete scan → 409.
- Web: action visible only when `resettable()`; confirm → api call →
  navigation with `?reset=`; hidden after a 403.
- E2E (Playwright, local API): upload two files, kill one mid-flight (or mark
  it failed through the API test hook), reset, re-upload, submit; the scan
  keeps its id and reaches `submitted`.

## Implementation Steps

1. API guard + tests.
2. `resettable()` predicate + tests.
3. Wire row action and detail button to the existing dialog; navigate on
   success.
4. Locale keys.
5. E2E flow against the local API; confirm absence against staging.

## Regression Gate

```
# API
pnpm vitest run --no-file-parallelism tests/functional/scan
# scanvault
pnpm --filter @sector/web test -- src/features/scan-detail src/features/scan-list src/features/create-scan
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] Non-owner and reviewed-scan resets refused server-side.
- [ ] Owner can reset from row and detail; lands in create-scan with the draft
      seeded; submit completes the same scan id.
- [ ] Action absent against staging and for non-resettable scans.
- [ ] No horizontal scroll at 390px on the touched routes.

## Risk Assessment

- **Reset on a scan whose files are all fine** → predicate refuses; server
  refuses too.
- **Draft collision**: an open unrelated draft exists → the existing
  `DiscardDraftDialog` flow in create-scan handles it; test covers it.

## Security Considerations

- Owner-only, state-gated, logged. Reset never touches File documents or S3
  objects; it only re-opens the upload window.
