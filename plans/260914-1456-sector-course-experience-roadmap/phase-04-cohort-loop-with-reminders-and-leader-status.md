---
phase: 4
title: "Cohort loop with reminders and leader status"
status: pending
priority: P1
effort: "7 days"
dependencies: [3]
---

# Phase 4: Cohort loop with reminders and leader status

## Overview

<!-- Red team 2026-09-14: F2 + F5 + F6 + F7 + F10 + F11 — delta: the reminder job is rebuilt
     (per-stage ceilings, drain-with-cursor, claim-then-send, explicit Lambda sizing, age
     cutoff, List-Unsubscribe); the IDOR fix becomes a sweep of all eight read handlers, not
     two; the opt-out collapses to one per-user boolean on the existing account profile; the
     Assignments tab keeps its current data source and derives counts client-side; and the
     `administrator` claim is corrected — this phase MOVES administrator from 200 to 403 on
     these routes. Effort 6d → 7d. -->

**2,435 of 4,595 dated group assignments are overdue and still open**, across **843 distinct
learners** (mirror, 14 Sep 2026: `dueDate < now`, `status ∈ {active, in_progress}`,
`deletedAt: null`; max 14 rows for one learner). 496 of those rows are due in **2025**, the
oldest 2025-10-08; 2,013 of 2,435 are `module`-level. There is no reminder job — only a
one-shot "you have been assigned" email at creation (`group-assignment.service.ts:1351`,
template `src/lib/mail/templates/assignment-notification.eta`).

This phase closes the loop: a scheduled reminder before the date, a digest after it, and a
leader view that answers "who has not started" without an export.

**Findings that shape the work**, all verified:

1. **The scheduling convention is Lambda, not cron.** Recurring jobs are handlers under
   `src/workers/` wired to EventBridge in `serverless.yml` — `dailyCertificateEntitlementReport`,
   `cron(0 23 * * ? *)`, `serverless.yml:103-116`, `enabled: false` as the documented pause.
   Locally a `setInterval` shim (`scripts/db/localScheduler.ts:18`). The Agenda queue
   (`src/lib/queue/`) runs only inside the long-lived worker container
   (`src/queue-worker.ts:46`) and is not needed here.
2. **Email defaults to SendGrid, not SMTP.** <!-- Red team 2026-09-14: F2 -->
   `sendEmail` resolves the provider from the `EMAIL_PROVIDER` secret, defaulting to
   `'sendgrid'` (`src/lib/mail/index.ts:136`; `secrets.ts:38`). SMTP is one of three
   providers (`:104`), used locally against Mailpit. The brainstorm's "existing SMTP path" is
   a misnomer. `sendEmail` returns `null` on failure and never throws.
3. **Eight read handlers in `group-assignment.controller.ts` are unscoped, not two.**
   See step 1.
4. **`assertLeadsGroup` is a no-op behind one constant.** `leadsGroup` returns `true`
   unconditionally when `GROUP_LEADER_SCOPED_VISIBILITY` is `false`
   (`group-member.service.ts:308-310`); the flag is a hard-coded `export const … = true`
   (`src/config/group-leader-scoped-visibility.ts:17`). <!-- Red team 2026-09-14: F6 -->
5. **This phase regresses `administrator`, and that must be stated rather than denied.**
   See Security. <!-- Red team 2026-09-14: F7 -->

## Requirements

**Functional**

1. A daily job sends a **T-3 reminder**: one email per learner per assignment due in three
   days and still open.
2. An **overdue digest**: one email per learner listing their past-due open assignments
   **within an age window** — rows older than a configurable horizon (default 90 days) are
   excluded from learner email and left to the leader report.
   <!-- Red team 2026-09-14: F2 -->
3. Both stages are **exactly-once per learner per stage per day**, enforced by claiming
   before sending.
4. The job **drains**: a per-stage batch cap with a persisted cursor, so a day-one backlog of
   843 learners clears over several days rather than refusing forever or blasting at once.
5. Deep links point at Sector paths.
6. A leader sees **not started / in progress / overdue / completed** per assignment, with
   counts, on the existing group Assignments tab.
7. A learner can opt out of assignment reminders — **one switch, account-wide**.
8. Every learner email carries a one-click, no-login `List-Unsubscribe` header.
9. The first production run is behind a switch flippable without a code change.

**Non-functional**

10. `assertLeadsGroup` is the authorisation for every group-keyed read; `req.user.id` for
    every user-keyed read. `administrator` is **not** given a new bypass.
11. The job must fit its Lambda budget and stop cleanly when it runs out of time.
12. Parse-not-cast for every new response shape; a fidelity decision for each.

## Architecture

```
EventBridge cron(0 13 * * ? *) ─► src/workers/send-assignment-reminders.ts
   serverless.yml block: timeout 600, memorySize 512,                 ← copied from
   reservedConcurrency 1, maximumRetryAttempts 0, enabled false         :103-116
      │
      ├─ STAGE T-3   cap 200/run   cursor: last dueDate+_id processed
      ├─ STAGE OVERDUE cap 200/run cursor: oldest-dueDate-first, floor = now − 90d
      │     (separate caps so the backlog cannot starve T-3)
      │
      ├─ filter: users.assignmentRemindersOptOut === true            ← ONE boolean
      │
      ├─ CLAIM  findOneAndUpdate({ user, stage, dateKey }, {$setOnInsert}, {upsert, new:false})
      │           null previous doc ⇒ we own this send        ← at-most-once
      ▼
   mail.assignmentReminder(...) / mail.assignmentOverdueDigest(...)
   sendEmail({ to, subject, html, headers: { 'List-Unsubscribe': … } })   ← headers is NEW
      │           returns null on failure ⇒ release the claim
      ├─ getRemainingTimeInMillis() < 60s ⇒ persist cursor, log `remaining`, exit 0
      ▼
   $set reminderSentAt | overdueDigestSentAt on the rows covered

──────────────────────────────────────────────────────────────────────────────
LEADER TAB — unchanged data source
   group-assignments-panel.tsx → useAssignmentsForGroup(groupId)
        GET /api/group-assignment/group/:groupId   (already membership-checked)
        rows already carry `status` + `dueDate`  →  assignmentLifecycle(row, now)
        counts computed client-side from the same rows
```

**Who owns what**

- **API**: the job, two templates, the timestamp fields, the claim collection, the
  `List-Unsubscribe` plumbing, the one-boolean opt-out, and the authorisation sweep.
- **api-client**: nothing new for the tab (it already has what it needs); the profile
  payload gains one boolean.
- **web**: the four-value lifecycle pill and counts, derived from rows already fetched; one
  switch row on the existing account notifications card.

**The Assignments tab keeps its current route.** <!-- Red team 2026-09-14: F11 -->
An earlier draft re-pointed the panel at `GET /api/group-assignment/dashboard/group-leader`
and added a schema, endpoint, hook and two fidelity entries — to derive a status that is a
pure function of `status` and `dueDate`, both already on the rows
`useAssignmentsForGroup` returns (`schemas/group-assignment.ts:112-113`). Worse, the two
routes have different auth models (`getAssignmentsByGroupId` checks active membership; the
dashboard route, after step 1, checks leadership), so a learner-member would get a list that
loads and counts that 403 — the mixed-state failure `my-learning-panel.tsx:28-30` warns
about. The panel stays on `useAssignmentsForGroup`. The dashboard route still gets its
authorisation fix in step 1; it is just not adopted as a data source.

**The opt-out is one boolean on the user.** <!-- Red team 2026-09-14: F10 -->
An earlier draft created a `(user, group)` collection, three route files, a client
schema/endpoint/hook and a new account surface. But Requirement 2 makes the digest **one
email per learner across all groups**, which a per-group opt-out cannot honour — a learner
opted out of group A still receives a digest listing group B, so the email still arrives and
the support ticket reads "I turned it off and still get them". One boolean,
`assignmentRemindersOptOut`, written through the existing `PUT /api/account/profile`
(`manifest.ts:587`) and rendered as one more row in the existing
`apps/web/src/features/account/notification-preferences.tsx` card. **Per-group granularity is
an open product question**, not a default — if it is wanted, someone must say how the
cross-group digest honours it.

**One link builder, changed once.** <!-- Red team 2026-09-14: F11 -->
`getAssignmentRouteComposition` (`group-assignment.service.ts:1233-1263`) returns
`my-courses/...` fragments that the creation email prefixes with `/dashboard/` (`:1345-1346`).
Rather than adding a second builder beside it, **change it** to emit Sector paths
(`/learn/courses/:courseId[/:itemId]`, matching `courses-links.ts:19-21`). The legacy map
(`legacy-route-map.ts:224-266`) guarantees old links in already-sent mail still resolve, so
this is safe — and it fixes the creation email's redirect hop at the same time.

## Related Code Files

**Create**

- API repo: `src/workers/send-assignment-reminders.ts` — read
  `src/workers/daily-certificate-entitlement-report.ts:8-29` first for the debug-flag and
  recipient-secret conventions.
- API repo: `src/database/group-assignment/assignment-reminder.query.ts` — the two staged
  queries, the cursor, and the per-learner grouping.
- API repo: `src/database/assignment-reminder-claim/assignment-reminder-claim.model.ts` —
  `{ user, stage, dateKey }` unique; TTL index on `createdAt` (e.g. 30 days).
  <!-- Red team 2026-09-14: F2 -->
- API repo: `src/lib/mail/templates/assignment-reminder.eta`
- API repo: `src/lib/mail/templates/assignment-overdue-digest.eta`
- API repo: `src/app/assignment-reminder/unsubscribe.controller.ts` — the token-verified,
  no-login `POST /api/assignment-reminders/unsubscribe`.
- API repo: `tests/functional/group-assignment/read-handler-authorization.test.ts`
- API repo: `tests/functional/group-assignment/assignment-reminders.test.ts`
- `apps/web/src/features/groups/forms/assignment-status-model.ts` + `.test.ts`

**Modify**

- API repo: `src/app/group-assignment/group-assignment.controller.ts` — **eight handlers**,
  step 1.
- API repo: `src/database/group-assignment/group-assignment.model.ts` — `reminderSentAt`,
  `overdueDigestSentAt`; a compound index `{ dueDate: 1, status: 1, deletedAt: 1 }`. Existing
  indexes are `{group,status}`, `{user,status}`, `{dueDate}` — there is **no single-field
  `status` index** (`:149-169`). <!-- Red team 2026-09-14: fact-check correction -->
- API repo: `src/database/group-assignment/group-assignment.service.ts:1233-1263` —
  `getAssignmentRouteComposition` emits Sector paths; `:1345-1346` drops the `/dashboard/`
  prefix.
- API repo: `src/lib/mail/index.ts` — **`SendEmailOptions` (`:10-21`) gains `headers`**, and
  all three provider senders forward it (`:35`, `:77`, `:104`); two builders beside
  `assignmentNotification` (`:725-754`). <!-- Red team 2026-09-14: F2 -->
- API repo: `src/database/user/user.model.ts` — `assignmentRemindersOptOut: Boolean, default false`.
- API repo: the account profile read/write (`PUT /api/account/profile`) — accept and serve it.
- API repo: `serverless.yml` — the new function block after `:103-116`.
- API repo: `package.json` — `"scheduler:reminders"` local shim.
- `packages/api-client/src/schemas/account.ts` + the profile payload schema — one boolean.
- `packages/api-client/src/fidelity/manifest.ts` — reword the `users` entry to name the new
  field; `updateProfilePayloadSchema` is already excused at `:587`.
- `apps/web/src/features/account/notification-preferences.tsx` — one switch row.
- `apps/web/src/features/groups/forms/group-assignments-panel.tsx` — lifecycle pill + counts,
  from the rows it already has.
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`,
  `groups-namespace-parity.test.ts`, `account-surfaces-locale-parity.test.ts`
- `scripts/check/sweep-routes.json`

**Delete** — nothing.

## Implementation Steps

1. **Authorisation sweep — the standalone first commit.** <!-- Red team 2026-09-14: F5 -->
   Every handler in `group-assignment.controller.ts` sits behind
   `withPermission([READ_GROUP_ASSIGNMENT])` (`group-assignment.route.ts:24-41`), and that
   permission is held by `subscriber` and `scan reviewer` as well as `group leader`
   (`endpoints/group-assignment.ts:24-31`). Only two handlers check anything about the
   caller's relationship to the group. Fix **all eight reads**, one test each, red first, in
   `tests/functional/group-assignment/read-handler-authorization.test.ts`:

   | Handler | Line | Key | Rule |
   | --- | --- | --- | --- |
   | `getGroupLearners` | `:66` | group | `assertLeadsGroup` |
   | `getGroupCourses` | `:134` | group | `assertLeadsGroup` |
   | `getCourseDetails` | `:171` | course | decide and **record**: it exposes course structure to any enrolled learner — acceptable or not |
   | `getGroupAssignments` | `:407` | group/user/none | `assertLeadsGroup` with `groupId`; `req.user.id` with `userId`; **400 with neither** unless `admin:full-access` |
   | `getGroupAssignmentById` | `:452` | id | load, then assert caller leads `assignment.group` **or** is `assignment.user` |
   | `getUserDashboardAssignments` | `:673` | user | default to `req.user.id`; a foreign id requires leading a group the target belongs to |
   | `getGroupLeaderDashboardAssignments` | `:768` | group | `assertLeadsGroup` |
   | `getGroupMemberAssignments` | `:846` | user | same as `:673` — the existing `query.userId \|\| req.user?.id` fallback still accepts a foreign id |

   Land this before anything else in the phase.

2. **Name the kill switch.** <!-- Red team 2026-09-14: F6 -->
   Every one of those `assertLeadsGroup` calls — and the 12 existing sites in
   `manager.controller.ts` — is a no-op when `GROUP_LEADER_SCOPED_VISIBILITY` is `false`
   (`src/config/group-leader-scoped-visibility.ts:17`, currently `true`). Add a startup
   assertion or a test that fails the build when it is not `true`, so flipping it is a
   deliberate act with a visible cost. Say in the phase report that flipping it restores
   **global** visibility across all these routes.

3. **Model fields + claim collection.** `reminderSentAt`, `overdueDigestSentAt` (`null`
   defaults) on the assignment. A separate `assignmentreminderclaims` collection keyed
   `(user, stage, dateKey)` unique, with a TTL. The stamp on the row is bookkeeping; the
   **claim is the idempotency control**, because it is taken before the send.

4. **One boolean opt-out.** `users.assignmentRemindersOptOut`, served and written through the
   existing profile route. One switch appended to the existing account notifications card.

5. **The queries.** Both filter `deletedAt: null`,
   `status: { $in: ['active','in_progress'] }`. Use `dayjs` (already a dependency).
   - T-3: `dueDate` within `[startOfDay(T+3), endOfDay(T+3)]`, `reminderSentAt: null`.
     All 4,595 `dueDate`s sit at hour 0 UTC, so a UTC day window is exact.
   - Overdue: `dueDate` in `(now − 90d, startOfDay(today))`, `overdueDigestSentAt: null`,
     grouped by user, **oldest first**, so the backlog drains deterministically.
   - Rows older than the horizon are **left alone** and surfaced to the leader report
     instead; a one-time report of how many there are (496 in 2025 today) goes to ops so
     they can cancel them.

6. **Drain, do not refuse.** <!-- Red team 2026-09-14: F2 -->
   Per-stage cap (default 200 learners each). Persist a cursor so the next run resumes where
   this one stopped. Log `sent`, `claimed`, `remaining`. There is **no** all-or-nothing
   ceiling: the earlier design's 500 was below the day-one population of 843, stamped nothing
   on breach, and would therefore have refused forever while reporting `exit 0`.

7. **Claim, then send, then stamp.** For each learner-stage: `findOneAndUpdate` the claim
   with `upsert: true, new: false`; a non-null previous document means someone already sent,
   so skip. Then `sendEmail`. If it returns `null` (its documented failure mode), **delete
   the claim** so tomorrow retries. Then stamp the rows. At-most-once is the right default
   for email; `maximumRetryAttempts: 0` controls Lambda's error retry, not the daily cron
   re-invoking over unstamped rows, which is what the earlier draft mistook it for.

8. **Size the Lambda explicitly.** <!-- Red team 2026-09-14: F2 -->
   `provider.timeout` is **28 s** (`serverless.yml:16`) and every existing worker overrides
   it (`:54`, `:80`, `:93`, `:109`). `sendEmail` is not cheap — two `secrets.get` round-trips
   and an `eta.renderAsync` before the provider call (`src/lib/mail/index.ts:135-142`). Copy
   the precedent block: `timeout: 600`, `memorySize: 512`, `reservedConcurrency: 1`,
   `maximumRetryAttempts: 0`, `enabled: false`. Check
   `context.getRemainingTimeInMillis()` between sends and stop cleanly below 60 s.

9. **`List-Unsubscribe`.** <!-- Red team 2026-09-14: F2 -->
   Extend `SendEmailOptions` with `headers?: Record<string, string>` and forward it in all
   three senders. Set
   `List-Unsubscribe: <https://…/api/assignment-reminders/unsubscribe?token=…>, <mailto:…>`
   and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, backed by an HMAC-signed,
   expiring token that sets the user boolean **without a login**. Gmail/Yahoo bulk-sender
   rules and GDPR Art. 21 both expect a no-login path; a link to a login-gated preference
   page is not one.

10. **Sector deep links.** Change `getAssignmentRouteComposition` to emit
    `/learn/courses/${courseId}` for a course assignment and
    `/learn/courses/${courseId}/${contentId}` for the other three. Drop the `/dashboard/`
    prefix at `:1345-1346`. Both new templates and the existing creation email use it.

11. **Templates.** Both extend `_layout.eta`, following `assignment-notification.eta`. The
    reminder names one assignment; the digest lists rows with due dates and a single
    "see all" link to `/learn/courses`. Both carry the unsubscribe line in the body **and**
    the header.

12. **Leader status, from the rows already fetched.** `assignment-status-model.ts`:
    `assignmentLifecycle(row, now)` → `'completed'` if `status === 'completed'`; else
    `'overdue'` if `dueDate` exists and is past; else `'in_progress'` if
    `status === 'in_progress'`; else `'not_started'`. Render as a `StatusPill` and compute
    the four counts from the same array. **Extend** `assignmentStatusTone`
    (`group-assignments-panel.tsx:40-51`) with `overdue → crit`; do not fork it. Counts are
    for the rows currently loaded — if group-wide totals are required, add `analytics` as an
    optional include on the existing group-scoped read rather than switching routes.

## Tests / validation

**Unit**

- `read-handler-authorization.test.ts` — one case per handler in the step-1 table, each red
  before its fix, plus one asserting `administrator` (holding `full-access` but not
  `admin:full-access`) now gets **403** on the group-keyed reads. That assertion pins the
  behaviour change rather than hiding it. <!-- Red team 2026-09-14: F7 -->
- `assignment-reminders.test.ts`, against the test database (`pnpm test:db:up`):
  - an assignment due in exactly 3 days and open produces one email + a claim + a stamp
  - a second run the same day produces **zero** (claim collision)
  - due in 2 or 4 days → nothing; `completed`/`cancelled` → nothing
  - a learner with 7 overdue rows receives **one** digest listing 7
  - a row `dueDate` older than 90 days is **excluded** from the digest
  - 900 eligible learners → 200 sent, cursor persisted, `remaining: 700`; the next run sends
    the next 200 and none of the first
  - `sendEmail` returning `null` **deletes the claim** and leaves `reminderSentAt` null
  - a learner with `assignmentRemindersOptOut: true` receives nothing
  - `getRemainingTimeInMillis()` below the floor stops cleanly with a persisted cursor
  - the unsubscribe token sets the boolean with no session, and a tampered token is rejected
  Use `tests/mocks/mail.mock.ts` / `mail-hoisted.mock.ts`.
- `assignment-status-model.test.ts` — the four lifecycle cases, plus a `null` `dueDate`
  (never `overdue`) and a `completed` row with a past `dueDate` (`completed`).
- **Existing, untouched**: `destructive-actions.test.ts` (14 cases),
  `groups-namespace-parity.test.ts`.

**Fidelity**

- No new response schema for the tab — it keeps `groupAssignmentSchema`, already replayed
  (`routes.fidelity.test.ts:11`). The **profile** schema gains one boolean; the existing
  `users` replay entry proves it parses as `false` on every historical document. Reword that
  entry. `updateProfilePayloadSchema` is already in `NOT_REPLAYED` (`manifest.ts:587`).
  `manifest.test.ts` fails the ordinary unit run if anything is left undecided.
- Route replay with `SECTOR_MIRROR_JWT_SECRET` set and `:5002` up; a run printing
  `route replay skipped` (`routes.fidelity.test.ts:65-70`) proves nothing.

**Browser** — `node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>`:

```json
{ "path": "/administer/groups/6a6ae3d759ab84398c7cee4f/assignments",
  "role": "reviewer", "needs": "Assignments|Overdue|Not started" }
{ "path": "/profile", "role": "learner", "needs": "reminder" }
```

The group row already exists and opens 1,367 assignments, none course-level — the right
adversarial case for the pill. The opt-out lives on the **existing** `/profile` surface, so
there is no `/account/reminders` row. <!-- Red team 2026-09-14: F10 -->

Plus a **manual** email pass: run the handler locally with `EMAIL_PROVIDER=smtp` and Mailpit
on `:1025`, and read both rendered templates and their headers in the Mailpit UI. An `.eta`
template that throws renders an empty body, which no query-layer test catches.

## Success Criteria

- [ ] All eight read handlers are scoped, each with a test that was red first
- [ ] A non-member holder of `read:group-assignment` gets 403 from every group-keyed read
- [ ] `GROUP_LEADER_SCOPED_VISIBILITY` is named in the phase report and pinned by a build
      assertion
- [ ] 900 eligible learners drain at 200/run with no learner emailed twice
- [ ] A same-day re-run sends zero
- [ ] A failed send leaves no claim and no stamp
- [ ] No digest lists an assignment older than the horizon
- [ ] Every learner email carries `List-Unsubscribe` and a working no-login unsubscribe
- [ ] One account-wide switch stops all reminder mail, and leaves the leader's
      scan-notification settings untouched in both directions
- [ ] Every link in both emails and in the creation email opens a `/learn/...` URL with no
      redirect hop
- [ ] The Assignments tab shows the four-value pill and counts **without** a new endpoint
- [ ] Both templates render in Mailpit with populated bodies and headers
- [ ] Cold-load sweep 100% healthy

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Job refuses forever (old ceiling design) | **Was certain** | High | Drain with per-stage caps and a cursor; a test asserts 900 → 200 + 700 remaining |
| 843 emails in one invocation | **Was high** | **Critical** | Per-stage cap of 200; `reservedConcurrency: 1`; `enabled: false` on deploy |
| Duplicate sends after a timeout | High under send-then-stamp | High | Claim-then-send; explicit `timeout: 600`; `getRemainingTimeInMillis()` guard |
| Stale 2025 deadlines in a digest | **Was certain** (496 rows) | High — unsubscribe driver | 90-day horizon; older rows reported to ops, not emailed |
| Sending reputation damage | Medium | High — shares the domain with password-reset OTPs | `List-Unsubscribe` one-click; drain rather than blast; copy sign-off gate |
| Reminder copy not signed off | High | Medium | Ships dark; the switch is the gate |
| Mixed-auth Assignments tab | **Was medium** | Medium | Tab keeps its single existing data source |
| `administrator` loses leader dashboards | **Certain** | Medium | Stated plainly, pinned by a test, flagged as the open product question |
| Phase 4 and Phase 5 conflict on shared files | Medium | Low | Both append to `sweep-routes.json` and the seven locale files. **Merge order: Phase 4 first, then Phase 5.** Phase 4 appends under `groups.*`/`account.*`, Phase 5 under `courses.*`. <!-- Red team 2026-09-14: folded correction --> |

## Security Considerations

- **This phase closes eight unscoped reads, not two.** Until step 1 lands, any signed-in
  subscriber can enumerate a group's learner roster with names and emails
  (`getGroupLearners`, `:66`), read any assignment by id (`:452`), or paginate **every**
  assignment in the product by calling `GET /api/group-assignment` with no filter (`:407`).
  Land step 1 as its own commit so it can be cherry-picked ahead of the feature work.
- **`administrator` moves from 200 to 403 on these routes, and this is a real behaviour
  change.** <!-- Red team 2026-09-14: F7 -->
  `withPermission` treats both `full-access` and `admin:full-access` as wildcards
  (`permission.middleware.ts:12`). In the mirror's roles, `administrator` holds
  `full-access`; only `Superadmin` holds `admin:full-access`. The two existing in-controller
  checks honour `full-access` (`:305`, `:696`), so `administrator` reads every group today.
  But `leadsGroup`'s only bypass is `hasAdminFullAccess`, which checks `admin:full-access`
  alone (`permission.util.ts:4-8`). Applying `assertLeadsGroup` therefore **removes**
  `administrator`'s access to groups it does not lead. Do not paper over this with an ad-hoc
  `full-access` bypass — that is precisely the "administrator widening" the plan says is out
  of scope. Make `:305` and `:696` agree with `leadsGroup` so the controller has one rule,
  state the change to the API team, and keep "should a non-leading administrator reach a
  group" as the open product question it is.
- **`assertLeadsGroup` is one constant away from a no-op.** `GROUP_LEADER_SCOPED_VISIBILITY`
  (`src/config/group-leader-scoped-visibility.ts:17`) makes `leadsGroup` return `true`
  unconditionally when false. Every fix in this phase, and the 12 existing sites in
  `manager.controller.ts`, depend on it. Tests run with it `true`; add a build-time assertion
  so it cannot be flipped silently during an incident.
- The opt-out and the unsubscribe route derive the user from `req.user.id` or from a signed
  token — never from a client-supplied `userId`.
- The unsubscribe token must be HMAC-signed, scoped to one user and one purpose, and
  expiring. It grants exactly one state change (set the boolean) and must not be usable to
  read anything.
- Reminder emails carry a learner's own name, group and assignment titles to their own
  address. No leader is copied. The operator summary carries **counts only**.
- Eta's `<%= %>` escapes by default — do not reach for `<%~ %>` for an author-supplied course
  or group title.
- The job stamps rows, so it is a write path: staging or the local mirror-backed database
  only, never production Atlas outside a deployed Lambda.
