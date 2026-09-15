# Red-team plan review — Scope & Complexity Critic (Contract Verifier role)

Plan: `plans/260914-1456-sector-course-experience-roadmap/` (plan.md + phase-01..08)
Reviewed: 2026-09-14. Codebases read-only: `scanvault` @ `feat/sector`, API worktree @ `feat/sector-api`, `gusi_scanhub_console`.
Constraint honoured: full scope (re-entry + cohort loop + player shell + landing + reminders in Release 1) is a user decision and is not attacked. Every finding below is about HOW, not WHETHER.

---

## Finding 1: Phase 8 builds a second per-learner completion report that already exists end to end

- **Severity:** Critical
- **Location:** Phase 8, "Overview" ("the gap is not export course progress… a leader has to download a spreadsheet"), "Architecture — LEADER SIDE", "Related Code Files — Create", steps 2–3, 8–9, 11
- **Flaw:** Phase 8 proposes a new `GET /api/groups/manage/course-progress-report/:groupId`, a new `course-progress-report.helper.ts`, a new `groupCourseProgressReportSchema`, endpoint, hook, query key, a client-side RFC-4180 CSV serialiser (`rows-to-csv.ts`), and a sixth group tab. It inventories `export-course-progress` and `export-course-data` and concludes only xlsx exists. It never mentions `GET /api/groups/manage/report/:groupId`, which already: is `assertLeadsGroup`-guarded, returns per-learner rows (first/last name, username, email, completed steps, completion date, completion %) as **JSON or CSV**, is already wrapped in api-client (`getGroupScanReportJson` / `getGroupScanReportCsv`, `useGroupScanReportDownload`), and is already mounted in the group Exports tab. The phase's delta over the existing route is: a `courseId` filter, `lastAccessedAt`, and three assignment counts. That is a query param and three fields on an existing route, not a parallel route + schema + serialiser + tab.
- **Failure scenario:** Two JSON completion reports with two row builders ship under `/groups/manage`. The plan's own worst-case ("leader's screen and their spreadsheet disagree about the same learner") becomes three-way: `getGroupReport` JSON/CSV, `exportGroupCourseProgress` xlsx, and the new route each compute completion independently (all three, plus `dashboard.getCourseProgressByGroupUser`, are today separate per-member N+1 loops). Step 2's "pure refactor, existing export tests are the safety net" is false: the only tests touching the export are 403/200 leadership-scoping cases that assert nothing about rows, and step 4's "batched `$in`, never a per-member loop" contradicts step 2's "no behaviour change" of a per-member loop.
- **Evidence:**
  - `api/src/app/group/manager/manager.route.ts:19` — `router.get('/report/:groupId', authUser, managerGroupController.getGroupReport)`
  - `api/src/app/group/manager/manager.controller.ts` `getGroupReport` — `assertLeadsGroup` first statement; rows `'First Name' | 'Last Name' | 'Username' | 'Email' | 'Completed Steps' | 'Completion Date' | 'Completion Percentage'`; `query.type === 'csv'` branch joins with `','` (no quoting) else JSON
  - `api/src/app/group/manager/manager.schema.ts:55-62` — `getGroupReportSchema` query `{ type?: 'csv' | 'json' }` (no `courseId` yet)
  - `packages/api-client/src/endpoints/group-export.ts:72-90` — `getGroupScanReportJson` / `getGroupScanReportCsv` → `/api/groups/manage/report/${groupId}`
  - `packages/api-client/src/react/use-group-export.ts:54-61` — `useGroupScanReportDownload`
  - `apps/web/src/features/groups/exports/group-exports-panel.tsx:1-50` — imports and uses it (`reportBusy: 'json' | 'csv'`)
  - `api/tests/functional/group/manager/manager-leadership-scoping.test.ts:189-236` — the only `export-course-progress` tests; three status assertions, zero row assertions
  - `api/src/app/dashboard/dashboard.route.ts:70,83` + `dashboard.controller.ts:377` — a fourth per-user matrix implementation, `callerCanAccessGroup`-guarded
- **Suggested fix:** Extend `getGroupReport`: add `courseId?` to `getGroupReportSchema`, add `lastAccessedAt` and `assignments: {total, completed, overdue}` to the row, replace its per-member loop with the batched `$in` reads the phase already specifies, and fix its CSV branch to quote fields (server-side, once — also fixes the Exports tab's existing broken CSV). Have `exportGroupCourseProgress` call the same row function. In the client: extend `groupScanReportEntrySchema`, render the rows with `@tanstack/react-table` on the existing Exports tab or a "Progress" tab, and download via the existing `getGroupScanReportCsv`. Delete from the phase: new route, `course-progress-report.helper.ts`, `group-progress-report.ts` schema/endpoint/hook, `rows-to-csv.ts` + test, `groupKeys.progressReport`. Effort drops by ~2 days.

---

## Finding 2: Phase 8 adds a new "assignments due" learner route while fixing, in the same phase, the route that already answers it

- **Severity:** High
- **Location:** Phase 8, "Architecture — LEARNER SIDE", "Why a new learner route rather than fixing `getUserDashboardAssignments`", steps 1 and 5; Phase 4 step 6 (`getSectorAssignmentPath`)
- **Flaw:** Step 1 makes `getUserDashboardAssignments` default `userId` to `req.user.id` and validate a mismatch. After that fix the handler already returns the caller's own assignments, each with a `route`, plus a `userProgress` overview containing `overdueAssignments`/`pendingAssignments`. The database service's filter builder already supports `dueDateFrom` / `dueDateTo` / `isOverdue`. Step 5 nonetheless creates `GET /api/v2/learners/assignments/due`, `learners.due.helper.ts`, `learnerAssignmentsDueSchema`, `learner-assignments-due.ts` endpoint, `use-learner-assignments-due.ts`, a `learnerAssignmentKeys` factory and a fidelity entry. The stated reason — "no `userId` in its vocabulary" — is a style preference; step 1 already makes a supplied `userId` server-validated. Separately, Phase 4 step 6 adds `getSectorAssignmentPath` "beside" `getAssignmentRouteComposition` and explicitly leaves the legacy builder in place; Phase 8 step 5 then consumes the new one. Two link builders for one assignment, forever.
- **Failure scenario:** Two routes answer "my assignments": one paginated with `route` (legacy path) and `userProgress`, one unpaginated with a Sector path. A learner's Due panel and the dashboard route disagree on which assignments exist (different status filters: the dashboard's `isOverdue` uses `status != completed`, the new route uses `status in {active, in_progress}` — `draft` rows differ). Meanwhile the creation email keeps sending `/dashboard/my-courses/...` links that spend a redirect, which Phase 4 calls out as undesirable and then preserves.
- **Evidence:**
  - `api/src/app/group-assignment/group-assignment.controller.ts:673-760` — `getUserDashboardAssignments`: `getAll(filterQuery)`, `getUserAssignmentProgress(query.userId)`, `route: getAssignmentRouteComposition(assignment)` per row
  - `api/src/database/group-assignment/group-assignment.service.ts:108-121` — `dueDateFrom`/`dueDateTo`/`isOverdue` filters already exist
  - `api/src/database/group-assignment/group-assignment.service.ts:442-478` — `getUserAssignmentProgress` already computes `overdueAssignments`
  - `api/src/app/group-assignment/group-assignment.schema.ts:98-107` — `getUserDashboardAssignmentsSchema`: `userId` required; no due-date params exposed
  - `api/src/app/group-assignment/group-assignment.service.ts:1233-1263` — `getAssignmentRouteComposition` returns `my-courses/...` fragments
  - `apps/web/src/app/legacy-route-map.ts:224-266` — all six legacy shapes already redirect to `/learn/courses/:courseId/:itemId`
- **Suggested fix:** Phase 8 step 1 stays (IDOR fix, own commit). Then: make `userId` optional in `getUserDashboardAssignmentsSchema`, expose `dueDateTo` and `isOverdue` (already in the service), wrap that one route in api-client for the Due panel. Delete the new learners route, helper, schema, endpoint, hook, key factory. In Phase 4, change `getAssignmentRouteComposition` to emit Sector paths once (the legacy map guarantees old links still resolve, so this is safe and fixes the creation email too) instead of adding a second builder.

---

## Finding 3: Phase 4 swaps the Assignments tab onto a second data source (dashboard route) to derive a status the current rows already carry

- **Severity:** High
- **Location:** Phase 4, "Architecture" (bottom block), "Related Code Files — Create" (`group-assignment-dashboard.ts` schema/endpoint/hook), steps 1 and 10, "Fidelity"
- **Flaw:** `group-assignments-panel.tsx` already reads `useAssignmentsForGroup` → `GET /api/group-assignment/group/:groupId`, whose rows are `groupAssignmentSchema` with `status` and `dueDate`. Step 10's `assignmentLifecycle(row, now)` is a pure function of exactly those two fields. Yet the phase re-points the panel at `GET /api/group-assignment/dashboard/group-leader`, adds `groupAssignmentDashboardSchema` + analytics sub-schema, a new endpoint, a new hook, two fidelity entries and a `routes.fidelity.test.ts` case. The only extra the dashboard route gives is `analytics.assignmentsByStatus` / `overDueAssignments` (totals) and `activeLearnerCount`. The api-client file the phase cites already tells future authors to "prefer the group-scoped read below; it is the only route in this domain that checks anything about the caller's relationship to the group".
- **Failure scenario:** The Assignments tab depends on two routes with two auth models (`getAssignmentsByGroupId` checks active membership; the dashboard route, after step 1, checks leadership). A learner-member who could open the tab yesterday gets a half-rendered tab (list loads, counts 403) — the mixed-state failure `my-learning-panel.tsx:28-30` warns about. The phase adds a schema for a per-request assembled shape it admits it does not know ("Leader dashboard response shape unknown to the client").
- **Evidence:**
  - `apps/web/src/features/groups/forms/group-assignments-panel.tsx:1-8,66` — `useAssignmentsForGroup(groupId)`
  - `packages/api-client/src/schemas/group-assignment.ts:112-113` — `dueDate: z.string().nullish()`, `status: groupAssignmentStatusSchema`
  - `packages/api-client/src/endpoints/group-assignment.ts:14-37,76-89` — the doc comment and `getAssignmentsForGroup`
  - `api/src/app/group-assignment/group-assignment.controller.ts` `getAssignmentsByGroupId` (+21..+32) — active-membership check, 403 otherwise
  - `api/src/database/group-assignment/group-assignment.service.ts:380-440` — `getAssignmentAnalytics` returns `assignmentsByStatus`, `overDueAssignments`, and `completionRate: 0 // TODO`
- **Suggested fix:** Keep the panel on `useAssignmentsForGroup`; derive the pill from the rows it already has (step 10 as written). Land the `assertLeadsGroup` fix on the dashboard route as the standalone security commit the phase already wants — but do not adopt the route as a data source. If group-wide totals are required by the success criterion ("four counts above the list, on a group with 1,367 assignments"), add `analytics` as an optional include on the existing group-scoped read, or accept counts for the current filter. Delete: `group-assignment-dashboard.ts` schema/endpoint/hook and their fidelity entries. If the planner wants to switch routes *for the stronger auth*, say so explicitly — that is the only defensible reason, and it is not the one given.

---

## Finding 4: Phase 5's `PlayerFrame` hoist is not implementable as described and delivers nothing the route nesting does not already deliver

- **Severity:** High
- **Location:** Phase 5, "Architecture — Data flow" (`PlayerFrame mounts when the active item is a video topic; keyed by topicId`), "The player moves up, the body stays down", "The one real hazard", steps 7–8, 12; Success Criteria 2 and 3; Phase 6 step 11
- **Flaw:** The Vimeo iframe is not a separate element the app renders — it is inside the authored topic HTML, rendered through `RichText` and found afterwards with `querySelector('iframe[src*="player.vimeo.com"]')`. "Hoist the *container*, the body HTML still comes from `useCourseTopicDetail` inside `TopicView`" cannot be done: the container that holds the iframe *is* the body. Making it work requires splitting the iframe out of sanitised HTML and rendering the remainder separately — a new content-parsing mechanism the phase neither specifies, tests, nor costs. Further, `PlayerFrame` is `key={item.id}` by design, so it rebuilds on every topic change; within a topic the only thing that changes is the tab (Phase 6). So it persists across nothing in Phase 5. Success criterion 2 ("does not remount … the player container") contradicts step 7 ("rebuilds on a topic change"). What actually gives the LinkedIn-style property is the layout-route nesting (header + contents pane survive navigation), which needs no `PlayerFrame`. Phase 6's "exactly one `Player` instance" is equally satisfied by `TopicView` owning the `Player` and exposing `seekTo`/current-time through context.
- **Failure scenario:** Implementer discovers mid-phase that the iframe lives in `RichText` output, invents an HTML splitter, and the plan's own listed hazard ("watch tracking attaches to the previous topic's iframe … no node-environment test can see") materialises. Or the hoist is quietly dropped and `player-frame.tsx`, `course-shell-context` player fields, and Phase 6's "lift construction into `player-frame.tsx`" become dead scaffolding.
- **Evidence:**
  - `apps/web/src/features/courses/runner/topic-view.tsx:31,76-78` — `contentRef` wraps `<RichText html={detail.data.content} />`; no separate player element
  - `apps/web/src/features/courses/runner/use-vimeo-watch-tracking.ts:27-31` — iframe located inside the container by selector; `new Player(iframe)`
  - `apps/web/src/features/courses/runner/course-runner-page.tsx:106-117` — today's per-item mount of `CourseLayout` + sidebar; nesting alone fixes this
  - Phase 5 step 7 vs Success Criterion 2 (internal contradiction)
- **Suggested fix:** Cut `player-frame.tsx`. `CourseShell` = layout route with outline query, header, `OutlineSidebar`, `<Outlet/>`, one `CourseItemNav`. `TopicView` keeps the `Player`; Phase 6 adds a small `usePlayerBridge()` context (seekTo + currentTime) published by `TopicView`. Resume-at-position (step 8) moves into the existing hook on `ready`. Removes a file, a context surface, the listed hazard, and about a day.

---

## Finding 5: Phase 4 creates a collection, an API domain, a client trio and an account surface for one boolean — and the granularity it chooses is incoherent with the digest it gates

- **Severity:** High
- **Location:** Phase 4, "Why a new opt-out and not a fifth `NotificationType`", "Related Code Files — Create" (`assignment-reminder-preference` model, route/controller/schema, api-client schema/endpoint/hook, `account/assignment-reminder-preferences.tsx`), steps 3, 5, 11; sweep row `/account/reminders`
- **Flaw:** The plan correctly rejects `groupnotifications` (leader-keyed). It then jumps to a new `(user, group)`-keyed collection with its own route family, rather than the smaller option: a per-user flag served by the existing account profile read/write and rendered in the existing `account/notification-preferences.tsx` card. Requirement 2 makes the overdue digest **one email per learner across all groups**; a per-group opt-out cannot honour that — a learner opted out of group A still receives the digest listing group B rows, so the email still arrives. Per-group granularity is therefore a design choice that adds a collection + 3 route files + schema + endpoint + hook + surface + sweep row and does not produce a coherent behaviour for half the emails it gates. No success criterion requires per-group; the only requirement is "the opt-out is theirs, not their leader's".
- **Failure scenario:** Step 5's in-memory pair filter drops group-A rows from a learner's digest but still sends it; support tickets read "I turned reminders off and still get them". A second preference surface at `/account/reminders` sits beside the existing notification card on `/profile`, so two places on the account say "notifications".
- **Evidence:**
  - `api/src/database/group-notification/group-notification.model.ts:10-15,57` — leader-side model, `(user, group)` unique (plan's rejection is correct)
  - `api/src/app/group-notification/group-notification.controller.ts:53-57,130-133` — leader-only enforcement
  - `apps/web/src/features/account/notification-preferences.tsx:1-25` — existing account notification card
  - `apps/web/src/features/account/account-routes.tsx` — single `profile` route; no `/account/reminders` exists
  - `packages/api-client/src/fidelity/manifest.ts:587` — `updateProfilePayloadSchema: 'request body of PUT /api/account/profile'` (existing write path)
  - Phase 4 Requirement 2 vs Requirement 6 (digest is cross-group; opt-out is per-group)
- **Suggested fix:** One boolean on the user (`assignmentRemindersOptOut`) through `PUT /api/account/profile`; one switch row appended to `notification-preferences.tsx`; the job filters `users` with the flag. Drop the collection, the `src/app/assignment-reminder-preference/*` domain, the client schema/endpoint/hook, the new surface, and the `/account/reminders` sweep row. If per-group is a real product requirement, the plan must state who asked for it and how the cross-group digest honours it.

---

## Finding 6: Phases 2 and 3 put the same number on the wire twice under two names and edit the same six files in two passes

- **Severity:** Medium
- **Location:** Phase 2 "Related Code Files — Modify" (outline helper, outlinecontent helper, `course-outline.ts:69-92`, `manifest.ts`, `index.ts`, README) and step 6; Phase 3 "Related Code Files — Modify" (same six files) and steps 1–2
- **Flaw:** Phase 2 adds `videoDurationSeconds` and `positionSeconds` to the outline item and adds the `v2topicmedia` join to `fetchOutlineContent`. Phase 3 then adds `durationSeconds` and `imageUrl` to the same item and re-edits the same join, the same `OutlineItem` literal, the same Zod schema, the same `NOT_REPLAYED` entry, the same barrel block and the same README. `videoDurationSeconds` (Phase 2) and `durationSeconds` (Phase 3) are the same value from `v2topicmedia.durationSeconds`. Phase 2's own text says the API "adds exactly one field" and Phase 3's says the same — for the same field. Two passes over one contract is the drift the plan elsewhere says it avoids.
- **Failure scenario:** The schema ships with both `videoDurationSeconds` and `durationSeconds`; the sidebar renders one, the summariser sums the other; a topic whose media row was re-fetched between phases has the two disagree.
- **Evidence:**
  - `packages/api-client/src/schemas/course-outline.ts:69-92` — one `courseOutlineItemSchema`, edited by both phases
  - `api/src/app/lms/learners/helpers/learners.outlinecontent.helper.ts:49-98` — `fetchOutlineContent` returns `{ contentById, questionCounts }`; both phases add the fifth query here
  - `api/src/app/lms/learners/helpers/learners.outline.helper.ts:214-227` — the item literal both phases extend
  - `packages/api-client/src/fidelity/manifest.ts:676-679` — the `courseOutlineItemSchema` / `courseOutlineSchema` `NOT_REPLAYED` entries both phases re-word
- **Suggested fix:** Phase 2 owns the wire: add `durationSeconds`, `positionSeconds`, `imageUrl` once, one join, one schema edit, one manifest edit. Phase 3 becomes render-only (`outline-summary.ts`, header, Continue row, module page) and touches no API or api-client file. Delete `videoDurationSeconds` as a name.

---

## Finding 7: Phase 3's Continue row spends four outline requests and a new batched hook to get data the list route could carry in one field

- **Severity:** Medium
- **Location:** Phase 3, "The Continue row's data path", "Related Code Files — Create" (`packages/api-client/src/react/use-course-outlines.ts`), steps 8–9, Requirement 8, Risk "Continue row adds 4 outline requests"
- **Flaw:** Requirement 8 says "no new request on the learner home beyond the ones already made", then the architecture adds up to four outline fetches and a new `useQueries` hook on every home load for every role. The progress document already stores `lastItemAccessed`, which Phase 2's position write `$set`s on every tick. Adding `lastItemAccessed` (id + title) and the item's `positionSeconds` to `learnerCourseProgressSchema` on `GET /api/v2/learners/courses` — a route already in flight — makes the Continue row zero-request. The plan's counter-argument (reuse `resolveResumeTarget`'s blocked-quiz rule) applies to the *outline page*, where the full item list is present; for a "continue where you left off" row the stored `lastItemAccessed` is the more honest pointer anyway.
- **Failure scenario:** Four extra `GET …/outline` per home render on top of the eight dashboard calls the plan already counts; a learner with four in-progress 185-item courses pulls ~740 outline items to render four lines of text.
- **Evidence:**
  - `apps/web/src/features/home/my-learning-panel.tsx:36` — `useCourses({ query: { limit: 100 } })` already in flight
  - `packages/api-client/src/schemas/course.ts:143-155` — `learnerCourseProgressSchema` has `lastAccessedAt`, `status`, `progress`; no `lastItemAccessed`
  - `api/src/database/user-course-progress/user-course-progress.model.ts:68,234` — `lastItemAccessed` exists on the document
  - Phase 2 step 3 — the position write already `$set`s `lastItemAccessed`
- **Suggested fix:** Extend the list route's progress projection with `lastItemAccessed: { id, title, positionSeconds } | null` (proved by the existing `usercourses` replay entry). Continue row reads it; no `use-course-outlines.ts`; Requirement 8 becomes true.

---

## Finding 8: Phase 3 builds the outline header on `course-outline-page.tsx`; Phase 5 immediately relocates it into `course-shell-header.tsx`

- **Severity:** Medium
- **Location:** Phase 3 step 4 and "Related Code Files — Modify" (`course-outline-page.tsx` header block `:84-95`); Phase 5 "Related Code Files — Create" (`course-shell-header.tsx`), "Modify" (`course-layout.tsx` breadcrumb/progress "move into `course-shell-header.tsx`"), step 6
- **Flaw:** Phase 3 adds ring, counts and remaining-minutes to the outline page header. Phase 5 then hoists the header (and `course-layout.tsx`'s breadcrumb + progress bar) into a shell header, and makes the outline page read from context and "delete its pending/error branches". Two passes over one header, and the outline page's header code written in Phase 3 is moved or deleted in Phase 5. Phase 5 also restates Phase 3's `Course contents` sweep `needs` on three rows Phase 3 already strengthens.
- **Failure scenario:** Merge churn on `course-outline-page.tsx` and the seven locale files across two phases; the Phase 3 header keys (`courses.outline.counts/remaining`) get duplicated under `courses.shell.*` in Phase 5.
- **Evidence:**
  - `apps/web/src/features/courses/outline/course-outline-page.tsx:76-95` — current header block Phase 3 edits
  - `apps/web/src/features/courses/runner/course-layout.tsx:40-57` — breadcrumb + progress bar Phase 5 moves
  - `apps/web/src/features/courses/courses-routes.tsx:41-46` — flat routes Phase 5 nests
- **Suggested fix:** Either (a) Phase 3 writes `course-shell-header.tsx` as a standalone component mounted by the outline page and later by the shell unchanged, or (b) land the route nesting (Phase 5 minus PlayerFrame/tabs — about two days) *before* Phase 3 so the header is written once in its final home. Option (b) also gives Phase 3's module page and Continue row their final routing context.

---

## Finding 9: Phase 2's "tests-first" suite characterises server code the phase explicitly does not change

- **Severity:** Medium
- **Location:** Phase 2, "Tests Before" (seven `learners.process.topic.test.ts` cases), step 1, step 7 ("`determineTopicStatus` … is **unchanged**"), "Refactor"
- **Flaw:** The phase mandates seven characterisation tests on `determineTopicStatus`, `processTopicProgress` and `updateParentLessonIfComplete` and forbids touching a non-test file until they are green — and then states in step 7 that none of those functions is edited. The only behavioural change is in the browser hook, which the plan concedes no test in the repo can render. Characterising code you will not modify is ceremony, not a gate. The regression gate's real protections (forward-only count, functional test on `items[]` length, `manifest.test.ts`) stand on their own.
- **Failure scenario:** A day of API unit tests on an unchanged function, while the actual risk (hook attaches to the wrong iframe, threshold fires twice) is covered only by a manual pass. Effort is spent where risk is not.
- **Evidence:**
  - `api/src/app/lms/learners/helpers/learners.process.topic.ts:117-136,169-247` — the functions named; Phase 2 step 7 says unchanged
  - `apps/web/vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']`; hook untestable here (plan agrees)
- **Suggested fix:** Keep `watch-threshold.test.ts`, `learners.position.helper.test.ts`, the functional `track-video-position.test.ts`, the outline-helper extension, and the before/after completed-count gate. Drop the seven characterisation cases (or reduce to one pin on `wasCompleted`, which is the forward-only guarantee). Re-cost Phase 2 at 4–5 days.

---

## Finding 10: Phase 7 spends third-repo effort on console form controls the plan itself rates "High" likelihood of never being used, and invents validation limits nobody asked for

- **Severity:** Medium
- **Location:** Phase 7, "Architecture — CONSOLE", "Related Code Files — Modify" (console `course-edit.tsx`, `course-create.tsx`), steps 3 and 11, Risk "Content team never fills level/objectives — High"
- **Flaw:** The phase adds two form controls to `gusi_scanhub_console` (a separate repo with its own release cadence) while (a) stating the page ships useful without the fields, (b) rating "content team never fills them" as High likelihood, and (c) already handing the content team a CSV (step 12). The minimum change is the API model + write-schema fields (so a script or the existing `PUT /api/v2/courses/:id` can populate them) and the Sector rendering; the console PR should be gated on the content owner named in plan.md actually committing to author them. Step 3 also invents "12 objectives × 300 chars" caps with "say," — arbitrary limits become contract and tests (`13 objectives is 400`) for a field with zero rows today.
- **Failure scenario:** A console PR lands, is never used, and the landing page renders level/objectives for zero of 146 published courses — exactly the outcome the phase predicts.
- **Evidence:**
  - `gusi_scanhub_console/src/pages/dashboard/courses/course-edit.tsx:370-395` — Content (`EditorQuill`) and `DurationInput` controls the phase would extend
  - `api/src/app/v2/course/course.schema.ts:82-93` — `updateCourseByIdSchema` (the write path that must change regardless)
  - `api/src/database/v2/course/course.model.ts:74-131` — no `level`/`objectives` today (plan's count of 0/175 is consistent)
  - Phase 7 Risk table, row 2
- **Suggested fix:** Phase 7 = API fields + write schema + Sector page. Console fields become a separate item, blocked on the content owner and a first batch of authored content, so engineering follows demand rather than predicting its absence. Replace "say, 12 × 300" with either no cap beyond a sane body limit or a cap the content owner sets.

---

## Finding 11: Phase 6 Notes is not traceable to any evidence or criterion in plan.md, and becomes the phase's main deliverable when the gate fails

- **Severity:** Medium
- **Location:** Phase 6, "Overview" (gate), "Why notes are a new collection", "Related Code Files — Create" (API model/service/helper + 4 routes, client schema/endpoint/hook, `courseNoteKeys`, seed change, replay entry, three UI files), steps 2–4, 10
- **Flaw:** plan.md's evidence is early drop-off and no reminders. Notes is justified only by external research; no roadmap success criterion measures comprehension or note usage. It is the one item in the roadmap that creates a new user-content store with clinical/PII implications (the phase says so), a soft-delete lifecycle, four routes, and a seed + fidelity replay path. The phase is structured so that if the caption gate fails, the fallback scope is "Notes and Chapters" — i.e., a failed transcript gate *defaults* to building a new content store. This is not a request to drop Notes (shell scope is the user's); it is that Notes should carry its own go/no-go rather than inherit the transcript's.
- **Failure scenario:** Gate fails (Phase 1 risk "Medium"), Phase 6 re-scopes to 5 days, and Release 2 ships a persistent shell whose headline features are chapter markers and a notes CRUD — neither of which addresses the 58%-under-25% number the roadmap is sequenced by.
- **Evidence:**
  - plan.md "Overview" — evidence paragraph names drop-off and overdue assignments only
  - Phase 6 step 1 — "If coverage < 70%, cut steps 5–8… re-scope to 5 days" (Notes + Chapters remain)
  - Phase 6 "Security Considerations" — "A note on a POCUS topic can contain clinical or patient-adjacent detail"
  - `packages/api-client/src/query-keys.ts:118-125` — `courseContentKeys` pattern the phase copies for `courseNoteKeys`
- **Suggested fix:** Split Notes into its own phase (Release 2b) with an explicit decision point after the gate result is known. Chapters (≈0.5 day, no API) can stay with the shell. Phase 6 becomes "Transcript + Chapters, gated" and cannot silently mutate into "Notes".

---

## Effort and merge notes (non-blocking)

- 44 days total. Applying Findings 1–5 and 7–9 removes roughly 8–10 days without losing a success criterion: Phase 8 5→3, Phase 4 6→4, Phase 5 5→3 (nesting + tabs only), Phase 2 6→4–5, Phase 3 6→5.
- Merge candidates: route nesting (Phase 5 core) before Phase 3 (Finding 8); Phase 4 status pill + Phase 8 report onto existing routes (Findings 1, 3) — the two leader surfaces then share one data source each.
- Fidelity/sweep per phase: present in every phase; Phase 1 and Phase 5 correctly record "no entry" decisions. Not over-tested at the fidelity layer. Over-tested at the API unit layer in Phase 2 (Finding 9).

---

## Verification Results (Contract Verifier)

Callers enumerated with `grep -rn` over `apps/web/src`, `packages/api-client/src`, `packages/ui/src`, `scripts` (node_modules/dist excluded by path). Counts exclude the defining file's own declaration.

| Interface | Callers (file:line) | Total |
|---|---|---|
| `groupOutlineItemsForDisplay` (`course-outline-model.ts:25`) | `outline/course-outline-page.tsx:69`; `runner/outline-sidebar.tsx:35`; `course-outline-model.test.ts:44,59,68,74` | 2 prod + 4 test |
| `resolveResumeTarget` (`:81`) | `outline/course-outline-page.tsx:70`; `course-outline-model.test.ts:120,125,130,135,140,144`; doc ref `schemas/course-outline.ts:37` | 1 prod + 6 test |
| `findOutlineItem` (`:44`) | `runner/course-runner-page.tsx:90`; `course-outline-model.ts:86`; `course-outline-model.test.ts:82,86,90` | 2 prod + 3 test |
| `useVimeoWatchTracking` (`use-vimeo-watch-tracking.ts:15`) | `runner/topic-view.tsx:45` (only caller); doc ref `endpoints/course-content.ts:23` | 1 |
| `courseItemPathFor` (`courses-links.ts:19`) | `runner/course-item-nav.tsx:27,37`; `outline/course-outline-item-row.tsx:97`; `runner/outline-sidebar.tsx:102`; `outline/course-outline-page.tsx:99` | 5 |
| `coursePathFor` (`:14`) | `runner/quiz-view.tsx:138`; `runner/course-layout.tsx:42`; `runner/course-runner-page.tsx:99`; `my-courses/course-card.tsx:64` | 4 |
| `COURSE_*_ROUTE_PATH` (`:28,31,35,40`) | `courses-routes.tsx:42-45` only | 4 |
| `courseOutlineItemSchema` / `courseOutlineSchema` (`course-outline.ts:69,102`) | `index.ts:647,650`; `endpoints/course.ts:2,69`; `schemas/course.test.ts:235,241,247,252`; `fidelity/routes.fidelity.test.ts:10,251`; `fidelity/manifest.ts:676,678` | 5 files |
| `learnerCourseSummarySchema` (`course.ts:113`) | `index.ts:626`; `course.ts:205`; `fidelity/manifest.ts:15,514,515` | 3 files |
| `useCourseOutline` (`react/use-course-outline.ts:17`) | `runner/course-runner-page.tsx:33`; `outline/course-outline-page.tsx:32`; `index.ts:667` | 2 prod |
| `useAssignmentsForGroup` (`react/use-group-assignments.ts:40`) | `groups/forms/group-assignments-panel.tsx:66`; `index.ts:794` | 1 prod |
| `getGroupScanReportJson/Csv` (`endpoints/group-export.ts:73,89`) | `react/use-group-export.ts:58-59` → `groups/exports/group-exports-panel.tsx:47` | 1 prod chain |
| `packages/ui` exports named by plan | `Ring` (`index.ts:146`), `Tabs*` (`:114`), `Textarea` (`:124`), `Combobox` (`:34`), `StatusPill` (`:54`), `Skeleton` (`:117`), `EmptyState` (`:123`) — all present | — |
| `sweep-routes.json` | 33 rows; every id the plan cites exists (`681a4b63…c55b`, `…c605`, `…c574`, `681a4d96…`, `681a4e2c…`, `681a4f4d…`, `6a6ae3d7…`); no `/about`, `/progress`, `/account/reminders` rows yet (expected) | — |
| Locale gates named | `locale-completeness-gate.test.ts`, `courses-namespace-parity.test.ts`, `home-locale-parity.test.ts`, `groups-namespace-parity.test.ts`, `account-surfaces-locale-parity.test.ts`, `locale-completeness-baseline.json` — all exist under `apps/web/src/i18n/` | — |

API-side anchors checked (worktree `feat/sector-api`): `learners.route.ts:9-21` (7 routes, all `authUser`) ✓; `learners.process.topic.ts:117-136` `determineTopicStatus`, `:193-197` `wasCompleted`, `:219,238` `lastAccessedDates.push`, `:247` `save({session})` ✓; `user-course-progress.model.ts:112-160` `ContentItemSchema`, `:250` unique `{user,course}`, `:68,234` `lastItemAccessed` ✓; `group-assignment.controller.ts:673` `getUserDashboardAssignments`, `:768` `getGroupLeaderDashboardAssignments` (no `assertLeadsGroup`) ✓, `:846` `getGroupMemberAssignments` ✓; `group-assignment.model.ts:154` single `dueDate` index, no `reminderSentAt` ✓; `group-notification.model.ts:10-15` four scan enum values ✓; `serverless.yml:103-116` `dailyCertificateEntitlementReport` `cron(0 23 * * ? *)`, `enabled: false`, `maximumRetryAttempts: 0` ✓; `scripts/db/localScheduler.ts:18` `setInterval` ✓; `manager.controller.ts` `exportGroupCourseProgress` with per-id `assertLeadsGroup` ✓; `group-member.service.ts:305-307` `hasAdminFullAccess` bypass, `:328-332` `assertLeadsGroup` ✓ — note `leadsGroup` returns `true` unconditionally when `GROUP_LEADER_SCOPED_VISIBILITY` is false (`src/config/group-leader-scoped-visibility.ts:17`, currently `true`); the plan should name this flag since every leader-auth fix depends on it. `mail/index.ts:725-754` `assignmentNotification` ✓; `tests/mocks/mail.mock.ts`, `mail-hoisted.mock.ts` ✓; `tests/scripts/migrate-repair-progress-status.test.ts` ✓; `scripts/db/backfill-pathology-scan-type.ts` ✓; `secrets.ts:109` `LOCAL_DEV_SECRETS`, no `VIMEO` key ✓; `package.json` has `demo:phi-crop`, `mcp:dev`, `scheduler:local`, `test:functional` ✓; `src/app/v2/course/course.schema.ts:82` `updateCourseByIdSchema` ✓.

Console anchors: `duration-input.tsx` exists; `course-builder.tsx:1044,1188,1199` `'(0m0s)'` ✓; `course-edit.tsx:370-395` Content + Duration controls ✓.

Plan-internal references: `reports/brainstorm-260914-1456-…` and `reports/port-leftovers-audit-260914-1403-…` exist under `plans/reports/` (linked as `../reports/…` from the plan dir) ✓.

Claims not verifiable read-only and not asserted here: mirror counts (465 ids, 869 topics, 2,442 overdue), "872 web tests", "925k usercourseactivities".

---

Status: DONE_WITH_CONCERNS
Summary: Every user-chosen feature is buildable, but Phases 4 and 8 duplicate three existing leader/learner routes and one report pipeline, Phase 5's player hoist is not implementable as written, and Phases 2/3 edit the same outline contract twice; applying Findings 1–5 and 7–9 removes ~8–10 of 44 days with no success criterion lost.
Concerns/Blockers: Findings 1, 3 and 4 need a planner decision before Release 1/2 work starts; Finding 5 needs a product answer on per-group vs per-account opt-out given the cross-group digest.
