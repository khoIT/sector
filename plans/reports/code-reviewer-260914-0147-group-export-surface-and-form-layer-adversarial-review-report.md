# Adversarial review — group export surface and form layer (phase 08b)

Reviewed: `27138c3..5e3b10f` (4 commits) + merge `3cc428b` on `feat/sector`. 46 files, +4057/−150.
Implementer report: `plans/reports/group-export-surface-and-form-layer-260914-0110-phase-08b-report.md`.

Sources used, per finding, marked: **[src]** repo source, **[api]** `gusi_nodejs_api` source,
**[mirror]** live query against local `gusi_prod_mirror`, **[run]** command executed here.

Gates re-run: `pnpm -w test` → 62 files / 765 tests green on `feat/sector` **[run]**. i18n analysed by
script **[run]**. Mirror queried via the `mongodb` driver, localhost only **[mirror]**.

---

## Blockers

### B1. Role change fires on a single select, with no confirmation and no visible failure
`apps/web/src/features/groups/members/member-actions-cell.tsx:50-53, 66-83` **[src]**

`changeRole` calls `updateRole.mutate(...)` straight out of `onValueChange`. No confirm step.
Promoting a learner to `leader` is a privilege grant — a leader gets `group:leader-access`,
`edit:group-member`, `delete:group-member` **[mirror, `roles`]** — and it happens on one mis-click in a
719-row table (largest real group **[mirror]**).

Worse: `updateRole.isError` is **never rendered**. Only `removeMember.isError` is (line 104). On a 403
or 500 the mutation settles, the component re-renders, the `Select` snaps back to `member.role`, and
nothing says why. That is the silent-failure shape the brief called out.

Fix: confirm before a role change (at minimum for the promote-to-leader direction), and render
`updateRole.error` next to the cell the way `removeMember.error` is rendered.

### B2. The remove-member confirmation is a bespoke dialog, not the repo's confirm pattern
`member-actions-cell.tsx:86, 96-133` vs `apps/web/src/features/scan-list/rows/delete-scan-dialog.tsx:43-49` **[src]**

`<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>` — raw setter. `Dialog` is
`DialogPrimitive.Root` and `DialogContent` renders the default X button, so Esc, overlay click and the X
all fire `onOpenChange(false)` **[src, `packages/ui/src/components/dialog.tsx:15,56`]**. The existing
`DeleteScanDialog` guards exactly this:

```tsx
onOpenChange={(next) => {
  if (deleteScan.isPending) return;   // <- missing here
  if (!next) deleteScan.reset();      // <- missing here
  onOpenChange(next);
}}
```

Consequences in the member dialog:
- Esc during an in-flight DELETE unmounts `DialogContent`; the request still lands; the error block
  lives *inside* `DialogContent`, so a failure becomes invisible.
- No `reset()` on close, so a previous failure's red text is still there next time the dialog opens.

The removal is also **not** what the copy implies. `groupMemberService.removeById` is
`deleteOne` — a hard delete, not the soft delete used elsewhere **[api,
`src/database/group-member/group-member.service.ts:1109-1112`]**. `joinedAt`, `expiresAt` and
`metadata` (144 rows carry metadata **[mirror]**) are gone. Copy says only
`"They will lose access to this group's courses and scans."` **[src, `en.json`]** — reads reversible.
`DeleteScanDialog`'s own doc comment sets the standard here ("the wording avoids promising
recoverability").

The dialog also **does not name the member**. `DeleteScanDialog` interpolates `{ title: scanTitle }`;
this one is a fixed string, so every row's confirm looks identical.

309 groups have exactly one leader **[mirror]**. Removing that member orphans the group —
`assertLeadsGroup` then fails for everyone but `admin:full-access`. No guard, no warning.

### B3. Removing a course from a group has no confirmation and no error path at all
`apps/web/src/features/groups/forms/group-courses-panel.tsx:110-118` **[src]**

`onClick={() => removeCourse.mutate(course.id)}` — one click, whole group unenrolled from a course.
`removeCourse.isError` is never read anywhere in the file. A 403/404 renders nothing; the row simply
stays. Compare B2, where removal of a *member* did get a dialog: the surface is internally inconsistent
about which destructive action deserves a confirm.

(The server side is recoverable — `groupCourseService.removeById` soft-deletes and
`addCourseToGroup` restores the row **[api, `manager.controller.ts:195`]** — but the client shows
neither the risk nor the failure.)

### B4. Export failures are silently swallowed on two distinct paths
`apps/web/src/features/groups/exports/group-exports-panel.tsx:51-60, 89-113, 206` **[src]**

1. `ExportCard` receives `error={isApiError(x.error) ? x.error.message : undefined}`. A non-`ApiError`
   failure (`kind:'network'` is an ApiError, but anything thrown outside the transport is not) renders
   **nothing** — the button un-busies and the page is unchanged. The two cards below it
   (`courseData`, `report`) do have a `t('groups.exports.error')` fallback; the three `ExportCard`s do not.
2. `runExport` wraps both `mutate()` and `downloadExportFile(result)` in one `try`, with the comment
   *"Surfaced via each mutation's own isError below."* If `exportFileToBlob`'s `atob` throws on a
   malformed `buffer`, the **mutation already succeeded**, so `isError` is false and the catch is empty.
   Result: no file, no error, no log.

Fix: give `ExportCard` a non-ApiError fallback message, and separate transport failure from decode
failure so the second gets its own surfaced state.

### B5. Trust boundary: the group-assignment routes this branch now calls are unscoped, and the lowest role can reach them
`gusi_nodejs_api/src/app/group-assignment/group-assignment.controller.ts` **[api]** —
`grep -n "assertLeadsGroup" → no matches` in the whole file **[run]**.

`GET /api/group-assignment/learners?groupId=<any>` returns `{userId, userName, email, firstName,
middleName, lastName}` for every active learner of **any** group id. Its only gate is
`withPermission([READ_GROUP_ASSIGNMENT])` **[api, `group-assignment.route.ts:34`]**. The seeded
`subscriber` role — the lowest role in the system — holds `read:group-assignment`
**[mirror, `roles`]**. `getGroupCourses` and `createGroupAssignment` are likewise unmembership-checked;
only `getAssignmentsByGroupId` checks active membership (`:305-318`).

The client **does** document this (`packages/api-client/src/endpoints/group-assignment.ts:14-23`)
— correctly and in the right place. It is **absent from the report handed to the lead**, which raised
only the group-members gap. That omission is the problem: the API fix does not get a ticket.

Related, and now verifiable (the report left it open): `PUT` / `DELETE /api/group-members/:id` have no
`assertLeadsGroup` **[api, `group-member.controller.ts:144-197`]**, and the seeded `group leader` role
**does** hold `edit:group-member` and `delete:group-member` **[mirror, `roles`]**. So a group leader
can re-role or hard-delete a member of a group they do not lead, by id. Sector's own UI does not hand
them that (the leader path uses the scoped `/api/groups/manage/member/:groupId` list
**[src, `endpoints/group-member.ts:43-58`]**), but the API is directly callable and
`GET /api/group-members?groupId=` is itself unscoped. API-side ticket, high priority.

---

## High

### H1. Four of the five tabs title themselves "Members" — every time, not as an edge case
`group-detail-tabs.tsx:81-84`; all five panels **[src]**

Tab switching does `navigate(target.path)` with no `state`. Every panel reads
`(location.state as GroupDetailLocationState)?.groupName` and falls back to
`t('groups.members.title')`, which is the literal string `"Members"` **[run, en.json]**. So: open a
group from the index → heading is the group name; click Courses → heading and `<section aria-label>`
both become **"Members"**, on the courses list. Same for Assignments, Exports, Settings.

This is also why the 9/9 cold-load sweep did not catch it: the sweep navigates by direct URL, which
also carries no state, so every swept route rendered "Members" and still passed "real text rendered,
zero console errors".

Fix: pass `{ state: { groupName } }` on tab navigation, or drop the state channel and read the name
from `useGroupById` once in a shared layout (see M1).

### H2. The Assignments tab hides 96% of real assignments and calls it "No assignments yet"
`endpoints/group-assignment.ts` pins `assignmentType: 'course'` **[src]**. Mirror **[mirror,
`groupassignments`]**:

| assignmentType | rows |
|---|---|
| module | 4,265 |
| topic | 4,092 |
| course | **376** |
| quiz | 1 |

Groups with any assignment: 71. Groups with a *course-type* assignment: **19**. So on **52 of 71**
groups that actually use assignments, this tab renders
`"No assignments yet" / "Assign a course to specific members with a due date."` while the group has
hundreds of live assignments.

The scope cut is documented in `schemas/group-assignment.ts`, which is the right place for an engineer
— but the screen tells the user something false. The report's justification, *"course-level assignment
is what a group leader creating an assignment does most"*, is contradicted by the data: course is 4.3%.

Fix: say so on screen (empty state + list header: "course-level assignments only"), and re-rank the
module/topic picker on the strength of these numbers.

### H3. A role change silently wipes the member's `expiresAt`
`gusi_nodejs_api/src/app/group-member/group-member.controller.ts:157-162` **[api]**:

```ts
const updatedGroupMember = await groupMemberService.updateById(groupMember.id, {
  role: body.role,
  expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,   // unconditional null
  status: body.status,
  metadata: body.metadata,
})
```

`updateById` is `findOneAndUpdate(..., data, {new:true})` on mongoose ^8.9.5 **[api]**, which strips
`undefined` keys — so `status`/`metadata` survive, but the explicit `null` is written. The client's
role-change payload is `{ role }` only (`updateGroupMemberRolePayloadSchema`) **[src]**.

**500 `groupmembers` rows hold a real `expiresAt` Date** **[mirror]**. Changing any of their roles from
this new UI converts a time-limited membership into a permanent one, with no indication.

Fix (client-side mitigation): send the member's current `expiresAt` back with the role change — the
members list already carries it (`groupMemberSchema.expiresAt`). Proper fix is API-side.

### H4. The create form's "Type" selector does nothing
`group-form-dialog.tsx:208-223` offers group/class. `gusi_nodejs_api` `createGroup` never reads
`body.type` — `grep -n "body.type" src/app/group/group.controller.ts` → **one hit, line 199, inside
`updateGroupById` only** **[run, api]**. `groupService.create({...})` at `:50-62` omits it.

So every group created from Sector is typeless. 391 of 1,520 existing groups are already typeless
**[mirror, `{type:{$exists:false}}` = 391, `{type:{$type:'null'}}` = 0]**, and the index renders type
via `t(\`groups.index.type.${group.type}\`)` **[run]** — i.e. `groups.index.type.undefined`. This form
adds to that population.

Fix: either drop the field from create mode, or immediately PUT the type after create, or file the API
bug. Do not ship a control that silently discards input.

### H5. A learners-list parse failure renders as "This group has no active learners yet."
`group-assignments-panel.tsx:233-236` **[src]** branches on `learners.isPending` then
`(learners.data ?? []).length === 0`. `learners.isError` is never checked. Any `ApiError{kind:'parse'}`
or 403 from `GET /group-assignment/learners` shows the same empty state as a genuinely empty group —
and the assignment form then cannot be completed, with no explanation.

Same pattern, milder, in `courseOptions` (line 207): a failed course-options fetch yields an empty
`Select` with no message.

### H6. `URL.revokeObjectURL` runs in the same task as the anchor click
`apps/web/src/features/groups/exports/download-export-file.ts:19-21, 32-34` **[src]**

```ts
anchor.click();
anchor.remove();
URL.revokeObjectURL(url);   // same tick
```

Chromium usually survives this; Safari and some Firefox builds abort the download because the blob URL
is revoked before the download commits. Both helpers do it. Defer the revoke (`setTimeout(..., 0)` or
longer) — the allocation is still cleaned up, just not before the browser has read it.

The compress/decode path itself is a synchronous `atob` + per-byte loop over the whole workbook
(`packages/api-client/src/export-download.ts:14-17`) on top of `await response.text()` +
`JSON.parse` in the transport (`client.ts:158-166`) — four full copies of the payload, main thread
blocked. Largest real group is 719 members with 0 courses and 0 scans **[mirror]**, so today's payloads
are small and this is not yet a live problem; it is the reason not to grow the export surface without
a streaming path.

### H7. Member writes do not invalidate the group index
`react/use-group-member-write.ts:20-23` invalidates only `groupKeys.membersRoot(groupId)` **[src]**.
The groups index renders `leaderCount` / `learnerCount` / seat usage per row
(`groupSchema` count virtuals) **[src, api]**. Invite or remove a member, click back — stale counts.
Add `groupKeys.listRoot()` to the invalidation.

### H8. No pagination on the courses and assignments tabs
`getGroupCourses` defaults `limit: 50`; `getAssignmentsForGroup` defaults `limit: 20` **[src]**. Both
responses carry `totalPages`/`totalItems`; both panels ignore them and render `items` as a bare `<ul>`.
The index and members surfaces both use `DataTablePagination`. A group past the limit silently shows a
truncated list with no "showing 20 of N".

---

## Medium

- **M1. Five panels duplicate the same preamble instead of sharing a layout.** `MembersSurface`,
  `GroupCoursesPanel`, `GroupAssignmentsPanel`, `GroupExportsPanel`, `GroupSettingsPage` each repeat
  `useParams` → `useLocation` → `groupName` → `title` → `if (!groupId) return null` →
  `<section aria-label={title}><GroupDetailTabs .../>`. The tabs are already route-driven, so this is
  precisely a react-router pathless layout route with `<Outlet/>`. It is the one shape the phase brief
  said to avoid, and it is also what makes H1 a five-place fix rather than a one-place fix.
- **M2. The exports course-id field could be the picker that already exists.** `GroupExportsPanel`
  asks for a pasted course id (`courseIdInput`, line 121-126) for *this group's* course data — while
  `GroupAssignmentsPanel` gets a real `<Select>` from `useGroupCourseOptions(groupId)`
  (`GET /group-assignment/group-courses`), which returns exactly this group's courses. Same data, same
  bundle, one surface uses it and the other does not. The genuine catalog gap is only
  `GroupCoursesPanel`'s *add* course (needs courses the group does **not** have).
- **M3. Re-invite is dead code.** `reInviteGroupMember` endpoint + `useReInviteGroupMemberMutation` +
  `reInviteGroupMemberPayloadSchema` + `mutationKeys.reInviteGroupMember` + a manifest entry all ship;
  `grep -rn "eInvite" apps/web/src` → **no matches** **[run]**. The report lists re-invite under "what
  shipped". It also matters: `groupmembers.status` in the mirror is only `active` / `pending`
  **[mirror]**, and pending is exactly the state re-invite exists for.
- **M4. Four claims in the implementer report do not hold.**
  1. *"`updateGroupByIdSchema` (gusi_nodejs_api) has no `organization` field"* (`schemas/group-write.ts:14-16`)
     — it does: `group.schema.ts:76`, `organization: z.string().optional()` **[api]**. The client's
     create-only choice is still defensible; the stated reason is wrong.
  2. *"Adding a course to a group, **or a course to an assignment**, takes a pasted course ID"* — the
     assignment form uses a `<Select>`. Only the courses panel and the exports panel paste.
  3. *"course-level assignment is what a group leader creating an assignment does most"* — 4.3% of real
     rows (H2).
  4. Re-invite listed as delivered (M3).
- **M5. `columns.test.ts` no longer proves what `columns.ts` says it proves.** The doc comment
  (updated in this branch) says both role sets are identical and *"`columns.test.ts` asserts that
  directly"*. True of `memberColumnsFor`, but the real column set is now assembled in
  `members-surface.tsx:100-116`, which appends `actions` outside the tested function. The test passes
  regardless of what the surface renders.
- **M6. The settings tab is gated on `edit:group`, which the `group leader` role does not hold.**
  `group-detail-tabs.tsx:57`. Seeded permissions **[mirror, `roles`]**: `edit:group` is held by
  `administrator`, `scan reviewer`, `Superadmin` — not `group leader`. This answers the report's first
  unresolved question. Consequence: the per-group scan-notification card that the phase wired into that
  tab is unreachable by the only people it is for — `GET /api/group-notifications` answers the
  *caller's own led groups*, and the page itself says so (`groups.settings.notLeaderNotice`). The
  account-wide card still works, so nothing is lost, but the new tab is dead for leaders. Either gate
  the tab on `edit:group` **or** leadership, or move the notification card out from behind the
  edit gate.
  Secondary: `scan reviewer` **does** hold `edit:group` + `edit:group-member` + `delete:group-member`
  **[mirror]**, so a reviewer gets the full member-management and group-edit surface. `columns.ts`'s new
  comment frames the split as "leader vs administrator"; reviewers are a third case nobody decided on.
- **M7. The CSV report this branch now exposes is unescaped.** `getGroupReport`'s csv branch is
  `reportEntries.map(e => Object.values(e).join(','))` **[api, `manager.controller.ts:757`]** — no
  quoting, while the same repo ships `generateCsvBuffer` with correct quoting
  (`utils/xlsx.util.ts:128-136`) and does not use it here. A member's name containing a comma shifts
  every later column; a name starting with `=` is an Excel formula-injection vector. The rows are real
  user PII (first/last name, username, email). API ticket; the new "Download CSV" button is what makes
  it reachable from Sector.
- **M8. The report route is a long sequential loop with no client timeout or abort.** `getGroupReport`
  walks group-tree → courses → members and awaits `getUserProgressByCourseId` once per (member, course)
  **[api, `:700-742`]**. Measured on the real tree **[mirror]**: `AMPATH POCUS Parent` = 52 groups,
  **2,901** sequential progress queries; `UMN ..._parent` = 1,939; `Northwell Health` = 1,180. Tens of
  seconds. No hook passes an `AbortSignal` (`use-group-export.ts`), so the button sits on "Downloading…"
  with no cancel and no timeout. Not fatal at today's scale; worth a note before anyone points this at
  a bigger tree.

---

## Nits

- `actions.downloading` and `actions.downloadFailed` are **baselined as untranslated** in all six
  non-English locales (`locale-completeness-baseline.json`) **[run]**, and the new export buttons use
  `t('actions.downloading')`. English text in 6 of 7 locales on a brand-new surface. Pre-existing
  baseline, new dependency on it.
- Exports "Course completion detail" `<Input>` has no `<label>` and no `id` — placeholder-only
  labelling. Every other new field in this branch uses `AccountField`.
- `groupAssignmentSchema.user` is `z.union([z.string(), userBasicSchema])`. The route always passes
  `{populate:true}`, whose default paths always populate `user`
  **[api, `group-assignment.service.ts:42-60`]** — so the `z.string()` branch is unreachable, and the
  realistic failure (a dangling ref → mongoose sets the path to `null`) is *not* covered: `null` fails
  the union and takes the whole tab down. The panel also renders the string branch as the member's
  display name, i.e. a raw ObjectId. Prefer `userBasicSchema.nullish()`.
- `groups.form.totalSeatsHint` = *"Leave blank for unlimited seats."* Correct for a top-level group
  (`totalSeats: 0` ⇒ unlimited **[api, `group-member.service.ts:68-93`]**) but **false for a child
  group**, where 0 means "inherit the parent's cap" (`:84-86`). Edit mode can open on a child group.
- `removeMember.error` is not `reset()` on dialog close, so a past failure reappears on reopen (B2).
- `features/account/notification-preferences.tsx` now imports from `features/groups/settings/...` —
  dependency direction inverted vs every other cross-feature import. The extraction itself is correct
  (see below); only the resting place is arguable.
- `expirationDate` round-trips as `ISO.slice(0,10)` → `new Date('YYYY-MM-DD')` (UTC midnight). Stable
  today because both ends are UTC; brittle if either side ever becomes local-time.
- `MemberActionsCell`'s trigger `<Button>` sits inside `<Dialog>` but is not a `DialogTrigger`, so
  Radix does not restore focus to it on close.

---

## Checked and clean — stated so the risk ranking is honest

- **i18n is genuinely complete.** 98 new keys × 7 locales: 0 missing, 0 empty in de/es/fil/fr/it/pt
  **[run]**. Not baselined around the gate — `locale-completeness-baseline.json` contains zero
  `groups.*` entries, and the gate (`3e288cc`) landed *after* the 08b merge, so it ran against these
  keys. The 10 keys with no literal `t('...')` call site are all reached via `labelKey` variables
  (`groups.tabs.*`) or the dynamic `t(\`groups.assignments.status.${...}\`)`, and all five status keys
  exist **[run]**. Identical-to-English values are 1–5 per locale and are cognates
  (Slug, Email, Name, Exports, Draft) — not untranslated copies **[run]**.
- **The export-scoping answer holds.** All five routes call `assertLeadsGroup` in the controller body
  before touching data **[api, `manager.controller.ts:241,416,680,802,1349`]**, and
  `GROUP_LEADER_SCOPED_VISIBILITY` is a hardcoded `true` **[api]**. The report's characterisation —
  safe today, contingent on that boolean, no compensating route-level gate — is accurate.
- **`groups.type` is *missing*, never `null`** — 391 `$exists:false`, 0 `$type:'null'` **[mirror]**. So
  `z.enum(GROUP_TYPES).optional()` (not `.nullish()`) is correct here. This was the obvious candidate
  for a repeat of the course-seam bug and it is not one.
- `groupWriteResultSchema` survives real documents: `name`/`slug`/`description` never missing;
  `totalSeats` / `isFreeTrial` / `expirationDate` all carry mongoose defaults, and `toObject` runs with
  `virtuals: true` via `transformIdPlugin`, so `id` is present **[api, mirror]**.
- `groupCourseSchema` matches `populate({path:'course', select:'id title slug'})`; `title` and `slug`
  are `required: true` on `V2Course`, `status` is unselected and correctly `.optional()` **[api]**.
- `page: String(query.page ?? 0)` is right — `getAssignmentsByGroupId` is 0-indexed
  (`skip = page * limit`), unlike every other list route **[api, `:378`]**. Easy to get wrong; wasn't.
- The `type`/`format` claim checks out: the four xlsx routes never read `body.type`, only
  `getGroupReport` honours it **[api]**. Pinning `'xlsx'` client-side rather than offering a fake CSV
  option is the right call.
- `sendResponse` JSON-stringifies even the `Content-Type: text/csv` branch
  **[api, `utils/response-handler.ts:28`]**, and `client.ts` reads `response.text()` then `JSON.parse`
  regardless of content type **[src, `:158`]** — so `schema: z.string()` on the CSV route works. Claim
  verified, not assumed.
- `USER_ALREADY_EXISTS` detection works end to end: `HttpError(400, msg, {code})` →
  `error.middleware.ts:27-28` `response.details = error.details.error || error.details` →
  `envelopeDetails` → `invite.error.details.code` **[api, src]**.
- The `cold-load-sweep.mjs` fix is real: at `27138c3` the file had both a top-level
  `import { readFileSync }` and `const { readFileSync } = await import('node:fs')` — a hard
  `SyntaxError` on any run **[run, `git show 27138c3:...`]**.
- The `GroupNotificationRow` extraction is a true move-and-share (both call sites import the one
  component), not a copy. No second settings surface was built.
- `group-form-model.test.ts` is real behaviour coverage — slugify edge cases, per-field validation
  failures, blank-`totalSeats` → `undefined` rather than `NaN`, create-only `organization`. Not phantom.
- No conditional-hook ordering bugs: all five panels put `if (!groupId) return null` after every hook.
- `GroupFormDialog` really is one component with a `mode`; create/edit are not forked.

---

## Recommended order

1. B1, B2, B3 — confirm and surface the three destructive actions; adopt `DeleteScanDialog`'s
   `onOpenChange` guard + `reset()`, name the member, say "cannot be undone".
2. B4 — non-ApiError fallback on `ExportCard`, and separate decode failure from transport failure.
3. H3 — send `expiresAt` back with the role change (500 live rows at risk).
4. H1 — carry `groupName` through tab navigation, or read it once in a layout.
5. H2 — tell the user the Assignments tab is course-level only.
6. H4 — stop offering a Type selector that create discards.
7. B5 + M7 — two API tickets: `assertLeadsGroup` on the group-assignment family and on
   `PUT`/`DELETE /api/group-members/:id`; CSV quoting via the existing `generateCsvBuffer`.
8. M1 — collapse the five duplicated preambles into a layout route (also fixes H1 in one place).
9. H5–H8, M2–M6, then nits.

Nothing here requires reverting the merge. B1–B4 are contained to four files.

---

## Unresolved questions

1. Is `scan reviewer` *meant* to hold `edit:group`, `edit:group-member` and `delete:group-member`?
   It does **[mirror]**, so reviewers currently get the settings tab and full member management.
   Product decision, not an engineering one.
2. B5: does the API repo take the two scoping tickets, or does Sector defend by never calling
   `/group-assignment/learners` for a group the caller does not lead? The client cannot close a hole
   that is directly callable, but it can stop widening the blast radius.
3. H3: fix client-side (echo `expiresAt`) as a stopgap, or hold for the API fix? The stopgap is three
   lines and the data loss is live on 500 rows today.
4. H2: is a module/topic assignment picker now in scope for a near-term phase, given 96% of real
   assignments are module/topic? If not, the empty-state copy needs to change this week.
5. M6: should the per-group notification card move out from behind `edit:group` so leaders can reach
   it, or is the account-wide card considered sufficient and the tab's card redundant?
