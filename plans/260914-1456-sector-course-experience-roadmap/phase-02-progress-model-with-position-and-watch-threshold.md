---
phase: 2
title: "Progress model with position and watch threshold"
status: completed
priority: P1
effort: "8 days"
dependencies: [1]
---

# Phase 2: Progress model with position and watch threshold

## Overview

<!-- Red team 2026-09-14: F1 — delta: completion becomes SERVER-decided. The route stops
     trusting the client's `hasVideo`/`videoCompleted` booleans; the server derives both
     from a server-owned high-water mark and Phase 1's duration. Folds in F12 (one duration
     field, no client-supplied duration, rate limit), F13 (gates run against production
     read-only, not the 10-doc mirror), FMA F4/F5 (completion POST must be retried,
     tab-close uses sendBeacon, narrow `updateOne`), and the two whole-array writers that
     can wipe the new field. This phase now owns the whole outline wire. Effort 6d → 8d. -->

Three changes to the one model everything else in this plan stands on.

**The regression.** The dashboard completed a video topic at **80% watched**. Sector's port
completes it on the Vimeo `ended` event — `use-vimeo-watch-tracking.ts:32-33` fires
`onEnded`, `topic-view.tsx:45-47` turns that into `videoCompleted: true`, and
`determineTopicStatus` (`learners.process.topic.ts:117-136`) reads it. A learner who
watches 97% of a lecture and clicks away has completed nothing.

**The missing field.** There is no playback position anywhere. `ContentItemSchema`
(`user-course-progress.model.ts:112-160`) carries `status`, `timeSpent`, `quizAttempts` and
a `Mixed` `metadata` — no seconds-into-the-video.

**The trust bug, which the first draft of this phase preserved.**
<!-- Red team 2026-09-14: F1 -->
`trackLearnersCourseProgressSchema` accepts two free booleans (`learners.schema.ts:44-49`),
and `determineTopicStatus` returns `COMPLETED` whenever `videoCompleted` is truthy **or**
`hasVideo` is falsy (`learners.process.topic.ts:132-136`). `hasVideo` is itself derived in
the browser from the HTML (`topic-view.tsx:33`). So:

```
for id in outline items:
  POST /api/v2/learners/courses/:courseId/track { contentType:'topic', contentId:id, hasVideo:false }
```

completes every video topic, drives `progress` to 100, cascades through
`updateParentLessonIfComplete`, and is **permanent** because of the `wasCompleted`
short-circuit (`:193-197`). That forged state then feeds Phase 4's leader status, Phase 7's
CME block, Phase 8's compliance-adjacent roster and CSV, the certificate pipeline and four
export workbooks. Moving 80%-detection into the client changes nothing about trust.

**So the server decides.** Phase 1 gives the server `v2topicmedia.durationSeconds`; this
phase gives it a server-owned high-water mark. With both, the server computes completion
itself and ignores the client's claim. This is the change the api-client comment at
`schemas/course-progress.ts:28-36` already *describes* but which the code does not do — that
comment must be corrected too.

**Threshold: 80%**, for dashboard parity (LinkedIn uses 70%). Still an open dependency for a
clinical/CME view; one server constant.

**Open question this phase does NOT close.** <!-- Red team 2026-09-14: F1, residual -->
A high-water mark on *playhead position* is not *watched time*. A learner who drags the
scrubber to 81% completes the topic, and Phase 6 adds three first-class seek controls (cue
click, chapter rail, note timestamp) that make that easier. This matches dashboard parity —
`gusi_web_dashboard/.../topic-content-v3.tsx:128-132` fired on `percent >= 0.8` from
`timeupdate`, also a position check — but it should be named, not implied. Watched-segment
accumulation (merging `[from,to]` intervals) is a listed option for a follow-on, not assumed
here. Raise it with the clinical/CME owner alongside the 80-vs-70 decision.

This phase is **tests-first**. It changes the rule that decides whether an item is complete,
which decides `completedItems` → `progress` → course `status` → what My Courses, the
outline, the home dashboards and four export workbooks say.

## Requirements

**Functional**

1. A video topic completes at **≥80% of duration reached**, decided **server-side** from a
   server-owned high-water mark and `v2topicmedia.durationSeconds`.
2. The server derives `hasVideo` from `v2topicmedia.vimeoVideoId !== null`, not from the
   request body. <!-- Red team 2026-09-14: F1 -->
3. The client's `videoCompleted` is **ignored** whenever a duration is known for the topic.
   Where no duration is known, today's behaviour is the documented fallback and is logged.
4. Playback position is stored per learner per topic in whole seconds, and a separate
   monotonic high-water mark is stored alongside it.
5. Position writes are throttled (~12 s), and are **idempotent upserts** on
   `(learner, course, item)`. Nothing is appended.
6. The resume position accepts **backwards** writes (a rewind resumes where the learner
   rewound to); the high-water mark only ever increases (`$max`).
7. **Forward-only completion.** An item already `completed` stays `completed`.
8. The completion path is **retried by the client on failure** — no fire-once guard that
   swallows a 500. <!-- Red team 2026-09-14: F1/FMA F4 -->
9. Tab close issues a final position write via `navigator.sendBeacon` or
   `fetch(..., { keepalive: true })`. <!-- Red team 2026-09-14: FMA F5 -->

**Non-functional**

10. A position write must not re-save the whole progress document, and must be a narrow
    `updateOne` on `items.$[el]` with `arrayFilters`, touching exactly the paths it names.
11. **`durationSeconds` is never accepted from the client and never persisted from a request
    body.** One field, one name, one server source. <!-- Red team 2026-09-14: F12 -->
12. The position route is rate limited per user. `rate-limit.middleware.ts` currently has
    only `authRateLimit` (`:16`), `meRateLimit` (`:37`), `deidUploadRateLimit` (`:51`) — none
    on `/v2/learners`. <!-- Red team 2026-09-14: F12 -->
13. `itemId` is validated with `objectIdSchema`. (Do **not** copy `/track`'s
    `contentId: z.string()`.)
14. No unbounded array growth. `metadata.lastAccessedDates` is already pushed on every track
    call (`learners.process.topic.ts:219,238`); position must not repeat that shape.
15. Parse-not-cast: every new outline field gets a Zod schema and a fidelity decision.

## Architecture

```
Vimeo Player SDK ──timeupdate──► use-vimeo-watch-tracking.ts
  (@vimeo/player ^2.30.4)            │
                                     ├─ every ~12s / on seek / on pause ──┐
                                     ├─ pagehide, visibilitychange→hidden ┤ sendBeacon
                                     └─ ended ────────────────────────────┘
                                                     │
                          PUT /api/v2/learners/courses/:courseId/items/:itemId/position
                                       { positionSeconds }        ← NO duration from client
                                                     │  rateLimit(30/min, key req.user.id)
                                                     ▼
                    updateOne({user, course}, {
                      $set: { 'items.$[el].videoPositionSeconds': pos,   ← resume pointer
                              lastAccessedAt, lastItemAccessed },
                      $max: { 'items.$[el].maxPositionSeconds': pos }    ← watch ceiling
                    }, { arrayFilters: [{ 'el.itemId': itemId }] })
                                                     │
                                       server reads v2topicmedia.durationSeconds
                                                     │
                            maxPositionSeconds / durationSeconds >= 0.80 ?
                                                     │
                                        ── yes ──► status = COMPLETED (server-decided)
                                                     │
   GET .../outline ◄── buildCourseOutline ───────────┘
        item.positionSeconds, item.durationSeconds, item.imageUrl
```

**Who owns what**

| Side | Owns |
| --- | --- |
| **web** | Reporting *seconds observed*. It no longer asserts completion at all. Throttle, beacon, and retry on failure. |
| **api-client** | Zod for the position write and the three outline fields; fidelity decisions; barrel exports. |
| **API** | **The completion rule, the duration, and `hasVideo`.** All three are server-sourced. |

**This phase owns the whole outline wire.** <!-- Red team 2026-09-14: F12 / scope F6 -->
An earlier split had Phase 2 adding `videoDurationSeconds` and Phase 3 adding
`durationSeconds` — the same number from `v2topicmedia.durationSeconds` under two names, via
two passes over the same six files. Phase 2 now adds **`durationSeconds`, `positionSeconds`
and `imageUrl` once**, with one join, one schema edit, one manifest edit. The name
`videoDurationSeconds` does not exist. Phase 3 becomes render-only and touches no API or
api-client file.

**Why completion moves rather than the rule changing shape.** `determineTopicStatus` keeps
its signature but its inputs become server-derived: the controller resolves the topic's
`v2topicmedia` row and passes `hasVideo` and the watched ratio. The client's two booleans
stay in the request schema for one release (older clients) but are **not read** when a
duration is known, and are logged when they disagree with the server's verdict — that log is
how forged traffic becomes visible.

**Why a separate position route.** `/track` opens a Mongo transaction
(`learners.controller.ts:355`), walks the course-meta structure, re-derives lesson completion
and `save({session})`s the whole document (`learners.process.topic.ts:247`). At one call per
12 s that is a load test.

**A correction to the "no whole-document rewrite" claim.**
<!-- Red team 2026-09-14: FMA F4 -->
Mongoose deltas only modified paths — **except** when one `save()` both `$push`es a new item
and `$set`s a field on an existing one, which is the common first-visit-to-a-topic case
(`learners.process.topic.ts:35-45` touches the parent lesson, `:227-240` pushes the topic).
Mongoose cannot combine `$push` and `$set` on the same array path and `$set`s the entire
`items[]`. So the 185-entry rewrite is real on `/track` in that case, and the position
route's narrow `updateOne` is what avoids it — state it that way, not as a universal claim.

**Two whole-array writers can wipe the new fields.**
<!-- Red team 2026-09-14: F1 (scope audit F10) -->
`cleanseUserProgress` (`user-course-progress.service.ts:753-773`, `userProgress.items =
cleanedItems` then `.save()`, reachable via `POST /lms/create-user-progress`) and
`processCourseProgressRecomputeJobs` (`src/workers/process-course-progress-recompute-jobs.ts`)
both reassign `items[]`. Neither preserves a field it does not know about if it rebuilds
item objects from a literal. Both are in the Modify list and both get a test.

## Related Code Files

**Create**

- API repo: `src/app/lms/learners/helpers/learners.position.helper.ts` — `writeItemPosition`.
- API repo: `src/app/lms/learners/helpers/learners.completion.rule.ts` — the server-side
  watched-ratio rule, pure, so it is unit tested without Mongo.
  <!-- Red team 2026-09-14: F1 -->
- API repo: `tests/unit/app/lms/learners/helpers/learners.process.topic.test.ts`
- API repo: `tests/unit/app/lms/learners/helpers/learners.completion.rule.test.ts`
- API repo: `tests/unit/app/lms/learners/helpers/learners.position.helper.test.ts`
- API repo: `tests/functional/learners/track-video-position.test.ts`
- API repo: `tests/functional/learners/forged-completion.test.ts`
  <!-- Red team 2026-09-14: F1 -->
- API repo: `tests/functional/learners/position-survives-whole-array-writers.test.ts`
- `apps/web/src/features/courses/runner/watch-position.ts` + `.test.ts` — pure:
  `shouldWritePosition(...)`, `clampPosition(...)`. **No completion threshold in the
  browser.** <!-- Red team 2026-09-14: F1 -->

**Modify**

- API repo: `src/database/user-course-progress/user-course-progress.model.ts` —
  `ContentItemSchema` (`:112-160`) gains `videoPositionSeconds` and `maxPositionSeconds`,
  both `Number, default: null`. **No `videoDurationSeconds`** — duration lives in
  `v2topicmedia`. <!-- Red team 2026-09-14: F12 -->
- API repo: `src/database/user-course-progress/user-course-progress.service.ts:753-773`
  (`cleanseUserProgress`) — preserve the two new paths.
- API repo: `src/workers/process-course-progress-recompute-jobs.ts` — same.
- API repo: `src/app/lms/learners/learners.route.ts` — the position route, with the new
  limiter.
- API repo: `src/middlewares/rate-limit.middleware.ts` — `learnerWriteRateLimit`
  (30/min, keyed on `req.user.id`). `express-rate-limit` is already a dependency.
- API repo: `src/app/lms/learners/learners.controller.ts` — `trackLearnersItemPosition`; and
  `trackLearnersCourseProgress` (`:342`) now resolves `v2topicmedia` and ignores the body's
  booleans when a duration is known.
- API repo: `src/app/lms/learners/learners.schema.ts` — position schema with
  `objectIdSchema`; `/track`'s booleans marked deprecated in a comment.
- API repo: `src/app/lms/learners/helpers/learners.process.topic.ts` — `determineTopicStatus`
  (`:117-136`) takes the server-derived ratio.
- API repo: `src/app/lms/learners/helpers/learners.outline.helper.ts` — `OutlineItem`
  (`:75-91`) gains `positionSeconds`, `durationSeconds`, `imageUrl`; literal at `:214-227`.
- API repo: `src/app/lms/learners/helpers/learners.outlinecontent.helper.ts` — the
  `v2topicmedia` join (one query) and `buildOutlineProgressItems` (`:101-117`).
- API repo: `src/app/lms/learners/README.md`
- `packages/api-client/src/schemas/course-outline.ts` (`:69-92`) — three fields.
- `packages/api-client/src/schemas/course-progress.ts` — position payload; **correct the
  module doc comment at `:28-36`**, which currently claims the server derives completion.
- `packages/api-client/src/endpoints/course-progress.ts` — `trackItemPosition`.
- `packages/api-client/src/client.ts` — a `keepalive` option on the request layer.
  <!-- Red team 2026-09-14: FMA F5 -->
- `packages/api-client/src/fidelity/manifest.ts` (`:653-679`), `src/index.ts` (`:800`)
- `apps/web/src/features/courses/runner/use-vimeo-watch-tracking.ts`
- `apps/web/src/features/courses/runner/topic-view.tsx` (`:45-47`)
- `scripts/check/sweep-routes.json` — the topic row `…/681a4e2c82414b2fcc5af816` **already
  has** `"needs": "Physics and Probes"` (`:140-142`); no edit needed there.
  <!-- Red team 2026-09-14: fact-check correction -->

**Delete** — nothing.

## Implementation Steps

1. **Characterisation tests first** (see Tests Before), green against unmodified code.
2. **Model.** Add `videoPositionSeconds` and `maxPositionSeconds` to `ContentItemSchema`.
   No new index — `{ user: 1, course: 1 }` is already unique (`:250`).
3. **Position helper.** One narrow update:
   `updateOne({ user, course }, { $set: { 'items.$[el].videoPositionSeconds', lastAccessedAt,
   lastItemAccessed }, $max: { 'items.$[el].maxPositionSeconds' } }, { arrayFilters:
   [{ 'el.itemId': itemId }] })`. No transaction, no `.save()`, no `metadata` push.
   `matchedCount === 0` returns `204`.
4. **Clamp server-side.** `Math.max(0, Math.floor(seconds))`, and reject beyond
   `durationSeconds * 1.05` with a `400` when a duration is known. Duration comes from
   `v2topicmedia`, never the body.
5. **Completion rule** (`learners.completion.rule.ts`). Pure:
   `resolveTopicCompletion({ maxPositionSeconds, durationSeconds, legacyVideoCompleted })`
   → `{ status, decidedBy: 'ratio' | 'legacy' | 'no-video' }`. When `durationSeconds` is
   known, `maxPositionSeconds / durationSeconds >= 0.80` decides and the client's boolean is
   **ignored**; when unknown, fall back to the legacy boolean and set `decidedBy: 'legacy'`.
   Log at `warn` when `legacyVideoCompleted === true` but the ratio says otherwise — that is
   the forgery signal.
6. **Wire it into `/track`.** The controller resolves the topic's `v2topicmedia` row and
   passes `hasVideo` (`vimeoVideoId !== null`) and the stored `maxPositionSeconds` into
   `determineTopicStatus`. The body's `hasVideo`/`videoCompleted` are no longer read when a
   duration exists.
7. **Complete from the position route too.** A learner who crosses 80% while playing should
   not have to wait for an unmount ping. After the `$max`, if the new mark crosses the
   threshold and the item is not already `completed`, run the same completion path. **One
   server path decides completion**, reached from two routes. <!-- Red team 2026-09-14: F1 -->
8. **Serve it.** `fetchOutlineContent` (`:49`) adds the `v2topicmedia` query and returns a
   media map; `buildCourseOutline` puts `positionSeconds`, `durationSeconds` and `imageUrl`
   on the item. All three `null` for a lesson or a quiz.
9. **Rate limit.** `learnerWriteRateLimit` on the position route only.
10. **Client: report, do not assert.** `use-vimeo-watch-tracking.ts` subscribes to
    `timeupdate`, `pause`, `seeked`, `ended` and calls `onPosition(seconds)`. It sends **no**
    `videoCompleted` and **no** duration. `hasFiredRef` is deleted — there is nothing to fire
    once. <!-- Red team 2026-09-14: F1 -->
11. **Throttle** (`watch-position.ts`). Write when ≥12 s of wall clock have passed **or** the
    position moved >15 s (a seek). Pure and unit tested.
12. **Beacon on exit.** Add a `pagehide` / `visibilitychange → hidden` listener issuing the
    final write with `sendBeacon` (or `keepalive: true`). React does not unmount on tab
    close, and an unmount-cleanup `fetch` is cancellable — neither `keepalive` nor
    `sendBeacon` exists anywhere in the repo today. <!-- Red team 2026-09-14: FMA F5 -->
13. **Retry the write that matters.** If a position write that would cross the threshold
    fails, re-arm and retry on the next `timeupdate` rather than dropping it. Suppress
    position writes for ~2 s around a `/track` call so the two do not race the transaction
    (`learners.controller.ts:350,526-540` retries a WriteConflict 3× then throws).
    <!-- Red team 2026-09-14: FMA F4 -->
14. **api-client.** Position payload is `{ positionSeconds: z.number().min(0) }` — no
    duration. Add `keepalive` to the request layer. Correct the misleading module comment at
    `schemas/course-progress.ts:28-36`.

## Tests / validation

Tests-first, split across the four sections below. Index:

| What | Where | Named items |
| --- | --- | --- |
| **Unit** | Tests Before + After | `learners.process.topic.test.ts`, `learners.completion.rule.test.ts`, `learners.position.helper.test.ts`, `learners.outline.helper.test.ts` (exists), `watch-position.test.ts`, `course-outline-model.test.ts` (exists, 17 cases), `course-row-model.test.ts` (exists, 10 cases) |
| **Integration** | Tests After | `track-video-position.test.ts`, `forged-completion.test.ts`, `position-survives-whole-array-writers.test.ts` |
| **Fidelity** | Tests After | `manifest.test.ts` green; `courseOutlineItemSchema`/`courseOutlineSchema` `NOT_REPLAYED` entries (`manifest.ts:676-679`) reworded to name the three new fields; position payload added to `NOT_REPLAYED`; route replay via `routes.fidelity.test.ts` |
| **Browser** | Tests After | `cold-load-sweep.mjs`; the topic sweep row already carries its `needs`; plus the manual playback pass |
| **Gate** | Regression gate | Seven conditions, now measured against production read-only |

## Tests Before

Green **against unmodified code**. (The scope reviewer proposed dropping these on the
grounds that the server functions do not change — that was **rejected**: under F1 they do
change, so characterisation is a real gate.)
<!-- Red team 2026-09-14: scope-critic F9 rejected by the user; tests-first retained -->

- `determineTopicStatus` today: `IN_PROGRESS` for `{hasVideo:true, videoCompleted:false}`;
  `COMPLETED` for `{hasVideo:true, videoCompleted:true}`; `COMPLETED` for `{hasVideo:false}`
  and `{hasVideo:undefined}`; `COMPLETED` regardless of unfinished quiz children (`:123-129`).
- `processTopicProgress` does not decrement `completedItems` on a re-track (`:193-197`);
  increments `completedItems`/`completedTopics` and recomputes `progress` exactly once
  (`:206-211`).
- `updateParentLessonIfComplete` completes the parent only when every published child is
  complete (`:91-104`).
- **The forgery, pinned as current behaviour**: `POST /track { hasVideo: false }` on a video
  topic completes it today. This test goes red when F1 lands — that is the point, and its
  inversion in Tests After is the proof. <!-- Red team 2026-09-14: F1 -->
- `learners.outline.helper.test.ts` (**exists**) and
  `course-outline-model.test.ts` / `course-row-model.test.ts` (**exist**) run untouched.
- `manifest.test.ts` (**exists**) — every exported schema proved or excused.

## Refactor

Each step green before the next:

1. Model fields (additive, `null` defaults).
2. `learners.completion.rule.ts` — pure, fully tested before anything calls it.
3. `learners.position.helper.ts` + route + schema + rate limiter.
4. `/track` reads the server-derived inputs; the body booleans stop being read.
5. `cleanseUserProgress` and the recompute worker preserve the new paths.
6. Outline plumbing — three new keys.
7. api-client schema + endpoint + `keepalive` + fidelity + exports.
8. `watch-position.ts` — pure.
9. `use-vimeo-watch-tracking.ts`, then `topic-view.tsx`.

## Tests After

- **`forged-completion.test.ts`**: `POST /track { hasVideo:false }` on a topic with a known
  duration and `maxPositionSeconds: 0` leaves it `in_progress`; `{ videoCompleted:true }`
  with a mark at 10% leaves it `in_progress`; a mark at 85% completes it **without** any
  client boolean; a topic with **no** `v2topicmedia` row still honours the legacy boolean and
  reports `decidedBy: 'legacy'`. <!-- Red team 2026-09-14: F1 -->
- **`learners.position.helper.test.ts`**: clamps negative to 0; floors a float; rejects
  beyond `duration * 1.05`; accepts any position when duration is unknown; accepts a
  **backwards** resume write (2400 → 120) while `maxPositionSeconds` stays 2400;
  `matchedCount: 0` returns 204; **the update document contains no `status`,
  `completedItems`, `progress` or `completedTopics` path**.
  <!-- Red team 2026-09-14: F13 (FMA F8) — this replaces the count-based forward-only gate -->
- **`track-video-position.test.ts`**: two PUTs produce one `items[]` entry;
  `metadata.lastAccessedDates` does not grow on a position write; a position PUT issued
  concurrently with a `/track` still lets the `/track` complete (WriteConflict retry).
- **`position-survives-whole-array-writers.test.ts`**: write a position, run
  `cleanseUserProgress`, assert it survives; same for the recompute worker. Also: run the
  **pre-Phase-2** `processTopicProgress` against a document carrying the new fields and
  assert they survive — this is the rollback test.
- **Outline**: `positionSeconds`/`durationSeconds`/`imageUrl` are `null` on a lesson and a
  quiz; present on a topic with a media row; `null` (not `0`) without one.
- **`watch-position.test.ts`**: `shouldWritePosition` true at 12 s elapsed; false at 5 s with
  a 2 s move; true at 5 s with a 40 s jump; true when never written. **No threshold function
  in the browser** — assert the module exports none.
- **api-client**: `manifest.test.ts` green; the two outline `NOT_REPLAYED` entries name the
  three fields; position payload excused as a request body. Route replay:
  `pnpm fidelity` with `SECTOR_MIRROR_JWT_SECRET` set and `:5002` up — a run printing
  `route replay skipped` (`routes.fidelity.test.ts:65-70`) proves nothing.
- **Browser**: `node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>`, then a
  **manual** playback pass the sweep cannot drive: open the topic on `:3101`, play past 80%,
  confirm one `PUT …/position` ~every 12 s and **no** `videoCompleted` in any request body;
  reload and confirm the item reads `completed`; close the tab mid-play and confirm a beacon
  request in DevTools; rewind to 02:00, reload, confirm resume at 02:00 while the item stays
  `completed`.

## Regression gate

Nothing merges until all are green in one run:

1. `pnpm -w test` — full web + api-client suite, zero failures, count does not drop.
2. `pnpm test:functional tests/functional/learners tests/unit/app/lms/learners`.
3. `pnpm -w typecheck` and `pnpm -w lint`.
4. `pnpm fidelity` with the mirror API up — collection **and** route replay, with the skip
   message absent.
5. Cold-load sweep 100% healthy.
6. The manual playback pass above.
7. **Forward-only, proven by assertion rather than by counting.**
   <!-- Red team 2026-09-14: F13 -->
   The mirror holds **10** `usercourseprogresses` documents (184 completed items), so a
   before/after count there is measured on data the tester's own clicks modify and cannot
   detect a downgrade on the 3,970 production completers it claims to protect. Replace it
   with: (a) the `learners.position.helper.test.ts` assertion that the update document
   contains no status/count path; (b) the `wasCompleted` characterisation test; and (c) a
   **production read-only** aggregate on the Atlas secondary — `countDocuments` /
   `aggregate` only, `readPreference=secondary`, the IP is whitelisted — taken before deploy
   and 24 h after, both recorded in `reports/`. A scrubbed progress dump restored locally is
   an acceptable substitute. Any decrease is a stop-ship.

**No retroactive completion.** <!-- Red team 2026-09-14: F13 -->
Detection is at playback time, so the **731 learners stalled at 75–99%** are not flipped by
this deploy — a learner who watched 85% under the old `ended` rule stays `in_progress` until
they replay past 80% in a new session. A one-off server-side reconciliation (mark complete
where `maxPositionSeconds / durationSeconds >= 0.8`, or where `timeSpent >= 0.8 × duration`
for pre-position rows) is a **listed option for the plan owner, not an assumption of this
phase**. Say so to stakeholders reading Success Criterion 1.

## Success Criteria

- [ ] `POST /track { hasVideo: false }` on a video topic with a known duration **does not**
      complete it
- [ ] `POST /track { videoCompleted: true }` with a high-water mark at 10% **does not**
      complete it
- [ ] A topic reaching 80% completes with **no** completion claim in any request body
- [ ] A topic with no `v2topicmedia` row falls back to legacy behaviour and logs `decidedBy: 'legacy'`
- [ ] Items completed under the old rule are still `completed` — proven by the production
      read-only aggregate, not a mirror count
- [ ] The outline returns `positionSeconds`, `durationSeconds`, `imageUrl`; the name
      `videoDurationSeconds` appears nowhere
- [ ] No request body anywhere in the client carries a duration
- [ ] 10 minutes of playback produces ≤55 position writes and zero new `items[]` entries
- [ ] A position survives `cleanseUserProgress` and a progress recompute
- [ ] The position route returns 429 past 30 writes/minute for one user
- [ ] Closing the tab mid-playback produces a final position write
- [ ] `pnpm -w test` passes with no fewer tests than before

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Completion forgeable | **Was certain** | **Critical** — feeds CME, certificates, leader report | Server-decided rule; `forged-completion.test.ts`; disagreement logged |
| Skip-to-81% completes a topic | **High** | Medium — parity with the dashboard, but weakens under Phase 6's seek controls | Named as an open question in the Overview; watched-segment accumulation is a listed follow-on |
| Position write races `/track`'s transaction | Medium | High | 2 s suppression around `/track`; retry-and-re-arm; a concurrency functional test |
| Completion lost on tab close | **Was high** | High | Server decides from the high-water mark, so the last beacon is enough; `sendBeacon` added |
| Whole-array writers wipe the fields | Medium | **High** | Both in Modify; a test per writer; plus the rollback test |
| Write volume | High if unthrottled | High | Pure throttle + narrow `updateOne` + per-user rate limit |
| Client-supplied duration trusted downstream | **Was certain** | Medium | Duration is never accepted from the client |
| Mirror cannot prove forward-only | **Certain** (10 docs) | High | Replaced with assertions + production read-only aggregate |
| No test in the repo renders React | **Certain** | High | Threshold logic removed from the browser entirely; the rest is a named manual pass |

## Security Considerations

- **This phase closes a trust boundary, not just a bug.** Until it lands, any authenticated
  learner can mark an entire course complete with a loop of `POST /track {hasVideo:false}`,
  permanently. Treat the deploy as a security fix and consider whether existing suspicious
  completions need review — a read-only production aggregate for topics completed with
  `timeSpent` near zero is the cheapest first look.
- The route is `authUser` only and scopes on `req.user.id`; the selector is
  `{ user: <caller>, course, 'items.itemId': … }`. **No `userId` in the body or query** —
  `getUserDashboardAssignments` (`group-assignment.controller.ts:673`) is this codebase's
  cautionary example and is fixed in Phase 4.
- `itemId` is validated with `objectIdSchema` before reaching a Mongo selector.
- Rate limiting is a real control here, not hygiene: the route is unauthenticated-adjacent
  in cost (one `updateOne` on a large document) and had no limiter of any kind.
- Playback position and the high-water mark are behavioural data about a named person,
  served only on that person's own outline. They must not reach the leader report (Phase 8),
  the read-only admin view, or any export.
- The `decidedBy: 'legacy'` log line must not include the request body verbatim — log the
  topic id, the mark and the verdict, not the learner's headers.


## Outcome — 2026-09-15

Built across `feat/sector-topic-media` in `gusi_nodejs_api` and `main` in `scanvault`.
Gates: API typecheck 0, lint 0, **334 tests** across 35 files; web typecheck 0, lint 0,
**888 tests** across 73 files; **34/34 routes healthy on a cold load, 0 console errors**.

**What shipped.** Completion for a video topic is now a server decision. `resolveTopicCompletion`
compares the stored high-water mark against the runtime cached in `v2topicmedia`; the request
body's `hasVideo`/`videoCompleted` are ignored for any video whose runtime is known. A new
`POST .../items/:itemId/position` route writes the playhead as a single conditional array
update — no transaction, no structure walk — and completes the topic itself when the mark
crosses the threshold, so a closed tab no longer costs a learner the completion.

**One asymmetry worth keeping in mind.** The server's "this topic has a video" beats the
client's, but the client's still counts when the server has nothing cached. The abuse being
closed is a request claiming *less* video than exists; claiming more only makes completion
harder and is the honest answer for a topic added since the last media backfill.

**A pre-existing defect found and fixed on the way.** `cleanseUserProgress` reassigned
`items[]` on every call, clean or not. Assigning the array marks the whole of it dirty, so
Mongoose sent a full-array `$set` built from a possibly stale copy — which could roll back a
status written in between. Completion is forward-only and group-leader reports and CME credit
read it, so this mattered more than the playhead it was found through. It now reassigns only
when it actually removed something. `position-survives-whole-array-writers.test.ts` pins it.

**A hypothesis this disproved.** An `items.push()` from a stale document does *not* clobber a
sibling's playhead: Mongoose compiles an append to an atomic `$push`, not a full-array `$set`.
Only outright reassignment loses writes. The test file records both, because the difference is
not obvious from reading the calling code.

**Not done here, by design.** Nothing in the UI renders `durationSeconds` or `imageUrl` yet —
Phase 2 plumbs them onto the outline payload, Phase 3 is where they appear on screen.
