---
phase: 8
title: "Leader completion report and due-this-week"
status: pending
priority: P2
effort: "4 days"
dependencies: [4]
---

# Phase 8: Leader completion report and due-this-week

## Overview

<!-- Red team 2026-09-14: F4 + F6 + F7 — delta: no new report is built. `GET /api/groups/manage/report/:groupId`
     already returns per-learner rows as JSON *or* CSV, is assertLeadsGroup-guarded, and is
     already wrapped in api-client and mounted in the Exports tab; this phase extends it
     instead of shipping a parallel route, helper, schema, endpoint, hook, client CSV
     serialiser and sixth tab. The new `/v2/learners/assignments/due` route is likewise
     dropped in favour of the `getUserDashboardAssignments` that Phase 4 already fixes. The
     "1,000-member refuse bound" is removed — the largest real group is 719. Effort 5d → 4d. -->

Phase 4 made the cohort loop *run*. This phase closes it at both ends: the leader gets a
per-learner roster they can read on screen and export, and the learner gets "due this week" on
their home.

**Almost all of it already exists, and the first draft of this phase missed it.**
<!-- Red team 2026-09-14: F4 -->
`GET /api/groups/manage/report/:groupId` (`manager.route.ts:19`, handler `getGroupReport`)
already:

- calls `assertLeadsGroup` as its first statement;
- returns one row per learner — `First Name`, `Last Name`, `Username`, `Email`,
  `Completed Steps`, `Completion Date`, `Completion Percentage`;
- answers **JSON or CSV** on a `type` query param (`manager.schema.ts:55-62`);
- is already wrapped in api-client as `getGroupScanReportJson` / `getGroupScanReportCsv`
  (`endpoints/group-export.ts:72-90`) and `useGroupScanReportDownload`
  (`react/use-group-export.ts:54-61`);
- is already mounted in the group Exports tab (`groups/exports/group-exports-panel.tsx:47`).

The delta this phase actually needs is **a `courseId` filter, `lastAccessedAt`, and three
assignment counts** — a query param and four fields on an existing route. An earlier draft
proposed a second route, a second row builder, a second schema, an endpoint, a hook, a
client-side RFC-4180 serialiser and a sixth tab. That would have produced *three* independent
definitions of "completion" under `/groups/manage` (`getGroupReport`,
`exportGroupCourseProgress`, and the new one — plus `dashboard.getCourseProgressByGroupUser`
as a fourth), which is exactly the "leader's screen and spreadsheet disagree" outcome the
phase calls its worst case.

**The remaining real work is performance and correctness on that existing route.** Its row
assembly is an N+1: `for (const group)` → `getCoursesByGroupId` → `getGroupMembersByGroupId` →
`for (const course)` → `for (const member)` → `getUserProgressByCourseId` per member
(`manager.controller.ts:836-880`). It runs inside the `api` Lambda whose `provider.timeout` is
**28 s** (`serverless.yml:16`), behind API Gateway's 30 s cap. The largest real group has
**719 active members**; 719 × 2 courses is ~1,438 sequential hydrating finds. And its CSV
branch joins with `','` and **does not quote**, so a learner named `Smith, Jr.` already breaks
the Exports tab's existing download today.

**A second IDOR, same family as Phase 4's.** `getUserDashboardAssignments`
(`group-assignment.controller.ts:673`) validates only the *format* of a client-supplied
`userId` (`:676-678`) and checks membership only when a `groupId` is also supplied
(`:681-708`). Phase 4 fixes it as part of its eight-handler sweep. This phase **consumes** the
fixed route rather than adding a new one.

## Requirements

**Functional**

1. A per-group, on-screen report: one row per active member, with completion %, completed
   steps, **last active**, and assignment counts by status — served by the **existing**
   `GET /api/groups/manage/report/:groupId`.
2. Filterable by course via a new `courseId` query param on that route.
3. CSV export via the route's **existing** `type=csv` branch, with server-side quoting fixed.
4. A "Due this week" panel on the learner home, fed by the Phase-4-fixed
   `getUserDashboardAssignments` using the service's existing `dueDateFrom` / `dueDateTo` /
   `isOverdue` filters (`group-assignment.service.ts:108-121`).
5. The learner-side read is caller-scoped by the server; no `userId` travels from the browser.
6. A leader with no group, or a group with no assignments, sees a coherent empty state,
   distinct from loading and from error.

**Non-functional**

7. Authorisation stays `assertLeadsGroup` — already the first statement of `getGroupReport`.
   `administrator` is **not** given a new bypass; see Security for what actually changes.
8. **One row builder.** `getGroupReport` and `exportGroupCourseProgress` must call the same
   batched function, with a row-content characterisation test proving the workbook is
   unchanged. <!-- Red team 2026-09-14: F4 -->
9. Batched reads only: one `groupmembers` read, one `usercourseprogresses` find with
   `{ user: { $in }, course }`, one `groupassignments` aggregation. No per-member loop.
10. **No arbitrary member ceiling.** The largest real group is 719 active members; a 1,000
    bound would never fire and the 28 s timeout is the real constraint. Set the performance
    target from measurement. <!-- Red team 2026-09-14: F4 -->
11. Parse-not-cast for the extended row shape, with a fidelity decision.

## Architecture

```
LEADER SIDE — extend, do not duplicate
  apps/web  groups/exports/group-exports-panel.tsx  (or a Progress tab on the same route)
        │   useGroupScanReport… (EXISTING hook)
        ▼
  GET /api/groups/manage/report/:groupId?courseId=&type=json|csv     ← EXISTING route
        assertLeadsGroup(userId, groupId, req.userRole)              ← EXISTING, first stmt
        │
        └── buildCourseProgressRows({ groupId, courseId })           ← NEW shared builder
              ├─ groupmembers.find({ group, status: ACTIVE })                  1 query
              ├─ usercourseprogresses.find({ user: {$in}, course }).lean()     1 query
              └─ groupassignments.aggregate([...]) grouped by user             1 query
                    ▲
  POST /export-course-progress (EXISTING xlsx) ────────────────────────┘  same builder

LEARNER SIDE — use the route Phase 4 already fixed
  GET /api/group-assignment/dashboard/user?dueDateTo=+7d&isOverdue=…   ← EXISTING route
        userId defaults to req.user.id                                 ← Phase 4 step 1
        rows already carry `route` (Sector paths after Phase 4 step 10)
        │
        ▼
  apps/web  features/home/due-this-week-panel.tsx
```

**Who owns what**

| Side | Owns |
| --- | --- |
| **API** | The batched builder, the `courseId` param, the extra row fields, and the CSV quoting fix. |
| **api-client** | Four fields on the **existing** `groupScanReportEntrySchema`; the `dueDateTo`/`isOverdue` params on the dashboard-user endpoint. |
| **web** | The table rendering and the Due panel. **No CSV serialiser** — the server already emits CSV. |

**Dropped from this phase**, with the reason: <!-- Red team 2026-09-14: F4 -->

| Dropped | Because |
| --- | --- |
| `GET /api/groups/manage/course-progress-report/:groupId` | `GET /report/:groupId` already exists and is already guarded |
| `course-progress-report.helper.ts` | becomes `buildCourseProgressRows`, shared with the export |
| `group-progress-report.ts` schema/endpoint/hook, `groupKeys.progressReport` | the existing `groupScanReportEntrySchema` + `useGroupScanReportDownload` cover it |
| `rows-to-csv.ts` + test | the route emits CSV server-side; fixing its quoting fixes the **existing** broken download too |
| A sixth `progress` group tab | the report renders on the existing Exports tab route |
| `GET /v2/learners/assignments/due`, `learners.due.helper.ts`, `learnerAssignmentsDueSchema`, its endpoint, hook and key factory | `getUserDashboardAssignments` answers it once Phase 4 makes `userId` server-derived, and the service already has the due-date filters |

## Related Code Files

**Create**

- API repo: `src/app/group/manager/helpers/course-progress-report.helper.ts` —
  `buildCourseProgressRows`, batched.
- API repo: `tests/functional/group/course-progress-report-rows.test.ts` — the
  characterisation test for the workbook and JSON rows.
- API repo: `tests/functional/group/group-report-csv-quoting.test.ts`
- `apps/web/src/features/groups/report/report-row-model.ts` + `.test.ts` — column set,
  comparators, `formatLastActive`.
- `apps/web/src/features/groups/report/group-progress-table.tsx` — rendered on the existing
  Exports tab.
- `apps/web/src/features/home/due-this-week-panel.tsx`
- `apps/web/src/features/home/due-this-week-model.ts` + `.test.ts`

**Modify**

- API repo: `src/app/group/manager/manager.controller.ts` — `getGroupReport` calls the shared
  builder; `exportGroupCourseProgress` (`:796`) calls the same one; the per-member loop at
  `:836-880` is deleted; the CSV branch quotes.
- API repo: `src/app/group/manager/manager.schema.ts:55-62` — `getGroupReportSchema` gains
  `courseId?`.
- API repo: `src/app/group-assignment/group-assignment.schema.ts:98-107` — expose
  `dueDateTo` / `isOverdue` on `getUserDashboardAssignmentsSchema` (the service already
  supports them). `userId` becomes optional as part of **Phase 4 step 1**, not here.
- `packages/api-client/src/schemas/group-export.ts` — `groupScanReportEntrySchema` gains
  `lastAccessedAt` and `assignments: { total, completed, overdue }`.
- `packages/api-client/src/endpoints/group-export.ts:72-90` — pass `courseId` through.
- `packages/api-client/src/endpoints/group-assignment.ts` — a caller-scoped
  `getMyDashboardAssignments` wrapper with the due-date params.
- `packages/api-client/src/react/use-group-export.ts:54-61`, `use-group-assignments.ts`
- `packages/api-client/src/fidelity/manifest.ts`, `src/index.ts` (append-only)
- `apps/web/src/features/groups/exports/group-exports-panel.tsx` — render the table above the
  existing download cards.
- `apps/web/src/features/home/{learner,group-leader,scan-reviewer,admin}-home.tsx`
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`,
  `groups-namespace-parity.test.ts`, `home-locale-parity.test.ts`
- `scripts/check/sweep-routes.json`

**Delete** — nothing. The four existing exports stay.

## Implementation Steps

1. **Characterise before refactoring.** <!-- Red team 2026-09-14: F4 -->
   The only existing tests touching `export-course-progress` are leadership-scoping cases
   asserting 403/200 and **nothing about rows**
   (`tests/functional/group/manager/manager-leadership-scoping.test.ts:189-236`). So write
   `course-progress-report-rows.test.ts` first: seed a group with members at several progress
   states and snapshot both the JSON rows and the workbook rows. This is the safety net the
   earlier draft claimed already existed.
2. **Write the batched builder.** `buildCourseProgressRows({ groupId, courseId? })`:
   one `groupmembers.find({ group, status: ACTIVE })`; one
   `usercourseprogresses.find({ user: { $in }, course }).select('user progress status
   completedItems totalItems lastAccessedAt').lean()`; one `groupassignments` aggregation
   grouped by user for `{ total, completed, overdue }`. A member with **no** progress row
   appears as `0% / not started / lastAccessedAt: null` — omitted rows are how a leader
   concludes a learner does not exist.
   Be explicit that this is a behaviour-preserving **rewrite**, not a "pure refactor": the
   old code's data access is the N+1, and both cannot be true at once.
3. **Switch both callers.** `getGroupReport` and `exportGroupCourseProgress` call it. Re-run
   step 1's snapshot; any diff is either a real bug being fixed (say which) or a regression.
4. **Add `courseId`** to `getGroupReportSchema` (`manager.schema.ts:55-62`) and thread it
   through.
5. **Extend the row** with `lastAccessedAt` and the three assignment counts.
6. **Fix the CSV, server-side.** <!-- Red team 2026-09-14: F4 -->
   The existing branch joins with `','` and quotes nothing. Implement RFC-4180: wrap any field
   containing a comma, quote or newline, and double embedded quotes. Then prefix any field
   starting with `=`, `+`, `-`, `@`, **tab (`\t`), carriage return (`\r`) or `|`** with a
   single quote — the full OWASP CSV-injection set, not the four-character subset an earlier
   draft used. This fixes the **already-broken** Exports tab download as a side effect.
7. **Set the performance target from measurement, not a round number.** Largest active group
   = **719** members. Measure p95 against a 719-member fixture and require it under the 28 s
   Lambda timeout with margin; if it cannot be met, require `courseId`. **Do not** add a
   1,000-member refuse bound — it would never fire.
8. **`report-row-model.ts`.** Pure: the column set (reuse the label vocabulary in
   `features/groups/members/columns.ts` rather than inventing new headers), comparators for
   completion and last-active, `formatLastActive` (a date or "never").
9. **The table.** `@tanstack/react-table` (already a dependency,
   `apps/web/package.json:17`), following `members-surface.tsx` rather than inventing a second
   table pattern. A course `Combobox` from `useGroupCourses`, as
   `apps/web/src/features/home/group-learning-snapshot.tsx:83-87` already does
   <!-- Red team 2026-09-14: fact-check correction — this file is under features/home/ -->.
   The Download CSV button calls the **existing** `getGroupScanReportCsv` with `courseId`.
10. **Three distinct states.** Loading → `Skeleton`. Error → `EmptyState` with the message,
    matching `group-assignments-panel.tsx:88-94`. Empty → an `EmptyState` that distinguishes
    "no active members" from "no progress on this course". Rendering a 403 as "nothing yet" is
    the failure `my-learning-panel.tsx:28-30` warns about.
11. **Due panel.** `GET /api/group-assignment/dashboard/user` with `dueDateTo = now + 7d` and
    the overdue flag, **no `userId`** — Phase 4 step 1 makes the server derive it. Rows
    already carry `route`, which Phase 4 step 10 changed to emit Sector paths, so the panel
    and the reminder email cannot name different destinations. Overdue first, then soonest.
    A learner with nothing due sees **nothing** — no empty card, matching Phase 3's Continue
    row.

## Tests / validation

**Unit**

- API `course-progress-report-rows.test.ts` — the step-1 snapshot, re-run after step 3; one
  row per active member and none for inactive; a member with no progress row reads
  `0% / not_started / null`; the `courseId` filter narrows; assignment counts match a
  hand-built fixture; **the JSON rows and the xlsx rows agree field for field**.
- API `group-report-csv-quoting.test.ts` — a name containing a comma lands in one field; an
  embedded quote is doubled; a newline is quoted; each of `= + - @ \t \r |` is prefixed;
  the header row matches the column set; an empty result still emits the header.
- API `read-handler-authorization.test.ts` (**Phase 4**) already covers
  `getUserDashboardAssignments`; this phase adds one case: `dueDateTo`/`isOverdue` return only
  the caller's rows, and there is **no** request shape returning another user's.
- API: `getGroupReport` with `courseId` for a group the caller does not lead → **403**, and a
  plain `administrator` who leads nothing → **403** (see Security — this is a change, and the
  test pins it). <!-- Red team 2026-09-14: F7 -->
- web `report-row-model.test.ts` — `null` `lastAccessedAt` sorts last in both directions;
  `formatLastActive(null)` returns the "never" key, not an empty string; counts derivation on
  a 3-total / 1-completed / 1-overdue row.
- web `due-this-week-model.test.ts` — overdue before upcoming; ties break by due date; an
  empty list renders nothing.
- **Existing, untouched**: `features/groups/members/columns.test.ts` (4 cases),
  `destructive-actions.test.ts` (14 cases), `features/home/resolve-home-dashboard.test.ts`
  (7 cases) — the Due panel is added *inside* the four dashboards, not by changing which one
  resolves.

**Fidelity**

- `groupScanReportEntrySchema` is **already** exported and already covered by the manifest;
  reword its entry to name the four added fields. Because the rows are assembled per caller,
  the honest decision stays `NOT_REPLAYED` with a route-replay pointer —
  `'assembled per caller by getGroupReport from groupmembers, usercourseprogresses and groupassignments; route replay: GET /api/groups/manage/report/:groupId for the seeded leader'`
  — plus a case in `routes.fidelity.test.ts`. No **new** schema is introduced by this phase,
  which is itself the point. <!-- Red team 2026-09-14: F4 -->
- `manifest.test.ts` fails the ordinary unit run if anything is left undecided. Run
  `pnpm fidelity` with `SECTOR_MIRROR_JWT_SECRET` set and `:5002` up; a skipped route replay
  (`routes.fidelity.test.ts:65-70`) proves nothing.

**Browser** — `node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>`:

```json
{ "path": "/administer/groups/6a6ae3d759ab84398c7cee4f/exports",
  "role": "reviewer", "needs": "Completion|Last active" }
{ "path": "/", "role": "learner", "needs": "Welcome back" }
{ "path": "/", "role": "leader", "needs": "Group leader dashboard" }
```

The group id is the one already in the sweep — 201 active members, 1,367 assignments over 2
courses. Note it is **not** the worst case: the 719-member group is, and it is exercised by
the step-7 performance fixture rather than by the sweep. The two home rows already exist;
re-run them so a Due panel that throws on a cold load fails the sweep. There is **no**
`/progress` row — the report lives on the existing exports route.
<!-- Red team 2026-09-14: F4 -->

Manual pass:

1. Open the Exports tab as a leader. Rows render; sorting by completion and last-active works;
   the course filter narrows.
2. Download the CSV. Open it in a spreadsheet. A name containing a comma occupies one cell;
   on-screen and CSV numbers match row for row.
3. Cross-check one learner's percentage against the `export-course-progress` workbook from the
   same tab. They must agree — that is what step 2's shared builder buys.
4. Edit the URL to a group you do not lead. Confirm a 403 surface, not an empty table.
5. As a learner with a due assignment, confirm the Due panel and that its link opens the same
   destination the reminder email uses. With none, confirm no panel and no gap.
6. Console clean.

## Success Criteria

- [ ] **No new route, schema, endpoint, hook, client CSV serialiser or group tab is added**
- [ ] `GET /api/groups/manage/report/:groupId` accepts `courseId` and returns `lastAccessedAt`
      plus the three assignment counts
- [ ] `getGroupReport` and `exportGroupCourseProgress` produce identical rows from one builder,
      proven by a snapshot written **before** the refactor
- [ ] The per-member loop at `manager.controller.ts:836-880` is gone; three batched queries
      replace it
- [ ] A 719-member fixture completes inside the 28 s Lambda timeout with margin
- [ ] The route's CSV quotes correctly and neutralises `= + - @ \t \r |` — fixing the
      **existing** broken download
- [ ] A member with no progress row appears as `0% / not started`, not omitted
- [ ] The Due panel uses `getUserDashboardAssignments` with **no** `userId` from the browser
- [ ] A plain `administrator` who leads no group gets 403 here, and a test pins it
- [ ] Playback positions (Phase 2) and notes (Phase 6) appear nowhere in the report or CSV
- [ ] Cold-load sweep 100% healthy

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Three definitions of "completion" under `/groups/manage` | **Was certain** | **High** — compliance-adjacent | One builder, two callers, a row snapshot written first |
| Refactor changes the workbook silently | High (no row tests exist today) | High | Step 1's characterisation test is the first commit |
| N+1 times out on a large group | **High** at 719 members | High | Three batched queries; a measured p95 target, not a round-number bound |
| Existing CSV already broken for names with commas | **Certain today** | Medium | Fixed server-side in this phase; benefits the current Exports tab immediately |
| CSV injection | Medium | Medium | Full `= + - @ \t \r \|` prefix set with a test per character |
| `administrator` loses access | **Certain** | Medium | Stated plainly, pinned by a test, flagged as the open product question |
| `assertLeadsGroup` silently disabled | Low | **High** | `GROUP_LEADER_SCOPED_VISIBILITY` named below and pinned by Phase 4's build assertion |
| Scope creep into surveillance | Medium | High | Boundary in the Overview and a success criterion: no positions, no notes |

## Security Considerations

- **`GROUP_LEADER_SCOPED_VISIBILITY` gates every guarantee on this page.**
  <!-- Red team 2026-09-14: F6 -->
  `leadsGroup` returns `true` unconditionally when that flag is `false`
  (`group-member.service.ts:308-310`); it is a hard-coded `export const … = true`
  (`src/config/group-leader-scoped-visibility.ts:17`). `assertLeadsGroup` is a thin wrapper
  (`:328-332`). So `getGroupReport`'s existing guard, and everything this phase adds behind
  it, becomes a no-op the moment someone flips that constant during an incident — at which
  point any holder of the permission reads any group's roster **with email addresses**. Phase 4
  adds the build assertion that fails when it is not `true`; this phase's success criteria are
  asserted **with the flag on**, and that is stated so the next reader knows the tests do not
  cover the other state.
- **`administrator` moves from 200 to 403 here, and this is a real change, not "unchanged".**
  <!-- Red team 2026-09-14: F7 -->
  `withPermission` treats both `full-access` and `admin:full-access` as wildcards
  (`permission.middleware.ts:12`); in the mirror's roles `administrator` holds `full-access`
  while only `Superadmin` holds `admin:full-access`. But `leadsGroup`'s only bypass is
  `hasAdminFullAccess`, which checks `admin:full-access` alone (`permission.util.ts:4-8`). So
  a plain `administrator` who leads nothing loses these surfaces. Do not paper over it with an
  ad-hoc `full-access` bypass — that is the "administrator widening" the plan puts out of
  scope. Pin the behaviour with a test, tell the API team it is a decision rather than an
  accident, and keep "should a non-leading administrator reach a group" as the open product
  question.
- Phase 4 closes the `getUserDashboardAssignments` IDOR; this phase **depends** on that fix
  and must not ship the Due panel before it. Until then, that route returns any learner's
  assignments to any holder of `read:group-assignment`.
- The report carries learner names, emails and progress — real PII disclosed to a group
  leader. Legitimate and expected in a cohort product, which is why the boundary must be
  explicit: completion, assignment status, last active. **No playback positions, no notes, no
  per-video watch behaviour.** A note can carry clinical detail and a position log is
  minute-by-minute behavioural data; neither belongs in a leader's spreadsheet.
- `email` is already in the existing row shape, so this phase does not newly expose it — but
  it does mean the whole group's addresses reach the browser on first render. If the product
  wants email to be opt-in, make it a **server-side `?include=email` projection**, off by
  default; a client-side hidden column is not a control. Set `staleTime: 0, gcTime: 0` on the
  report query so the rows are not retained after the tab unmounts.
- CSV leaves the product as a file. Keep the filename free of PII beyond the group name.
