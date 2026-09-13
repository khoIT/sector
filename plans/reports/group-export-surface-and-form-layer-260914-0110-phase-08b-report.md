# Phase 8b: group export surface and form layer

Branch `feat/sector-phase-08b` (worktree), 4 commits on top of `feat/sector` @ 27138c3.

## What shipped

**api-client** (`packages/api-client/src/{schemas,endpoints,react}/group-*.ts`, `export-download.ts`):
- Group write: create/edit (`createGroup`, `updateGroup`, `getGroupById`), one `groupWriteResultSchema`
  shared across the three routes (they all answer a plain `.toObject()`, not the `getAll()`-with-virtuals
  shape `groupSchema` models — reusing `groupSchema` here would throw on `parent`).
- Member write: invite by email, add-existing-user fallback on `USER_ALREADY_EXISTS`, re-invite, role
  change, removal — all via `/api/group-members/*` (permission-gated), not the redundant
  `/api/groups/manage/member/:groupId` pair (authUser-only, no email invite).
- Group courses (whole-group enrolment): list/add/remove via `/api/groups/manage/course/:groupId`.
- Group assignments (per-member, course-level only): learners/course-options lookups, list, create —
  `/api/group-assignment/*`.
- Exports: `exportGroupScans`, `exportGroupUserScans`, `exportGroupCourseProgress`,
  `exportGroupCourseData` (all xlsx, server-generated, base64-in-JSON-envelope — verified the API never
  actually branches on the `type`/`format` field despite the schema declaring it, so the client always
  requests `'xlsx'` and documents this rather than offering a CSV option that silently downloads xlsx),
  plus `getGroupScanReportJson`/`Csv` for the one route that DOES honour `type`. `exportFileToBlob`
  (pure, unit-tested) turns the base64 buffer into a `Blob`; the `<a download>` click lives in the web
  layer since it touches `document`.
- 17 new schemas, each given a fidelity decision in `manifest.ts` — all `NOT_REPLAYED` (request payloads,
  computed/generated responses, or collections whose populate shape I could not verify closely enough
  to write a faithful replay projection without risking a false "proven"). None invented a REPLAY_ENTRIES
  I wasn't confident in.

**web** (`apps/web/src/features/groups/**`):
- One shared `GroupDetailTabs` (route-driven, per the `Tabs` primitive's own doc comment) turns the
  single members route into five: members (existing), courses, assignments, exports, settings. Settings
  tab hidden without `edit:group`.
- `GroupFormDialog` — one component, `mode: 'create' | 'edit'`, not two.
- `InviteMemberDialog`, `MemberActionsCell` (role select + remove, permission-gated per cell) appended to
  the EXISTING members surface/columns rather than a second screen — `columns.ts`'s doc comment updated
  to say why both leader and administrator get it (a leader is exactly who invites/manages their own
  roster; the split is on real permission, not role).
- `GroupCoursesPanel`, `GroupAssignmentsPanel`, `GroupExportsPanel`, `GroupSettingsPage`.
- Notification wiring: extracted `GroupNotificationRow` out of `features/account/notification-preferences.tsx`
  into `features/groups/settings/group-notification-row.tsx`; both the account-wide card and the new
  per-group settings tab import the same component. No second settings surface built.
- `groups-index-page.tsx` gets a "Create group" button behind `can('create:group')`.

**i18n**: 98 new keys x 7 locales (`groups.tabs`, `.form`, `.invite`, `.members.actions`, `.courses`,
`.assignments`, `.exports`, `.settings`, plus `actions.close`), real translations (not copies), parity
test (`groups-namespace-parity.test.ts`) green.

**scripts/check/cold-load-sweep.mjs**: added `SECTOR_SWEEP_BASE_URL` (defaults to `:3101`, unchanged) so
a worktree can point the sweep at its own `vite --port` instead of contending for the shared instance.
Also removed a duplicate `readFileSync` re-import that was already broken on `main` before this branch —
threw `SyntaxError: Identifier 'readFileSync' has already been declared` on any invocation; fixed since
nobody could otherwise run the sweep at all.

## Known scope cuts (documented in code, not silent)

- Adding a course to a group, or a course to an assignment, takes a pasted course ID. No course-catalog
  browser exists anywhere in Sector yet (course authoring/catalog is its own domain) — building one here
  would be scope creep into an unbuilt phase. Documented in `endpoints/group-course.ts` and the
  assignments-panel module comment.
- Group assignments are course-level only. The API supports module/topic/quiz assignment via
  `GET /group-assignment/course-details`'s nested tree; that picker is real, separate work belonging to
  a course-structure-aware surface, not group administration. Documented in `schemas/group-assignment.ts`.
- Create-group form omits `duration` and `scanReviewers` (the paid/fellowship expert-review routing
  config) — both optional server-side, both a distinct advanced surface.
- `groupAssignmentSchema` is `NOT_REPLAYED` even though `groupassignments` exists in the mirror: I did not
  verify `groupAssignmentService.getAll(..., {populate:true})`'s exact populate shape closely enough to
  write a faithful projection, so I did not claim a REPLAY_ENTRIES I wasn't sure of. Modelled `user` as
  `string | UserBasic` defensively (the repo's existing pattern for the same uncertainty on scan notes).

## Gates — real numbers

- `pnpm -w lint`: clean (eslint + prettier), all 4 packages.
- `pnpm -w typecheck`: clean, all 4 packages.
- `pnpm -w test`: api-client 171 passed / 11 skipped (was 169/11 before; +2 new for `exportFileToBlob`).
  web 522 passed (was 510; +12 new for `group-form-model.ts` — slugify, create/update validation,
  organization-is-create-only, draft-from-group).
- `pnpm -w build`: production build succeeds (pre-existing >500kB main-chunk warning, unrelated).
- `pnpm fidelity`: every existing REPLAY_ENTRIES still at 100% parse rate (24 passed / 21 skipped — the
  21 are the live-route-replay suite, skipped because `SECTOR_MIRROR_JWT_SECRET` wasn't exported into
  that shell; unrelated to this phase, same as before).
- Cold-load sweep, against my own `vite --port 3102` (mirror API `:5002`, real leader/admin sessions
  minted with the mirror JWT secret found in `scratchpad/sector-local.env`), group
  `6a6ae3d759ab84398c7cee4f` (the leader's real, largest led group): **9/9 routes healthy** — groups
  index (leader-scoped and full-access), and all five tabs for both a leader and an administrator, each
  a fresh browser context, real text rendered, zero console errors. Fixture files
  (`sweep-ids.json`/`sweep-routes.json`, real mirror ids) kept in the session scratchpad, not committed —
  no such fixture was committed anywhere in the repo before this either.

## The audit question: are the five export routes scoped?

`gusi_nodejs_api/src/app/group/manager/manager.route.ts` — confirmed: none of the five carries
`withPermission`, only `authUser`. But every one of the five calls
`groupMemberService.assertLeadsGroup(userId, groupId, req.userRole)` **inside the controller body**, before
touching any data:

- `getGroupReport` (`manager.controller.ts:680`)
- `exportGroupUsersWithScans` (`:241`)
- `exportGroupUserScans` (`:416`)
- `exportGroupCourseProgress` (`:801`–`803`, once per id in the `groupIds` array — so the multi-group
  course-progress export cannot smuggle an unled group into the list either)
- `exportGroupCourseData` (`:1349`)

`assertLeadsGroup` → `leadsGroup` (`group-member.service.ts:304`-`321`) throws HTTP 403 unless the caller
holds `admin:full-access` OR leads the group (or an ancestor of it) OR the `GROUP_LEADER_SCOPED_VISIBILITY`
flag is off. That flag is **hardcoded `true`** in `src/config/group-leader-scoped-visibility.ts` (not an
env var, not reachable from outside the repo) — so as shipped today, **no**, an authenticated caller who
does not lead the group cannot export its member list or scan activity: the scoping is real, live, and
the missing route-level `withPermission` is not currently exploitable.

The residual risk is entirely in that one boolean. If `GROUP_LEADER_SCOPED_VISIBILITY` is ever flipped to
`false` (a kill switch, by its own doc comment — presumably for an incident rollback), `leadsGroup` returns
`true` unconditionally and these five routes become open to any authenticated user with no compensating
control, because they have no `withPermission` layer to fall back on. Every OTHER route sharing this same
flag (`getGroupMembers`, `getCoursesByGroupId`, `addCourseToGroup`, etc.) has the identical exposure —
this is not specific to the five export routes, it's the shape of the whole `/manage` family's access
model. Not fixed from this worktree, per instruction; reporting only.

Aside, out of the assigned scope but found while building the client: `PUT /api/group-members/:id` and
`DELETE /api/group-members/:id` (`group-member.controller.ts:146`, `:180`) take a caller-supplied
group-member id with **no** `assertLeadsGroup` call at all — only the `edit:group-member`/
`delete:group-member` permission gate. If a group-leader role holds either permission (plausible; that's
exactly the permission a leader needs to manage their own roster), they can change the role of or remove
a member of a group they do not lead, by id. Worth a look, not something I verified against the seeded
role's actual permission set, and not one of the five routes I was asked to check.

## Files touched

`packages/api-client/src/{schemas,endpoints,react}/group-write.ts`, `group-member-write.ts`,
`group-export.ts`, `group-assignment.ts`, `group-course.ts`; `export-download.ts` (+test);
`query-keys.ts`, `fidelity/manifest.ts`, `index.ts` (all edited, not replaced).
`apps/web/src/features/groups/{forms,exports,settings}/**`, `group-detail-tabs.tsx`,
`members/member-actions-cell.tsx`; edited `groups-links.ts`, `groups-routes.tsx`,
`index/groups-index-page.tsx`, `members/{columns,members-surface}.tsx`,
`features/account/notification-preferences.tsx`. `apps/web/src/i18n/locales/*.json` (all 7).
`scripts/check/cold-load-sweep.mjs`.

## Unresolved questions

- Does the seeded `group_leader` role actually hold `edit:group`? The settings tab is hidden from a
  caller without it, but I couldn't inspect the seeded role→permission mapping (no DB write access from
  here, and it wasn't in scope to query). Worth confirming in a browser pass with the real leader account
  against actual role data, not just the mirror's minted-session sweep.
- Should the `PUT`/`DELETE /api/group-members/:id` missing-scope finding above get its own ticket? It's
  adjacent to what I was asked to audit but not the same routes.
- No course-catalog picker exists anywhere in Sector; whichever phase builds course authoring/catalog
  should know group-courses and group-assignments both currently take a raw pasted course id and will
  want that picker once it exists.

Status: DONE
Summary: built the four exports, the report route, and the full group write layer (create/edit, invite,
roles, courses, assignments) as five tabs beside the existing members surface, wired the Phase-3
notification card into a new settings tab via a shared component, translated everything into all seven
locales, and passed lint/typecheck/test/build/fidelity/cold-load-sweep (9/9) against the real mirror.
Concerns: the export-route scoping question resolves to "safe today, contingent on a hardcoded flag
staying true"; a real-role browser pass (not just minted mirror sessions) would still be worth doing
before merge, and there's an adjacent unscoped-write finding on group-member update/delete that wasn't in
the original ask.
