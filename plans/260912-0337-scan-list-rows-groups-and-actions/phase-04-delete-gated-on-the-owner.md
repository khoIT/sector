---
phase: 4
title: "Delete gated on the owner"
status: pending
priority: P2
dependencies: [3]
---

# Phase 4: Delete gated on the owner

## Overview

Add Delete to the row menu — and, unlike the legacy dashboard, only on rows the signed-in user
owns, because the server will not make that distinction for us.

## Requirements

- Functional: a learner can delete their own scan from any list that shows it, with a
  confirmation naming the scan; the list updates without a full refetch of the page they are
  on; a failure leaves the row in place and says why.
- Non-functional: the item never renders on a scan the user does not own, on any view.

## Architecture

### What the server actually enforces

`DELETE /api/scan/:scanId/delete` (`gusi_nodejs_api/src/app/scan/scan.route.ts:32`) is guarded
by `withPermission(['delete:scan'])`. Two facts make that guard empty:

1. **All five roles hold `delete:scan`** — `subscriber`, `scan reviewer`, `group leader`,
   `administrator`, `Superadmin`. Verified against the `roles` collection. A permission every
   role holds distinguishes nobody.
2. **The controller does no ownership check.** `deleteScanById`
   (`src/app/scan/controllers/scan.controller.ts:1003`) loads the scan, 404s if missing, and
   soft-deletes it. It never compares `scan.user` to `req.user.id`.

So any signed-in user who can see a scan id can delete that scan. The legacy dashboard puts
Delete on group-queue and reviewed rows — which are, by definition, **other people's scans** —
with no client-side ownership check either. Copying that is copying a way to lose a learner's
work in one click.

### The decision

Render Delete only when `scan.user.id === user.id`. This is a deliberate deviation from
parity, and it costs nothing real: a reviewer deleting a learner's submission is not a
workflow anyone asked for, and an administrator who genuinely needs it can still act through
the legacy dashboard or the API until the server grows a proper rule.

`delete:scan` is still checked, because the server checks it and a role could lose it later.
It is the second condition, not the first.

**For the API backlog, not this phase:** `deleteScanById` needs an ownership-or-elevated-role
check, and `delete:scan` needs to stop being universal. Worth raising with Liesl before the
next sprint — it is a data-loss path open to every account.

### Behaviour

Soft delete (`softDeleteById`), so the row disappears from lists and the record survives. The
confirmation says "Delete" not "Delete permanently", and does not promise recoverability
through any UI, because Scan Vault has no undelete surface.

On success, invalidate the scan list query key for the current view rather than removing the
row optimistically — the list is server-paginated, so dropping a row locally leaves the page
one short and the total count wrong until the next fetch.

## Related Code Files

- Create: `packages/api-client/src/endpoints/scan-delete.ts` — `deleteScan(client, scanId)`
- Create: `packages/api-client/src/react/use-scan-delete.ts` — mutation + list invalidation
- Modify: `packages/api-client/src/index.ts` — export both
- Create: `apps/web/src/features/scan-list/rows/delete-scan-dialog.tsx`
- Modify: `apps/web/src/features/scan-list/rows/scan-row-menu.tsx` — the gated item
- Create: `packages/api-client/src/scan-delete.test.ts`

## Implementation Steps

1. `scan-delete.ts`: `client.del('/api/scan/${scanId}/delete')`. The response envelope carries
   the deleted scan; nothing needs it, so return void and do not invent a schema for it.
2. `use-scan-delete.ts`: on success invalidate the `scans` list keys. Check `query-keys.ts`
   for the existing key shape before choosing what to invalidate.
3. `delete-scan-dialog.tsx`: an alert-style Dialog naming `scan.title`, destructive confirm
   button, disabled while pending, error rendered inline on failure.
4. In `scan-row-menu.tsx`, gate on `isOwnScan && hasPermission(user, 'delete:scan')`, render
   the item in `--crit`, separated from the rest.
5. Test the endpoint call shape and the gate: not own scan → no item; own scan without the
   permission → no item; own scan with it → item present.

## Tests / Validation

- `pnpm --filter @scanvault/api-client test`, `--filter @scanvault/web test`, `-w typecheck`
- By hand against staging with a throwaway scan: confirm it leaves the list and that the
  total count on the toolbar updates
- Confirm on `/scans/group` that no row offers Delete while signed in as a reviewer

## Risk Assessment

- **Deviation from the legacy UI is visible to users who know it.** Someone used to deleting
  from the group queue will notice. Stated above; the user's call to reverse.
- **Invalidation on a filtered, sorted, paged list.** Deleting the last row on the last page
  leaves the user on an empty page. Clamp to the new last page after the refetch — the
  pagination control already knows `lastPage`.
- **Irreversible from the user's point of view.** Soft delete means recoverable by an
  engineer, not by the learner. Do not word the dialog as if it were undoable.
- Rollback: revert; the menu loses one item and no data is affected.
