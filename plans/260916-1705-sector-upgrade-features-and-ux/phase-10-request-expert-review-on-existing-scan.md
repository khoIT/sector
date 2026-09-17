---
phase: 10
title: "Request expert review on existing scan"
status: pending
priority: P1
dependencies: [9]
---

# Phase 10: Request expert review on an existing scan

## Overview

The monetised path. As with phase 9, the Sector UI **already exists** — shipped 14 Sep in
`60a4fd2`, after the parity audit that listed it open:

- `apps/web/src/features/scan-detail/components/request-expert-review-dialog.tsx:47` reuses the
  wizard's credit picker (`features/create-scan/components/expert-review-panel.tsx`) rather than
  duplicating it, and reads `EXPERT_REVIEW_TAG` as the "already requested" record (`:60`);
- entry points: My Scans row menu (`scan-row-menu.tsx:173, 281-289`, gated by
  `rowActionsFor` → `request-expert-review` at `scan-row-actions.ts:115-116`) and the detail
  header (`scan-detail-page.tsx:102-106, 119-125`).

Two things are missing.

1. **The server guard.** `POST /api/scan-review/request-expert` carries `authUser` and *no*
   `withPermission` (`src/app/scan-review/scan-review.route.ts:18`), and the controller never
   compares the caller to the scan's owner (`scan-review.controller.ts:281`+). A stranger can
   spend **their own** credit on **someone else's** scan — and the `group` branch then links
   that scan into the caller's group (`groupUserScanService.create`), which pushes another
   learner's study into a group whose reviewers should never have seen it. That is a data
   exposure, not only a credit-spend bug.
2. **The payment-return alert.** `purchase-credits-dialog.tsx:78-79` already sends the server
   `successUrl`/`cancelUrl` ending in `?purchase=success` / `?purchase=cancelled`; nothing in
   `apps/web` reads that parameter. A learner returning from Stripe lands on a page that says
   nothing happened. Legacy handled it at `gusi_web_dashboard/src/pages/dashboard/scans/my-scans/page.tsx:72-109`.

## Requirements

**Functional**

- Only the scan's owner may request an expert review on it. Everyone else: 403, no credit
  debited, no purchase row, no group link, no tag.
- The existing preconditions stay: scan exists, not `reviewed`, no prior purchase, the credit
  pool belongs to the caller (`type: 'user'` already enforces `typeId === userId`;
  `type: 'group'` enforces membership).
- Two concurrent requests on the same scan debit at most one credit.
- Returning from Stripe with `?purchase=success` or `?purchase=cancelled` shows a dismissible
  notice on the landing route and refreshes the credit balance; the parameter is then stripped
  from the URL.
- When the route answers 403/404, the action hides itself rather than erroring.

**Non-functional**

- No second copy of the credit picker or the purchase dialog (both already shared).
- Seven-locale `t()` coverage for the new notice; zero baseline additions.
- No horizontal scroll at 390px on `/scans/my`, `/scans/my/:scanId`, `/scans/create`.
- Money path: every refusal must leave the ledger untouched, provably, in a test.

## Architecture

```
owner clicks "Request expert review" (My Scans row | detail header)
  → RequestExpertReviewDialog (web)  → ExpertReviewPanel (credit pool choice, shared with the wizard)
  → useRequestExpertScanReview (api-client react/use-scan-review-credits.ts:37)
  → requestExpertScanReview (api-client endpoints/scan-review-credits.ts:30)
  → POST /api/scan-review/request-expert
       authUser                                        [exists]
       assertScanOwnedByCaller                         [NEW]
       reviewed? prior purchase? pool valid?           [exists]
       debit pendingReview, create purchase, add tags  [exists]
       group branch: link scan→group                   [exists, now owner-only]
       email every create:scan:review holder           [exists]
  ← 200 → invalidate credits + scan detail on all five views (dialog already does this)
  ← 403 → hide the action

no credits → PurchaseCreditsDialog → POST /api/scan-review/credits/purchase
  → Stripe Checkout (external) → returns to successUrl/cancelUrl chosen by the CLIENT
  → usePurchaseReturnNotice (web, NEW) reads ?purchase=, shows notice, refetches credits,
    strips the param
```

Ownership: API repo owns the guard, the idempotency index and their tests. `packages/api-client`
owns nothing new (no schema change). `apps/web` owns the return notice and the hide-on-403 path.

## Related Code Files

**API side** (`gusi_nodejs_api`)

- Modify `src/app/scan-review/scan-review.controller.ts` — `requestScanReviewExpert`: owner check
  immediately after the `if (!scan)` guard.
- Modify `src/app/scan-review/scan-review.route.ts:18` — add
  `withPermission(['create:scan'])`, the permission every learner who can create a scan holds,
  so the route stops being the only write in the family with no permission line at all.
- Modify `src/database/scan-review-purchase/scan-review-purchase.model.ts` — partial unique index
  on `scan` (excluding soft-deleted rows) so the duplicate check cannot be raced.
- Modify `tests/functional/scan-review/request-expert.test.ts`.
- Create `tests/functional/scan-review/request-expert-ownership.test.ts`.

**api-client**

- Modify `packages/api-client/src/endpoints/scan-review-credits.ts:22-29` — document the 403.
  No schema change; `purchaseCreditsPayloadSchema` / `purchaseCreditsResponseSchema` are already
  request/response shapes and already excused in `packages/api-client/src/fidelity/manifest.ts`
  under `NOT_REPLAYED` (verify the two names are listed; if either is absent, add it with the
  reason "request body / Stripe session response, no collection to replay against").

**web**

- Create `apps/web/src/features/scan-list/purchase-return-notice.tsx` (+ test) — reads
  `?purchase=`, renders the notice, refetches `useScanReviewCredits`, strips the param.
- Modify `apps/web/src/features/scan-list/pages/scan-list-page.tsx` — mount it for `view === 'my'`.
- Modify `apps/web/src/features/create-scan/create-scan-page.tsx` — mount it too (the wizard is
  the other origin of a purchase).
- Modify `apps/web/src/features/scan-detail/components/request-expert-review-dialog.tsx` — on a
  403 from the mutation, close and report "not available for this study" rather than the raw
  server message.
- Modify `apps/web/src/features/scan-list/rows/scan-row-actions.ts` — no rule change; add the
  comment that the server now enforces ownership too.
- Modify `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`.

## Tests Before

API:

1. The owner requesting with `type: 'user'` and their own pool → 200, one purchase row,
   `pendingReview` down by exactly 1, `expert_scan_review` tag added.
2. The owner requesting with `type: 'group'` for a group they belong to → 200 and the
   `groupUserScan` link is created.
3. A second request on the same scan → 400 "already has an existing expert scan review request",
   ledger unchanged.
4. A failure after the debit rolls the purchase back (the existing `createdPurchaseId` path,
   `scan-review.controller.ts` tail) — pin it; the guard must not break the rollback.

Web:

5. `request-expert-review-dialog` render test: with `expert_scan_review` in `tags`, the picker is
   replaced by the "already requested" notice (pins `:97-101`).
6. `scan-row-actions.test.ts`: the action appears only on `my`, only when `isOwnScan`, only for
   status `submitted` (pins `EXPERT_REVIEWABLE_STATUSES`).

## Refactor

1. `assertScanOwnedByCaller(userId, scan)` — a two-line helper beside the controller (or reuse
   `resolveOwnerId` from `src/app/scan/scan-access.ts:74` and compare), throwing
   `HttpError(403, 'You can only request a review on your own scan')`. It runs **before** any
   pool lookup so no credit is even read for a refused call.
2. Add `withPermission(['create:scan'])` on the route.
3. Partial unique index on `scanreviewpurchases.scan`; catch the duplicate-key error in the
   controller and convert it to the existing 400 message so the response contract is unchanged.
4. Extract nothing on the web side. The picker and the purchase dialog are already shared
   (`request-expert-review-dialog.tsx:22`); duplicating them was the thing to avoid and it was
   avoided.

## Tests After

API — `request-expert-ownership.test.ts`:

- a non-owner with their own funded pool → 403; `scanreviewpurchases` count unchanged;
  `pendingReview` unchanged; the scan's `tags` unchanged; no `groupUserScan` row created;
- a non-owner who leads a group the owner belongs to → still 403 (this is a purchase, not a
  review action);
- `full-access` non-owner → 403 (spending is owner-only regardless of privilege);
- owner → 200, all existing assertions still hold;
- two parallel owner requests → exactly one 200 and one 400, one purchase row, one credit spent.

Web:

- `purchase-return-notice.test.tsx` — `?purchase=success` renders the success notice and calls
  the credits refetch; `?purchase=cancelled` renders the cancel notice; neither leaves the
  parameter in the URL; an unrelated query string renders nothing.
- dialog test — a 403 mutation result closes the dialog and the row action is not offered again
  for that scan in the session.

## Implementation Steps

1. **API guard first.** Branch `feat/sector-request-expert-ownership` off `feat/sector-api`.
   Write the Tests Before cases, run green.
2. Add the owner check at the top of `requestScanReviewExpert`, before the reviewed/purchase
   checks, so a refused caller triggers no reads of another user's credit pool.
3. Add `withPermission(['create:scan'])` to `scan-review.route.ts:18`.
4. Add the partial unique index and the duplicate-key → 400 translation.
5. Write `request-expert-ownership.test.ts`; run the scan-review suites.
6. **api-client.** Document the 403 in the wrapper comment. Confirm both purchase schemas are
   named in `NOT_REPLAYED`; add with a reason if not.
7. **Web — return notice.** Build `purchase-return-notice.tsx`: read the param with
   `useSearchParams`, render an `InlineNotice`-style dismissible banner, call the credits query's
   `refetch`, then `setSearchParams` without the key (replace, not push, so Back does not
   re-show it).
8. Mount it on the My Scans list and on the create-scan page. Both are routes a Stripe return can
   land on because the URL is built from `window.location.pathname` at purchase time.
9. **Web — hide on 403.** In the dialog's `catch`, treat `isApiError(e).isForbidden` as "not
   available": show the translated sentence, and lift a flag so the row/detail action is not
   re-offered for that scan while the page lives.
10. **i18n.** Add every new string to the seven locale files; run the gate.
11. **Mobile.** Notice and dialog at 390px; the notice must not push the table into overflow.
12. **Docs.** Mark the parity rows "Request Expert Scan Review (and its payment-return alert) is
    absent from My Scans" and "Expert review can no longer be requested for an already-submitted
    scan" fixed.

## Regression Gate

```bash
# scanvault
pnpm --filter @sector/api-client test
pnpm --filter @sector/web test
pnpm -w typecheck
pnpm -w lint

# gusi_nodejs_api
pnpm test:functional tests/functional/scan-review --no-file-parallelism
pnpm test:functional tests/functional/scan-review-purchase --no-file-parallelism
pnpm typecheck
```

## Success Criteria

- [ ] A non-owner request returns 403 and leaves `scanreviewpurchases`, `scanreviewrequests`,
      `scan.tags` and `groupuserscans` byte-identical.
- [ ] The owner path is unchanged: one credit, one purchase row, the `expert_scan_review` tag,
      the reviewer email.
- [ ] Two parallel requests on one scan produce one 200 and one 400, and exactly one debit.
- [ ] Returning from Stripe with `?purchase=success` shows a notice, refreshes the balance and
      removes the parameter; Back does not re-show it.
- [ ] UI hides the action when the route answers 403/404 against the staging API.
- [ ] No horizontal scroll at 390px on touched routes.
- [ ] Zero additions to `locale-completeness-baseline.json`.

## Risk Assessment

| Risk | L×I | Mitigation |
| --- | --- | --- |
| A refused request leaves a half-debited ledger | L×H | Guard runs before any pool read; the existing rollback path is pinned by a Tests-Before case |
| The unique index fails to build on a collection that already holds duplicates | M×M | Count duplicates on the **local mirror** first (`db.scanreviewpurchases.aggregate` group by `scan`, read-only); if any exist, build the index `{ unique: true, partialFilterExpression: { deletedAt: null } }` and hand the duplicate list to the API team before merging |
| Adding `withPermission(['create:scan'])` locks out a role that could previously request | M×M | Enumerate roles holding `create:scan` on the mirror before merging; if any requester role lacks it, drop this step — the ownership check is the control that matters |
| The Stripe return lands on a route with no notice mounted | M×L | The URL is built from `window.location.pathname`; both origins (My Scans, create-scan) mount it. Add a test that asserts the two mount sites |
| Rollback | — | API: revert the controller check and the route line; the index can stay (it enforces an invariant the controller already claimed). Web: revert the notice component and its two mounts |

## Security Considerations

- Closes item 3's second bullet of the incidental-security-findings report: "any authenticated
  account can spend a credit against any scan id".
- Also closes an unreported consequence found while planning: the `group` branch creates a
  `groupUserScan` row, so an unguarded request **discloses another learner's scan to the
  caller's group reviewers**. Call this out to the API team explicitly.
- `successUrl` / `cancelUrl` are client-supplied and the server passes them straight to Stripe
  (`scan-review.controller.ts:855-856` → `stripe.service.ts:202-203`). Sector only ever sends
  same-origin URLs built from `window.location`. Flag to the API team that the route accepts any
  absolute URL — an open redirect through a payment provider — but do **not** fix it here: it is
  outside this phase's scope and changing it could break the deployed mobile client.
- No secret is added to the web bundle. Stripe keys stay server-side; the client only receives a
  session URL.
- The notice must not echo anything from the query string into the DOM beyond the two known
  literal values, and must render a translated string, never the raw parameter.
