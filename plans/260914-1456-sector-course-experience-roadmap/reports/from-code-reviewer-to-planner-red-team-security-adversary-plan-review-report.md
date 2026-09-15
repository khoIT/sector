# Red-team plan review — Security Adversary + Fact Checker

Plan: `plans/260914-1456-sector-course-experience-roadmap/` (plan.md + phases 1–8)
Reviewed: 2026-09-14. Codebases: `scanvault` @ `feat/sector`; API worktree @ `feat/sector-api`; mirror `gusi_prod_mirror` (shape reads only).
Method: every cited path/line/symbol grepped; behavioural claims read against the handler code, not the plan text.

---

## Finding 1: Video completion is client-asserted, the plan keeps it that way, and then builds a compliance report and a CME block on top of it

- **Severity:** Critical
- **Location:** Phase 2, "Architecture — Who owns what" and step 7 ("The completion rule … is **unchanged**"); consumed by Phase 4 step 10, Phase 7 step 9, Phase 8 steps 2–3
- **Flaw:** The plan says "browser measures, server rules" and cites `schemas/course-progress.ts:28-36` ("the client only reports what happened, never what it thinks the result should be"). The server does not rule. `trackLearnersCourseProgressSchema` accepts two free booleans, `hasVideo` and `videoCompleted` (`learners.schema.ts:44-49`), and `determineTopicStatus` returns `COMPLETED` whenever `videoCompleted` is truthy *or* `hasVideo` is falsy (`learners.process.topic.ts:132-136`). `hasVideo` itself is derived in the browser from the HTML (`topic-view.tsx:33`). Moving the 80% detection into the client changes nothing about trust: the server still accepts whatever the client claims. Phase 2's own text concedes the server "has no idea how long a video is at track time" — but Phase 1 gives it `v2topicmedia.durationSeconds` and Phase 2 stores `videoPositionSeconds`, so the server *will* have both inputs and the plan declines to use them.
- **Failure scenario:** Learner runs `for id in $(outline items): POST /api/v2/learners/courses/:courseId/track {contentType:'topic', contentId:id, hasVideo:false}` — every video topic completes, `progress` hits 100, `status` becomes `completed`, `updateParentLessonIfComplete` cascades. This feeds Phase 4's leader status pill, Phase 8's "compliance-adjacent" roster + CSV, Phase 7's CME block, the certificate pipeline (2,860 completers already), and the four export workbooks. Nothing in Phases 1–8 detects it; the regression gate only counts that completions do not *decrease*.
- **Evidence:** `learners.schema.ts:39-50` (`hasVideo: z.boolean().optional(), videoCompleted: z.boolean().optional()`); `learners.process.topic.ts:117-136` (`if (hasVideo && !videoCompleted) return IN_PROGRESS; return COMPLETED`); `learners.process.topic.ts:193-197` (`wasCompleted` short-circuit — forward-only, so a forged completion is permanent); plan Phase 2 step 7: "`determineTopicStatus` … is **unchanged**: it still reads `videoCompleted`. What changes is *when the client sends it*."
- **Suggested fix:** Add a server-owned high-water mark. In the position helper, `$max` a separate `items.$.maxPositionSeconds` (the plan's "no `$max`" rule applies to the resume pointer, not to a watch ceiling). In `determineTopicStatus`, when `v2topicmedia.durationSeconds` is known for the topic, require `maxPositionSeconds / durationSeconds >= 0.8` and ignore the client's `videoCompleted`; when duration is unknown, fall back to today's behaviour and log it. Derive `hasVideo` server-side from `v2topicmedia.vimeoVideoId !== null` rather than the body. Add a functional test: `videoCompleted:true` with `maxPositionSeconds` at 10% of a known duration → `in_progress`. Correct the api-client comment at `course-progress.ts:28-36`, which the plan quotes as if it were true.

---

## Finding 2: The "pair" of IDORs is at least seven unscoped handlers in one controller; the plan fixes two and delegates discovery to "a reviewer"

- **Severity:** High
- **Location:** Phase 4, step 1 and "Security Considerations"; Phase 8, Overview and "Security Considerations" ("this is the second of the pair, and a reviewer should check whether a third exists")
- **Flaw:** Every handler in `group-assignment.controller.ts` sits behind `withPermission([READ_GROUP_ASSIGNMENT])` (`group-assignment.route.ts:24-41`), and the mirror's `roles` collection confirms that permission is held by `subscriber`, `scan reviewer` and `group leader`. Only two handlers check the caller's relationship to the group (`:305-316` in `getAssignmentsByGroupId`, `:696-706` in `getUserDashboardAssignments` — and the latter only when `groupId` is supplied). The plan names `:768` and `:673`. Unscoped and unnamed: `getGroupLearners` (`:66`, returns the learner roster — populated `user` documents — for any `groupId`), `getGroupCourses` (`:134`), `getCourseDetails` (`:171`), `getGroupAssignments` (`:407`, `GET /api/group-assignment?userId=<any>` or `?groupId=<any>` or *no filter* → paginate all ~8,700 assignments), `getGroupAssignmentById` (`:452`, any assignment by id), `getGroupMemberAssignments` (`:846`, `query.userId || req.user?.id`, no membership check — the plan calls this "a fallback" and moves on). The api-client already documents three of these as "a server gap" (`endpoints/group-assignment.ts:20-22`).
- **Failure scenario:** Phase 4 lands `assertLeadsGroup` on `/dashboard/group-leader`. A subscriber calls `GET /api/group-assignment?groupId=<same id>` or `GET /api/group-assignment/learners?groupId=<same id>` and receives the identical roster with names and emails. The "live authorisation hole" the phase claims to close is still open through the door next to it, and Phase 8's report route sits in the same permission neighbourhood.
- **Evidence:** `group-assignment.route.ts:24-41`; `group-assignment.controller.ts:66-80, 134-145, 171-185, 407-450, 452-472, 846-870`; grep for `assertLeadsGroup|leadsGroup` in that controller returns nothing; mirror `db.roles.find({permissions:'read:group-assignment'})` → `subscriber, scan reviewer, group leader`; api-client `endpoints/group-assignment.ts:20-22`.
- **Suggested fix:** Phase 4 step 1 becomes "audit and scope every handler on `/api/group-assignment`", not two of them. For group-keyed reads (`learners`, `group-courses`, `group/:groupId`, `dashboard/group-leader`, `/?groupId=`): `assertLeadsGroup`. For user-keyed reads (`dashboard/user`, `member-assignments`, `/?userId=`): default to `req.user.id`; a foreign `userId` requires `leadsGroup` on a group the target belongs to. For `/:id`: load, then assert the caller leads `assignment.group` or is `assignment.user`. For `/` with no filter: 400 unless `admin:full-access`. One functional test file covering the whole router, red first. `getCourseDetails` (`:171`) exposes course structure to any enrolled learner — decide whether that is acceptable and record it.

---

## Finding 3: The reminder job's ceiling guarantees either a permanent no-op or a 843-recipient blast, with no compliant unsubscribe path

- **Severity:** High
- **Location:** Phase 4, step 8 ("ceiling check … default 500 … send **no** learner mail, exit 0"), step 7 (templates "carry a plain-language line about turning reminders off and a link to the preference surface"), Requirement 2 and 6
- **Flaw:** The mirror has 2,435 overdue open rows across **843 distinct learners** (max 14 rows for one learner). The default ceiling (500) is below the day-one population, and the ceiling is all-or-nothing, so the first run — and every run after it, since nothing gets stamped — sends nothing. The only way to start is to raise the ceiling above 843, at which point it sends 843 unsolicited digests in one invocation, about assignments with no lower bound on `dueDate` (some overdue since the WordPress era). On unsubscribe: `SendEmailOptions` has no `headers` field (`mail/index.ts:10-21`), so `List-Unsubscribe`/`List-Unsubscribe-Post` cannot be set; the plan's opt-out is a login-gated preference page reached by a link in the body. Gmail/Yahoo bulk-sender rules (one-click unsubscribe for >5k/day) and GDPR Art. 21 both expect a no-login path. The opt-out is also per-group only — a learner in six groups clicks six switches, and a learner removed from a group loses the row that would have suppressed their mail.
- **Failure scenario:** Operator flips `enabled: true`, sees "over ceiling, nothing sent" for a week, raises `ASSIGNMENT_REMINDER_MAX_EMAILS` to 1000, and 843 people — many of whom last touched the LMS years ago — receive a digest listing stale deadlines from the same `from:` domain the transactional mail uses. Complaint rate spikes, the shared sending reputation drops, password-reset OTPs start landing in spam.
- **Evidence:** Mirror: `db.groupassignments.distinct('user', {dueDate:{$lt:now},status:{$in:['active','in_progress']},deletedAt:null}).length` = 843; rows = 2,435. `src/lib/mail/index.ts:10-21` (`SendEmailOptions` — `to, replyTo, subject, html, attachments, provider`; no `headers`). Plan Phase 4 step 8: "Over the ceiling: log … send **no** learner mail, exit 0."
- **Suggested fix:** Replace the all-or-nothing ceiling with a per-run batch cap (e.g. 200), oldest-`dueDate`-first, stamp what was sent, and let the daily schedule drain the backlog over a week. Add a `dueDate` lower bound for the digest (e.g. `> now − 90d`) and a one-time report of what falls outside it for the content/ops team to cancel. Extend `SendEmailOptions` with `headers` and set `List-Unsubscribe: <https://…/api/assignment-reminder-preferences/unsubscribe?token=…>, <mailto:…>` plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, backed by an HMAC-signed, expiring token that does not require login. Add a global (all-groups) opt-out alongside the per-group one. Both go in the copy sign-off gate.

---

## Finding 4: Every `assertLeadsGroup` — existing and new — is a no-op behind a single compile-time constant the plan never mentions

- **Severity:** Medium
- **Location:** Phase 4 "Security Considerations" ("the codebase's own choke point"); Phase 8 Requirement 7 and "Security Considerations"; plan.md "Dependencies"
- **Flaw:** `leadsGroup` returns `true` unconditionally when `GROUP_LEADER_SCOPED_VISIBILITY` is `false` (`group-member.service.ts:308-310`), and `assertLeadsGroup` is a thin wrapper over it (`:327-331`). The flag is a hard-coded `export const … = true` in `src/config/group-leader-scoped-visibility.ts:17`, documented as a kill switch. The plan describes `assertLeadsGroup` as the authorisation for the Phase 4 IDOR fix, the Phase 8 report route, and the Phase 8 `getUserDashboardAssignments` fix, without noting that one line flips all of them — plus the 12 existing sites in `manager.controller.ts` — back to "any holder of the permission reads any group".
- **Failure scenario:** A production incident with the group hierarchy (the service already logs a `MAX_DESCENDANT_HOPS` cap breach at `:276`) leads someone to flip the kill switch to restore leader dashboards. The IDOR the plan "closed" on `dashboard/group-leader` reopens, and the new report route serves any group's roster with emails to any subscriber. No test in the plan would notice: the authorisation tests run with the constant at `true`.
- **Evidence:** `src/database/group-member/group-member.service.ts:304-331`; `src/config/group-leader-scoped-visibility.ts:17`; plan Phase 4: "The fix is `assertLeadsGroup` (`group-member.service.ts:328-332`), the codebase's own choke point for client-supplied group ids."
- **Suggested fix:** For the IDOR fixes specifically, do not depend on the flag: either call `leadsGroup` with the flag-bypass removed for these routes (a second, unconditional helper `requireLeadsGroup`), or add a startup assertion/test that fails the build when `GROUP_LEADER_SCOPED_VISIBILITY !== true`. Name the switch in both phases' security sections so the next operator knows what it disables.

---

## Finding 5: "administrator's access is unchanged" is false — the prescribed fix regresses `administrator`, and is inconsistent with the sibling checks in the same controller

- **Severity:** Medium
- **Location:** Phase 4 step 1 and Success Criteria ("`administrator`'s access to groups it does not lead is unchanged by this phase"); Phase 8 Requirement 7 and test plan ("a plain `administrator` who leads nothing is **unchanged**")
- **Flaw:** `withPermission` treats both `full-access` and `admin:full-access` as wildcards (`permission.middleware.ts:12`). In the mirror's roles, `administrator` holds `full-access`; only `Superadmin` holds `admin:full-access`. The two existing in-controller checks honour `full-access` (`group-assignment.controller.ts:305, :696`), so today `administrator` reads every group. `leadsGroup`'s only bypass is `hasAdminFullAccess`, which checks `admin:full-access` alone (`permission.util.ts:4-8`). Applying `assertLeadsGroup` at `:768` therefore takes `administrator` from 200 to 403 on the leader dashboard — the opposite of "unchanged" — and leaves the controller with two different definitions of "admin" ten lines apart. Phase 8's new report route inherits the same split.
- **Failure scenario:** Console/admin staff who use the leader dashboard for support lose it on deploy; the phase's own success criterion is unmeetable as written, so either the criterion is quietly dropped or someone adds a `full-access` bypass ad hoc, which is exactly the "administrator widening" the plan says is out of scope.
- **Evidence:** `src/middlewares/permission.middleware.ts:12` (`WILDCARD_PERMISSIONS = [FULL_ACCESS, ADMIN_FULL_ACCESS]`); `src/utils/permission.util.ts:4-8`; `group-assignment.controller.ts:305, :696`; mirror roles: `full-access → administrator, Superadmin`; `admin:full-access → Superadmin`.
- **Suggested fix:** State the actual behaviour change: "`administrator` (without `admin:full-access`) loses access to leader dashboards it does not lead". Either accept it (and say so to the API team as the decision, not an open question) or route the decision through the user. Whichever way, make `:305` and `:696` agree with `leadsGroup` so the controller has one rule.

---

## Finding 6: The position route has no server-side throttle, and a client-supplied `durationSeconds` is persisted and then trusted by three later phases

- **Severity:** Medium
- **Location:** Phase 2, step 3 (`'items.$.videoDurationSeconds': durationSeconds ?? undefined`), step 5 (body schema), step 6 (outline serves `videoDurationSeconds`); consumed by Phase 3 step 3 (`remainingSeconds`) and Phase 5 step 8 (`videoDurationSeconds - 5` resume rule)
- **Flaw:** The only rate limiters in the API are `authRateLimit`, `meRateLimit`, `deidUploadRateLimit` (`rate-limit.middleware.ts:16,37,51`). The plan's 12-second throttle is client code. The route's `updateOne` uses the positional `$` operator on an `items[]` array that reaches 185 entries, and also bumps three document-level fields on every call. Separately, the body's `durationSeconds` is written to the progress document and served back on the outline as `videoDurationSeconds`; Phase 2's clamp compares the position against `v2topicmedia.durationSeconds` but stores the *client's* duration, so the value downstream consumers read is the one the guard did not check. Two sources of truth for one number, with the untrusted one persisted.
- **Failure scenario:** (a) A script loops `PUT …/position` at 1,000 req/s against one enrolment: every call rewrites a positional element and `lastAccessedAt`/`lastItemAccessed` on a large document, `authUser` does a user lookup per request, and no middleware says no. (b) A learner sends `durationSeconds: 1` with `positionSeconds: 1`; Phase 3 shows "0 min left", Phase 5's resume rule (`position < duration − 5`) is nonsense. Self-inflicted, but it is a persisted untrusted value that the plan later reads as fact.
- **Evidence:** `src/middlewares/rate-limit.middleware.ts:16,37,51` (only three limiters, none on `/v2/learners`); `express-rate-limit` is already a dependency (`package.json:66`); plan Phase 2 step 3 and step 5 body: `{ positionSeconds: z.number().min(0), durationSeconds: z.number().min(0).optional() }`.
- **Suggested fix:** Drop `durationSeconds` from the body and from the progress document; the outline already joins `v2topicmedia` for the same number in the same phase. Add a per-user `rateLimit` (e.g. 30/min, keyed on `req.user.id`) to the position route using the existing middleware file. Validate `itemId` with `objectIdSchema` in the route schema (the `/track` body currently takes `contentId: z.string()` unvalidated — do not copy that).

---

## Finding 7: The report API ships `email` on every row regardless of the UI's "opt-in" column; CSV-injection guard is incomplete

- **Severity:** Medium
- **Location:** Phase 8, step 3 (row shape `user: { id, userName, email, firstName, lastName }`), "Security Considerations" ("do not include email addresses in the default column set unless a leader opts into them"; "prefix any such field with a single quote")
- **Flaw:** The opt-in is cosmetic. Step 3 returns `email` in every row of `GET /api/groups/manage/course-progress-report/:groupId`, so the PII crosses the wire and sits in React Query memory for the whole group whether or not the column is shown; the CSV is built "from the rows already in memory". With the ceiling at 1,000 and the largest active group at 719 members, that is up to 719 emails per request to any leader (or, via Finding 4/5, wider). The CSV-injection mitigation (`'` prefix on `=`, `+`, `-`, `@`) misses tab (`\t`) and carriage-return (`\r`) prefixes and does not address `|` (DDE in older Excel); RFC-4180 quoting plus prefix is the documented OWASP pattern, but the prefix set is short by two characters and the plan's unit tests do not enumerate it.
- **Failure scenario:** A leader opens the progress tab on a 719-member group; the browser holds 719 names+emails. They export CSV with the default columns and share it — the email column was "opt-in" but the data left the server on the first render. A learner whose `firstName` is `\t=HYPERLINK(...)` gets past the guard into a spreadsheet someone opens.
- **Evidence:** Plan Phase 8 step 3 row shape; mirror largest active groups: 719, 433, 350; `manager.controller.ts:796-812` (existing export already returns whole workbooks — the new route is a second, JSON copy of the same PII).
- **Suggested fix:** Make `email` a server-side `?include=email` projection, off by default, so the opt-in is enforced where the data lives. Extend the CSV prefix set to `= + - @ \t \r |` and put each in `rows-to-csv.test.ts`. Set `staleTime: 0, gcTime: 0` on the report query so it is not retained after the tab unmounts.

---

## Finding 8: Phase 1's backfill cannot reach staging or production if it follows its own precedent, and its extractor drops the unlisted-video hash on 272 of 869 embeds

- **Severity:** Medium
- **Location:** Phase 1, "Related Code Files" ("following the `scripts/db/*.ts` convention (`scripts/db/backfill-pathology-scan-type.ts` is the closest precedent"), step 6 ("the real write target is staging, then production via the normal deploy"), step 2 (regex `/player\.vimeo\.com\/video\/(\d+)/g`)
- **Flaw:** The precedent refuses any non-loopback host and any `mongodb.net` host by design (`backfill-pathology-scan-type.ts:19-22, 47-52` — "There is no 'against production' mode"). A backfill that follows it can never populate `v2topicmedia` on staging or production; a backfill that does not follow it is a write script that can be pointed at Atlas, which the repo's hard rule forbids without per-operation approval. The plan asserts both and resolves neither — "via the normal deploy" is not a mechanism (Lambdas run handlers, not `scripts/db`). Separately, 272 of the 869 embeds carry `?h=<hash>` (unlisted-video access hash); the regex captures only the numeric id. Vimeo's API answers `GET /videos/{id}` for the owner's own unlisted videos, but for anything on another account the hash-less call is a 404/403 that the plan would file under "content-team action", when the fix is `GET /videos/{id}:{hash}`.
- **Failure scenario:** Phase 3 ships against a mirror that has durations; staging and production have none because nobody could run the writer; every duration surface renders "absent" in production while the sweep on `:3101` is green. Or: someone bypasses the loopback guard to "just run it against staging", establishing a precedent for pointing `scripts/db` writers at Atlas.
- **Evidence:** `scripts/db/backfill-pathology-scan-type.ts:19-22, 47-52`; mirror `db.v2topics.countDocuments({content: /player\.vimeo\.com\/video\/\d+\?[^"']*h=/})` = 272; sample `player.vimeo.com/video/692459087?h=<hash>&badge=0…`.
- **Suggested fix:** Decide the production path explicitly: either an admin-only, `admin:full-access`-gated API route (`POST /api/v2/admin/topic-media/backfill`, deployed with the API and invoked once per environment) or a one-off Lambda in `serverless.yml` with `enabled: false`, both reusing `vimeo-client.ts`. Keep `scripts/db/backfill-topic-media.ts` loopback-only for the mirror rehearsal, as the precedent does. Capture `h` in the extractor and store it on the row; use `id:hash` for the API call when present.

---

## Fact-check notes (non-finding corrections)

- Phase 3 Requirement 9: baseline is **432** keys across 6 locales (`locale-completeness-baseline.json`), not "74 keys".
- Phase 2 Tests After: the topic sweep row `…/681a4e2c82414b2fcc5af816` already has `"needs": "Physics and Probes"` (`sweep-routes.json:140-142`); "the `needs` is new" is wrong.
- Phase 8 step 9: `group-learning-snapshot.tsx` is at `apps/web/src/features/home/`, not `features/groups/`.
- Phase 4 Related Code Files: no single-field `status` index exists on `groupassignments` — indexes are `{group, status}`, `{user, status}`, `{dueDate}` etc. (`group-assignment.model.ts:149-169`). The claim "single-field `dueDate` and `status` indexes exist" is half right.
- Phase 4 Risk table: "`controller:846-838` region" is a typo for `:768-838`.
- Phase 1: `course-builder.tsx:1610,1647` not confirmed (only `:1519` renders `item.duration`); `:1044/:1188/:1199` confirmed.
- Line drift ≤3 lines, all still correct: `serverless.yml` block is `:106-116` (`maximumRetryAttempts` at `:110`); `ga.service` `/dashboard/` prefix at `:1345`, `getAssignmentContentTitle` call at `:1342`; `apps/web/package.json` deps `@tanstack/react-table:17`, `@vimeo/player:18`, `nuqs:24`.

## Verification Results

- Claims checked: **~128** (≥15 per phase: file paths, symbols, line ranges, endpoints, config keys, role/permission assertions, mirror counts).
- Verified: **118** (including 9 with ≤3-line drift that still point at the claimed code).
- Failed: **6**
  1. Phase 2 "the server decides what [`videoCompleted`] means" / "browser measures, server rules" — server trusts the boolean unconditionally (`learners.process.topic.ts:132-136`).
  2. Phase 4/8 "`administrator`'s access … is unchanged" — `full-access` passes `withPermission` and `:305/:696` but not `leadsGroup`; the fix regresses administrator.
  3. Phase 3 "pre-existing 74 keys" baseline — 432.
  4. Phase 2 "the `needs` is new" on the topic sweep row — already present.
  5. Phase 8 `features/groups/group-learning-snapshot.tsx` — file is under `features/home/`.
  6. Phase 4 "single-field `dueDate` and `status` indexes exist" — no single-field `status` index.
- Unverified: **4** — "872 web tests"; `group-exports-panel.tsx` line content; `course-builder.tsx:1610,1647`; "`v2topics` documents carrying any duration field: 0" (taken from plan, not re-queried).

---

Status: DONE_WITH_CONCERNS
Summary: Plan is well-anchored in the codebase (118/128 citations hold) but its trust model is wrong at the root — completion is client-forgeable and the plan explicitly keeps it so while stacking a leader report, CME block and reminders on top; the IDOR remediation covers 2 of ≥7 unscoped handlers and depends on a kill switch it never names.
Concerns/Blockers: Findings 1–3 should block Phase 2 and Phase 4 as written; Finding 8 blocks Phase 1's production path until a deploy mechanism is chosen.
