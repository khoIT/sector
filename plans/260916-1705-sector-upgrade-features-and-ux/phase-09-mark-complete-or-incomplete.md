---
phase: 9
title: "Mark complete or incomplete"
status: pending
priority: P1
dependencies: [1, 7]
---

# Phase 9: Mark complete or incomplete

## Overview

**The premise in the brainstorm is stale.** The reviewer UI for this already shipped on
14 Sep (`60a4fd2`, `61b4347`), one day after the parity audit that reported it missing.
Verified now on `main`:

- row actions `mark-complete` / `mark-incomplete` — `apps/web/src/features/scan-list/rows/scan-row-actions.ts:117-118`
- row menu wiring and the failure dialog — `apps/web/src/features/scan-list/rows/scan-row-menu.tsx:177-181, 291-313`
- detail-page controls — `apps/web/src/features/scan-detail/scan-detail-page.tsx:59, 176-189` →
  `components/scan-context-panel.tsx:182-201`
- the mutual-exclusion hook — `apps/web/src/features/scan-list/rows/use-scan-completion-tag.ts:21`
- the filter already reads the same vocabulary — `apps/web/src/features/scan-list/table/filter-spec.ts:70-72`,
  so the "write-only filter" row in the parity backlog is closed by code that is already merged.

What is **not** done is the half the ordering rule cares about. `POST` / `DELETE
/api/scan/:scanId/tags` carry `withPermission(['edit:scan'])` and nothing else
(`scan.route.ts:90-91`); `scan-tag.controller.ts` looks the scan up by id and writes
(`:41-49`, `:95-103`). Every role in the production mirror holds `edit:scan`, so any
authenticated account can flip any scan id — and Sector is already the client that
offers it from a screen. This phase closes that, and only then re-opens the UI work
(feature-detection, i18n, mobile) around it.

The `incomplete` email to the learner is server-side and must survive:
`scan-tag.controller.ts:51-78` (`mail.reviewIncompleteScan`, gated on
`userSettingService.isNotificationEnabled(SCAN_MARKED_INCOMPLETE, EMAIL)`).

## Requirements

**Functional**

- A caller may write a completeness tag on a scan only if they may already read that scan
  by id under the existing rule (`assertScanReadableById`). Everyone else gets the answer
  that endpoint already gives for an unreadable scan.
- The `incomplete` email still fires exactly once, still honours the learner's notification
  setting, still carries the reviewer as `replyTo`.
- The two tags stay mutually exclusive (client-enforced today; unchanged).
- A reviewer marking a scan can then find it with the list's Complete / Incomplete filter
  without a reload beyond the existing invalidation.
- When the tag route answers 403 or 404, both call sites stop offering the action instead of
  re-presenting a write that cannot land.

**Non-functional**

- No change to `scanService.addTag`'s `$push` semantics (mobile clients depend on the route).
- Guard adds at most one membership query, and only for a group-scoped caller.
- All reviewer-facing strings through `t()` in seven locales, zero baseline additions.
- No horizontal document scroll at 390px on `/scans/*` and `/scans/*/:scanId`.

## Architecture

```
reviewer click (row menu | context panel)
  → useSetScanCompletionTag  (web, apps/web/src/features/scan-list/rows/use-scan-completion-tag.ts:21)
  → completionTagMutation    (web, rows/scan-tags.ts:87 — remove opposite, then add)
  → removeScanTag / addScanTag (api-client, endpoints/scan-tags.ts:34, :23)
  → DELETE|POST /api/scan/:scanId/tags
  → withPermission(['edit:scan'])                        [exists]
  → assertScanTagWritable(...)                           [NEW, this phase]
  → scanService.removeTag | addTag  (+ incomplete email) [exists]
  ← 200 → React Query invalidation → list row + detail panel re-render
  ← 403/404 → hook marks the action unavailable → both surfaces hide it
```

Ownership split: the API repo owns the guard and its functional tests; `packages/api-client`
owns only the doc comment on the two wrappers (no signature change); `apps/web` owns the
unavailable-state plumbing, the locale keys and the mobile pass.

## Related Code Files

**API side** (`gusi_nodejs_api`, worktree `.../wt/api`, branch off `feat/sector-api`)

- Modify `src/app/scan/scan-access.ts` — add `assertScanTagWritable`, built on the existing
  `resolveOwnerId` (`:74`) and reusing the rule shape of `assertScanReadableById` (`:100`).
- Modify `src/app/scan/controllers/scan-tag.controller.ts` — call the guard in `addScanTag`
  (after `:44`) and `removeScanTag` (after `:98`), before any write.
- Create `tests/functional/scan/tags/scan-tag-access.test.ts`.
- Modify `tests/functional/scan/tags/add-scan-tag.test.ts`, `remove-scan-tag.test.ts` — the
  fixtures now need a caller who legitimately passes the guard.

**api-client**

- Modify `packages/api-client/src/endpoints/scan-tags.ts` — record the new 403/404 contract in
  the comments at `:11-22` and `:33`. No schema change, so no fidelity-manifest entry: the
  payload type `scanTagPayloadSchema` is already carried, and `scanSchema.tags` is already
  proved by the `scans` replay entry (`packages/api-client/src/fidelity/manifest.ts:71-100`).

**web**

- Modify `apps/web/src/features/scan-list/rows/use-scan-completion-tag.ts` — expose
  `isUnavailable` (last error was 403/404, via `isApiError(e).isForbidden || .isNotFound`).
- Modify `apps/web/src/features/scan-list/rows/scan-row-menu.tsx` — drop the two actions when
  `isUnavailable`.
- Modify `apps/web/src/features/scan-detail/scan-detail-page.tsx`, `components/scan-context-panel.tsx`
  — same, via the existing `canEditCompletion` prop.
- Modify `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`.
- Modify `README.md:277` (claims scan tags are not ported) and the parity backlog rows.

## Tests Before

API (`gusi_nodejs_api`), written against the unguarded source so they pass now and keep
passing after:

1. The owner of the scan can add and remove both tags → 200.
2. A holder of `read:scan:pending` + `read:scan:reviewed` (the reviewer class) can tag a scan
   they do not own → 200.
3. Adding `incomplete` sends exactly one email and only when
   `isNotificationEnabled(SCAN_MARKED_INCOMPLETE, EMAIL)` is true; `replyTo` is the caller.
4. Adding the same tag twice still pushes twice (the `$push` behaviour the client compensates
   for) — pins that this phase does not change write semantics.

Web (`apps/web`, vitest):

5. `scan-row-actions.test.ts` — extend: both completeness actions appear on `pending` /
   `reviewed` / `expert` / `expert-reviewed` for a caller with `edit:scan`, and never on
   `my` / `shared`.
6. New `use-scan-completion-tag.test.ts` — the ordered remove→add sequence and the
   resolve-on-failure contract, pinned before `isUnavailable` is added.

## Refactor

1. `assertScanTagWritable(userId, scan, userPermissions)` in `scan-access.ts`: return early for
   `permissions.FULL_ACCESS`; allow the owner; allow a holder of both unscoped read
   permissions; otherwise, for a group-scoped holder, allow only when the scan's owner is an
   active member of a group the caller leads (`groupMemberService.getGroupIdsByLeaderId` +
   `isActiveMemberOfAnyGroup`, exactly as `:126-131`); else throw. Answer **403**, matching
   `assertScanReadableById` — the caller reached this scan through a detail page that already
   told them it exists, so 404 would leak nothing extra and would read as a bug.
2. Both tag writers call it immediately after the `if (!scan)` check.
3. Do **not** change `addTag` to `$addToSet`. The duplicate-tolerant write is what the deployed
   mobile client and the client-side `completionTagMutation` were built around; tightening it
   is a separate decision with a wider blast radius than this phase's.

## Tests After

API — `tests/functional/scan/tags/scan-tag-access.test.ts`:

- a `subscriber`-shaped role holding `edit:scan` and nothing else → 403 on POST and on DELETE,
  and the scan's `tags` array is unchanged afterwards;
- a group leader of the owner's group → 200;
- a group leader of a *different* group → 403;
- `full-access` → 200;
- the owner → 200;
- the `incomplete` email fires on the allowed path and not on the refused one.

Web:

- `use-scan-completion-tag.test.ts` — a 403 and a 404 each set `isUnavailable`; a 500 does not.
- `scan-row-menu` render test — with `isUnavailable`, neither completeness item is in the menu.
- Locale parity + completeness gates cover the new keys.

## Implementation Steps

1. **API guard.** In the API worktree, branch `feat/sector-scan-tag-access` off `feat/sector-api`.
   Write the "Tests Before" API cases first and run them green against unmodified source.
2. Add `assertScanTagWritable` to `src/app/scan/scan-access.ts` with a comment stating the rule
   and why it answers 403.
3. Call it in `scan-tag.controller.ts` `addScanTag` and `removeScanTag`, before the service call.
4. Write `scan-tag-access.test.ts` (Tests After) and run the scan suites.
5. **api-client.** Update the two wrapper comments in `endpoints/scan-tags.ts` to name the new
   403. No behaviour change, no new export.
6. **Web — feature detection.** In `use-scan-completion-tag.ts`, keep the current
   resolve-on-failure contract and add `isUnavailable`, derived from the stored error. Do not
   swallow other errors: a 500 must still surface in the dialog.
7. Hide the actions when unavailable: filter them out in `scan-row-menu.tsx` before rendering,
   and pass `canEditCompletion && !completionTag.isUnavailable` from `scan-detail-page.tsx`.
8. **Web — i18n.** Move every remaining hard-coded string on the two touched surfaces through
   `t()` and add the keys to all seven locale files. Run the completeness gate; the baseline
   file must not grow.
9. **Web — mobile.** With phase 1's card-row fallback in place, check the row menu and the
   context panel at 390px.
10. **Docs.** Correct `README.md:277`; mark the three parity rows (major "Reviewer cannot mark a
    study complete/incomplete", cross "Reviewers can no longer mark a scan complete/incomplete",
    and the write-only filter note) as fixed, with the commit that fixed them.
11. **Staging check.** Against the staging API (10 Sep, no guard) the actions still work — that
    is the pre-guard state, and the check that matters is that the UI does not break. Re-run
    after the guard reaches staging and confirm a non-leader reviewer sees the actions disappear
    rather than an error.

## Regression Gate

```bash
# scanvault
pnpm --filter @sector/api-client test
pnpm --filter @sector/web test
pnpm -w typecheck
pnpm -w lint

# gusi_nodejs_api (separate repo — run there, commit there)
pnpm test:functional tests/functional/scan/tags --no-file-parallelism
pnpm test:functional tests/functional/scan --no-file-parallelism
pnpm typecheck
```

## Success Criteria

- [ ] A role holding only `edit:scan`, with no ownership and no leadership of the owner's group,
      gets 403 on both `POST` and `DELETE /api/scan/:scanId/tags`, and the scan's `tags` are
      byte-identical afterwards.
- [ ] Owner, group leader of the owner's group, unscoped reviewer and `full-access` all still
      get 200 on both verbs.
- [ ] Marking a scan `incomplete` still sends exactly one learner email, still suppressed when
      the learner disabled that notification.
- [ ] Marking a scan complete then filtering the same list by Complete returns that scan.
- [ ] UI hides the action when the route answers 403/404 against the staging API.
- [ ] No horizontal scroll at 390px on touched routes (`/scans/*`, `/scans/*/:scanId`).
- [ ] Zero additions to `apps/web/src/i18n/locale-completeness-baseline.json`.
- [ ] `README.md` no longer claims scan tags are unported.

## Risk Assessment

| Risk | L×I | Mitigation |
| --- | --- | --- |
| The guard locks out real reviewers (group-scoped leaders whose membership query misses) | M×H | Reuse `assertScanReadableById`'s exact membership calls; test the leader-of-owner's-group case explicitly; ship behind no flag but verify on staging with a real leader account before production |
| The `incomplete` email stops firing because the guard throws earlier in the handler | L×H | Guard is placed after the scan lookup and before the write; an email test sits on both sides of the change |
| Staging skew — Netlify demo runs the unguarded API | M×L | `isUnavailable` is additive; the UI is identical while the route answers 200 |
| Duplicate tags from a double click | M×L | Already handled client-side (`isRowActionDisabled`, `scan-row-actions.ts:138-145`); unchanged |
| Rollback | — | Revert the two controller call sites; the helper is inert on its own. Web revert is the `isUnavailable` commit; no data migration, no schema change |

## Security Considerations

- Closes item 3 of `plans/reports/from-sector-port-to-api-team-260914-0031-*`: "any authenticated
  account can tag or untag any scan id — including flipping another user's study to complete".
- Sector's client gate (`rowActionsFor`) is **not** a control and is not treated as one here;
  the phase is defined by the server test matrix.
- The write also triggers an email to a third party (the scan owner). An unguarded route is
  therefore also an unguarded mail trigger — the guard closes that as well.
- No new PII crosses the wire: the tag payload is a single lowercase token
  (`scanTagPayloadSchema`).
- Nothing in this phase logs or stores a tag value outside the existing scan document.

## Unresolved questions

1. Should the **owner** be allowed to set their own scan's completeness? The rule above allows
   it (it is already true today and the UI never offers it). If the API team wants reviewer-only,
   say so before the guard merges — it is one branch.
2. Does the API team want `addTag` moved to `$addToSet` in a follow-up, given the deployed
   mobile client?
