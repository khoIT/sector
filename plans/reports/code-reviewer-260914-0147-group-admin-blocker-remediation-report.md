# Group administration — blocker remediation

Branch `fix/sector-group-admin`, 7 commits + a merge of `feat/sector` @ `338b420`.
Worktree: `<scratchpad>/wt/fix-group-admin`. 31 files, +1413/−275.

Follows `plans/reports/code-reviewer-260914-0147-group-export-surface-and-form-layer-adversarial-review-report.md`.
Blocker 5 (unscoped learner-roster route) left to the API team as instructed; the client's
documentation of it is untouched.

## Commits

| | |
|---|---|
| `464b14b` | `ConfirmActionDialog` + `errorMessage` helper |
| `e74323f` | role change: confirm, and stop it clearing `expiresAt`; re-invite wired |
| `c29ebfe` | course removal: confirm; export failures surfaced |
| `2be9b66` | assignments: show every type, model the null assignee, render the content |
| `7079b2e` | tab titles from the route |
| `a098829` | drop the discarded Type selector from create; correct two false doc comments |
| `816a675` | fidelity: let the mirror secret reach the replay suite |

---

## Blockers 1–4

**B1/B2 — member role change and removal.** Both now go through `ConfirmActionDialog`, which is
`DeleteScanDialog`'s shape generalised rather than a third bespoke dialog: `onOpenChange` returns
early while `isPending`, and the caller resets its mutation on close. The role change no longer
fires from `onValueChange`; `updateRole.isError` is rendered, which it never was. The removal
confirm names the member and states what actually happens — `groupMemberService.removeById` is
`deleteOne`, so the copy says permanent, cannot be undone, and that the join date and expiry go
with it.

**B3 — course removal.** Was a single unguarded click that un-enrolled every member, with
`removeCourse.isError` never read anywhere in the file. Same dialog, names the course, and says
progress is kept because the server soft-deletes the join row and re-adding restores it.

**B4 — export failures.** Two separate silences. `isApiError(e) ? e.message : undefined` rendered
nothing for anything the transport did not produce; that pattern is gone from the panel (a test
asserts `isApiError` appears nowhere in it) and replaced by `errorMessage(error, fallback)`, which
always returns a string. And a decode that threw *after* a successful request was caught by an
empty block whose comment pointed at a mutation `isError` that is false on that path — so a
malformed payload produced no file, no message, no trace. Decode failures now have their own state,
attributed to the card that produced them so one card's failure does not appear on the other three.

Also fixed while in that file: `URL.revokeObjectURL` ran in the same task as the synthetic
`click()`, which races the browser's own read of the blob URL. Chromium usually wins, Safari does
not, and the symptom is a download that never starts. Deferred. Flagged as an extra beyond the four
blockers.

## Data findings

**Role change wiped `expiresAt` on 500 live rows.** `PUT /api/group-members/:id` writes
`expiresAt: body.expiresAt ? new Date(body.expiresAt) : null` unconditionally. Mongoose 8 strips
`undefined` from a `findOneAndUpdate` but not that explicit `null`, so a `{role}`-only payload
cleared the expiry. `roleChangePayloadFor` echoes the current value; the payload schema carries the
reasoning and says the real fix is server-side.

**Assignments tab.** Filter dropped. Proven on the mirror: the group the sweep opens
(`6a6ae3d759ab84398c7cee4f`) returns `totalItems: 0` with `?assignmentType=course` and **1,367**
without it. Across the mirror, course-level is 376 of 8,734 rows and only 19 of 71 groups with
assignments have one.

Dropping the filter immediately exposed what the filter had been hiding: `user` was modelled
`string | UserBasic`, defending against a bare id the route cannot return (it always populates) while
rejecting the shape it does return — `null`, when the reference does not resolve — on 14 of 18 rows
of one group. That is a mirror artifact, not a production fact (1,070 of 1,461 assignee ids are
absent from the mirror's partial `users` collection), but one unresolvable reference must not take
the tab down. Now `userBasicSchema.nullish()`, rendered as "Unknown member".

The rows also never said *what* was assigned. `contentId` is modelled and rendered, with the parent
course and a type badge.

**Tab titles.** `useGroupDetailTitle(groupId)` replaces the `location.state` channel in all five
panels; the index and the create dialog no longer push a name they cannot guarantee. Cost: one
`GET /api/groups/:id` per group, shared across the five tabs by the query cache. That response is
62 kB for this group and almost all of it is a `members` array the client drops — an API-side trim,
noted on the schema, not worked around.

**Create form Type selector.** `POST /api/groups` parses `type` and never reads it —
`groupService.create` is called without the field, and `body.type` appears nowhere outside
`updateGroupById`. The field moved to edit, where `PUT` applies it.

## Corrections to the phase-08b report

1. *"`updateGroupByIdSchema` has no `organization` field"* — it does (`group.schema.ts:76`).
   Create-only is a defensible choice; the stated reason was false. Comment corrected.
2. *"a course to an assignment takes a pasted course ID"* — the assignment form has always used a
   real `<Select>` fed by `useGroupCourseOptions`. Only the courses panel and the exports panel
   paste an id, and only their comments say so.
3. *"course-level assignment is what a group leader creating an assignment does most"* — 4.3% of
   real rows. The schema comment now carries the measured numbers.
4. *re-invite listed as shipped* — it had an endpoint, hook, query key, schema and manifest entry
   and no UI. **Built**, rather than struck: it is offered per row for `pending` members only, which
   is one of only two statuses the data holds and the exact state the route requires.
5. (Found while verifying) *"`parent` on a plain `toObject()` is a bare id"* — the route populates
   it to `{id, name, slug, totalSeats}`. Corrected.

## Gates — real numbers, merged tree

| | before (08b) | now |
|---|---|---|
| `pnpm -w lint` | clean | clean (eslint + prettier, 4 packages) |
| `pnpm -w typecheck` | clean | clean |
| api-client tests | 171 / 11 skipped | **219 passed / 11 skipped** |
| ui tests | — | **127 passed** |
| web tests | 522 | **846 passed** |
| `pnpm -w build` | ok | ok |
| `pnpm fidelity` | 24 passed / **21 skipped** | **64 passed / 0 skipped** |
| cold-load sweep | 9/9, `needs: "."` | **10/10, asserting the real group name** |

**The fidelity number is the one to look at.** The 21 skipped were not a missing shell variable, as
08b assumed — `turbo` filters the child environment, so `SECTOR_MIRROR_JWT_SECRET=... pnpm fidelity`
reached the shell and never reached vitest. The run still exited 0 and reported a pass. Every phase
that quoted fidelity as a gate had in fact never replayed a live route. `passThroughEnv` fixes it;
`feat/sector` independently landed the same fix, which is where the merge conflicted. This run:
`grep -c "route replay skipped"` = **0**, 20 route replays executed, no parse rate below 100%.

The sweep's `needs` was `"."` on every group route — a pattern that matches any text, which is why
it passed while four of five tabs were titled "Members". Each route now asserts the group's real
name.

## Driving the destructive paths by hand

Chromium against my own Vite on **:3103** (started and stopped by me; :3100/:3101/:5001/:5002
untouched and confirmed still serving afterwards), mirror API :5002, admin session. Writes were done
against a throwaway group created for the purpose — `ZZ Review Sandbox`, seeded with a learner
carrying a real `expiresAt` of 2027-06-30 and two courses — and the group was deleted afterwards, so
no mirrored data was touched.

**Role change.** Selecting "Leader" on the learner row opened a dialog reading *"Sector Learner will
become a leader of this group, able to see every member's scans and manage the roster."* No request
had been made at that point. Escape dismissed it, still with no request. Reopening and confirming
issued exactly one call:

```
PUT /api/group-members/6aa720ad3468fbe5b5e17fbb {"role":"leader","expiresAt":"2027-06-30T00:00:00.000Z"}
```

The expiry is in the payload. Under the old code that field was absent and the server would have
written `null`. 0 console errors. Selecting the role a member already holds makes no request at all.

**Remove member.** Dialog: *"Sector Learner will be removed from this group permanently, along with
their join date and any membership expiry. This cannot be undone; they would have to be invited
again."* Nothing written on open; an outside click dismissed it with nothing written; confirming
issued one `DELETE` and the count went 2 members → 1 member. 0 console errors.

**Remove course.** Dialog named "GUSI POCUS Essentials". I held the `DELETE` open for four seconds
and pressed Escape mid-request: the footer read "Removing…" and **the dialog stayed open** — this is
the exact regression from B2, now guarded — closing only once the request settled. Then I forced a
403 on the second course: the server's message rendered inside the dialog. Cancelling and reopening
showed a clean dialog, so the `reset()` works.

**Exports.** Three states on three different cards. A real export succeeded and downloaded
`group-users-scans-2026-09-14T03-22-50-206Z.xlsx`, which also confirms the deferred revoke does not
break the download. A forced 403 rendered *"You do not have access to this group"* on its own card.
A forced 200 whose `buffer` was not valid base64 rendered *"The export downloaded but could not be
opened. Try again."* — **the case that previously produced nothing at all** — and the other cards
stayed clean. 0 unexpected console errors.

**Assignments tab**, admin, on the swept group: 1,367 rows where it previously said "No assignments
yet", each reading e.g. *"Pulmonology / Sarah Josephine Zimmer Hobbs · GUSI POCUS Essentials / Due
Sep 18, 2026 / Module / Active"*, under the notice *"Showing every assignment on this group. New
assignments made here are course-level."* 0 console errors.

**Create dialog**: Name, Slug, Organization, Description, Total seats, Expiration date, free-trial
checkbox. No Type field.

## Tests added

- `member-actions-model.test.ts` (15) — the `expiresAt` echo, including that it is an explicit
  `null` and not `undefined`, which would be dropped by `JSON.stringify` and reproduce the bug.
- `error-message.test.ts` (8) — decode failures, `TypeError`, and non-`Error` throws all produce a
  string.
- `group-assignment.test.ts` (14, api-client) — a real populated row, `user: null`, `user` absent,
  all four types, all five statuses, and a rejected unknown status.
- `destructive-actions.test.ts` (13) — source-level guards. The web package runs vitest in node with
  no DOM, so a dialog's Escape handling cannot be exercised there; its *absence* can be, and that is
  what shipped. Each assertion names its regression.
- `group-detail-title.test.ts` (9) — no group surface reads a name from navigation state or falls
  back to the members heading.

## i18n

29 keys added or rewritten across all 7 locales: 0 missing, 0 empty. The 1–2 per locale that match
English are cognates (Quiz, Module). One orphan removed
(`groups.members.actions.changeRole`, superseded by `changeRoleFor`). The completeness gate passes
without a baseline entry.

## Unresolved

1. Blocker 5 and the `PUT`/`DELETE /api/group-members/:id` scoping gap are with the API team. Until
   they land, `expiresAt` preservation is a client-side mitigation of a server-side bug — a second
   client, or a direct call, still clears it.
2. `GET /api/groups/:id` embedding a 201-entry `members` array is now on the page-heading path.
   Worth an API ticket; harmless today because it is cached once per group.
3. The exports tab still asks for a pasted course id while the assignments form has a working
   picker over the same data (`useGroupCourseOptions`). Not in this scope; small and worth doing.
4. `scan reviewer` holds `edit:group`, `edit:group-member` and `delete:group-member`, so reviewers
   get the settings tab and full member management. Still a product question, not an engineering one.
5. The `administrator` role does **not** bypass `assertLeadsGroup` — I hit a 403 adding a course to a
   group it did not lead, because only Superadmin holds `admin:full-access`. The Courses tab is
   therefore visible but non-functional for an administrator on a group they do not lead. Found
   while setting up the sandbox; not fixed here.
