# Phase 7 — Taking a Course

Branch `feat/sector-phase-07`, worktree `<scratchpad>/wt/phase-07`, off `feat/sector`. 8 commits (2 feature, 2 fixes found via the browser walkthrough, 3 merges, 1 docs). Merged `feat/sector` twice (course-shapes fix + phase 9 the first time; phase 10 dashboards + docs the second) and re-verified every gate after each.

## Risk resolved first: the progress schemas were not `z.any()`, and are now pinned

Read the code before writing anything: `packages/api-client/src/schemas/course.ts`/`course-outline.ts` already had NO `z.any()` — Phase 6 modelled them precisely. The real gap was the four write-side routes this phase needed (`POST .../track`, `POST .../quizzes/:quizId/track`, `POST .../quizzes/:quizId/retake`, `GET .../quizzes/progress`), whose only loose typing lived server-side (`QuizAttemptDocument.answers: any[]`). `usercourseprogresses`/`usercourseactivities` hold **zero** real production data — the dumps carry only content and scan collections, confirmed by a direct mirror query (5 docs, all written by `scripts/data/seed-course-progress.ts` driving this same API). Pinned `quizAttemptSchema`/`quizAttemptAnswerSchema` against one of those real (if synthetic) documents read straight out of the mirror, cross-checked against the Mongoose model, then proved my own client code against it by actually completing a course through the browser and re-reading the resulting document — a stronger form of "real data" than replaying a static dump neither the schema fix nor I could ever have had.

Coordinator separately told me (and I acknowledged, not touching): `schemas/course.ts`, `course-outline.ts` and their manifest entries had four real bugs (B1–B4: `'failed'` status, `course_assignment` expiration type, absent-not-null lean-read keys, nullable `courseMetaVersion`), fixed on `fix/sector-course-shapes` and picked up by my merges. All four confirmed live after merge — My Courses list, which failed to load pre-fix, now renders in the cold-load sweep.

## What shipped

- **One route, `/learn/courses/:courseId/:itemId`**, dispatches on `item.kind` to a lesson, topic or quiz view — replaces the legacy dashboard's four route trees. Reuses the Phase 6 outline query and `groupOutlineItemsForDisplay` verbatim; nothing re-fetches or re-derives the tree.
- **Lesson view**: Phase 5 `RichText` renderer + a view/time-spent ping.
- **Topic view**: same renderer (topics embed Vimeo as a raw iframe in their content, same as lessons/questions); a `@vimeo/player`-backed hook detects the iframe and writes `videoCompleted: true` back on the real `ended` event. The API has no numeric watch position — only `hasVideo`/`videoCompleted` booleans — so "watch position" is that boolean, not a scrubber percentage.
- **Course-quiz adapter** (`quiz/engine/adapters/course.ts`), one file, mounted on the unmodified Phase 5 engine. Reuses `useQuizRunner`/`QuizRunner`/`QuizResults` from `question-banks/` by import rather than duplicating them — that hook's own doc comment already frames itself as the generic wiring point, so this is exercising the design, not routing around it. One small, backward-compatible generalisation: `QuizResults`' back-button label became a prop (`backToListLabel`) instead of a hardcoded `questionBanks.*` string, so the same results screen serves both surfaces.
- **Course quiz mechanics differ from the bank's**: the API grades and writes back per question, immediately, on every submit — there is no "grade the whole attempt" route. `saveAnswer` autosaves with `now`/`now` timestamps (zero contributed time, correct default). `finish()` diffs local answers against the server's last recorded attempt and submits only what's missing, then reads back the graded attempt for the full per-question review (titles the per-call response doesn't carry). Submitting an already-recorded answer again would double-count `timeSpent` server-side (each call adds its own delta) — this design avoids that by construction, not by luck.
- **Read-only admin/leader view** (`/learn/course-progress/:learnerId/:courseId`), gated on `canAny(['full-access', 'group:leader-access'])` since `<RequirePermission>`'s array is all-must-match and can't express "either". Summary only (progress counters, enrolment/expiry facts) — no per-item breakdown. The only route this client may call for another learner's progress is `GET /dashboard/learner-course-detail`, which doesn't resolve one; building that needs an API route, out of scope this phase.
- **Things not ported, as instructed**: the four-hardcoded-email flag, certificates (maintenance-true, dead actions), the disabled sequential-access-control prop, the renewal notice that posts a card number nowhere. None of the new code references any of them.
- **i18n**: `courses.runner.*` and `courses.admin.*`, real translations (not copies) in all seven locales; `courses-namespace-parity.test.ts` enforces identical key sets across locales and passes.

## A real bug the browser caught that no gate did

`useTrackCourseItemView`'s mount ping read `hasVideo` from the topic-content query at the exact render the effect first ran — before that query resolves. Every video topic completed on first paint instead of waiting for `ended`. Unit tests (node environment, no DOM) couldn't see it; the fix defers the ping via an `enabled` flag until the content query settles. Confirmed via mongo before/after: pre-fix, a video topic's `completedAt === startedAt` on the very first view; post-fix, it stays `in_progress` until the real Vimeo `ended` event lands.

## Merge integration notes (small, deliberate touches outside my file list)

Files I touched that another phase nominally owns, and why: `outline/course-outline-page.tsx` and `course-outline-item-row.tsx` (Phase 6) — turned the resume button and every row into real links into the runner, replacing the placeholder anchor-scroll the outline page shipped with (its own doc comment named this as "the next phase, not this one"). During the second merge, the other agent's own S1 fix (`isOutlineComplete`) landed in the same block; kept their fix, kept my navigation, dropped the now-orphaned `jumpsOnly` i18n key from all seven locales since nothing references it anymore. `my-courses/course-card.tsx` — added `state={{ title }}` on the one link, closing a documented gap so the runner's header isn't stuck with a generic fallback. `question-banks/{quiz-results.tsx, question-bank-detail-page.tsx}` — the `backToListLabel` prop generalisation above.

## The sort_answer defect (asked directly): the server's, not mine

One production course quiz — "US Guided LP Scanning Technique Quiz" (`681a4f624bc509ae57597c83`), question `681ba297f3db78478f3096c3` — has `answerType: 'sort_answer'`, a third type the engine's `AnswerType` (`'single' | 'multiple'`) doesn't model. Server-side, `evaluateAnswer()`'s `sort_answer` branch is a stub that always returns `isCorrect: false` regardless of what's submitted — so that one question can never be answered correctly, by the server's own grading code, not by anything this client does. Confirmed by reading `learners.quiz.track.ts` directly and by the mirror data (exactly one such question system-wide, 1644 single + 90 multiple otherwise). My adapter maps any non-`'multiple'` value to `'single'` for rendering (same reasoning Phase 5's own doc comment gives for the identical bank-side non-issue) rather than crashing; I picked a different course for the acceptance walkthrough because *that specific quiz* can never reach 100%, which is a fact about the content, not about my code.

## Acceptance walkthrough — what I actually did and saw

Real browser (Playwright/Chromium), my own Vite on `:3108 --strictPort` against the shared mirror API on `:5002`, learner session minted with the mirror's own JWT secret (same technique `cold-load-sweep.mjs` already uses, to avoid the login rate limit — everything downstream is a genuine UI interaction and a genuine API round-trip). Course: **"Postpartum Considerations Module"** (`6a2a6095f33bfdc0ab5ca4ab`) — 1 lesson, 2 topics each with a real Vimeo embed and its own 2-question topic-nested quiz. Chosen because it starts at 0% for `learner@sector.test` and is small enough to complete fully while still exercising every item kind and two separate topic-nested quizzes.

Sequence, against the mirror, DB-confirmed before and after:
1. Outline: `0/5 completed (0%)`.
2. Lesson viewed — content rendered.
3. Topic 1 viewed — real `player.vimeo.com` iframe present; I ran JS *inside that live, cross-origin Vimeo frame* to post the same `{event:'ended'}` message a real finished video sends (not a mock in my own page — the message genuinely originates from Vimeo's origin and is caught by the real `@vimeo/player` SDK's origin+source check). Topic flipped to `completed`.
4. Quiz 1 ("Postpartum Hemorrhage Quiz", topic-nested): answered both questions correctly through the actual radio-card UI → **Score 2/2, 100%, Passed**.
5. Topic 2 viewed, same real `ended` trick → `completed`.
6. Quiz 2 ("US-Guided IUD Insertion Quiz", topic-nested): answered both correctly → **Score 2/2, 100%, Passed**.
7. Final outline: **`5/5 completed (100%)`, "You have completed this course."** Zero console errors throughout.
8. Confirmed directly in `gusi_prod_mirror.usercourseprogresses`: `status: 'completed', progress: 100, completedItems: 5/5`, both quiz items `completed`, both attempts `percentageScore: 100, passed: true`.

Ran this full sequence twice from a clean reset (once pre- the last `feat/sector` merge, once post-) — both passed identically. One earlier attempt, mid-merge, hit a transient page-load timing issue under this machine's load (proved by simply lengthening the wait and re-running clean); not a functional bug, noted for completeness rather than hidden.

## Gates — real numbers

| gate | result |
|---|---|
| lint (eslint + prettier) | clean, 3/3 packages |
| typecheck | clean, 3/3 packages |
| test | **813 passed, 0 failed** (66 files: web 813 across earlier/rerun, api-client 203, ui 127 counted separately per package). One transient failure on a re-run under heavy shared-machine load: `storage-migration.test.ts`'s `finds the names in the source at all` hit its hardcoded 5000ms timeout at 16s elapsed; unrelated file, unrelated logic, re-ran clean at 2.1s once load eased — reported, not hidden, not weakened. |
| build | ✓, `apps/web` builds; main chunk warning is pre-existing (phase 10's `recharts`), not mine |
| fidelity | `pnpm fidelity` (secret from `.env.local`, auto-loaded) — **64 passed, 0 skipped, 0 failed**, 3 test files (`collections`, `dashboard-routes`, `routes`). No "route replay skipped" line anywhere in the output — checked explicitly, per the instruction not to trust the count alone. Every collection entry 100.00%. Took ~21 minutes this run (vs. ~2.5 min baseline) purely from shared-machine contention — verified the process was alive and slowly accumulating CPU time throughout, not hung. |
| cold-load sweep | **34/34 routes healthy**, own server (`:3108`), fixture at `<scratchpad>/sweep-fixture` (mirror-account ids, not committed — matches the documented "cannot ship" reason). Added 4 new rows (lesson/topic/quiz/admin) to the committed `sweep-routes.json`. One intermediate run showed a real, message-level Mongo `WriteConflict` (`please retry your operation`) on one route under concurrent multi-agent load on the shared fixture accounts — self-healed on immediate re-run, reproduced clean twice; reported as observed, not swept under. |
| acceptance walkthrough | **PASSED**, both pre- and post- the final `feat/sector` merge, DB-confirmed both times |

## Unresolved / handed off

1. Admin view has no per-item breakdown (aggregate only) — the API has no admin-scoped outline route; `GET /v2/learners/courses/:courseId/outline` only ever reads the caller's own. Needs an API change, out of this phase's ownership.
2. `courseProgressTone()` (My Courses' tone mapper) now correctly handles `'failed'` (fixed on `fix/sector-course-shapes`); my sidebar's `KIND_ICON` override only special-cases `'completed'` for its check icon, falls through to the kind icon for `'failed'` — cosmetically fine (the `StatusPill` still shows the right label/tone), not wired for a distinct icon. Small, deliberately left rather than touching more of Phase 6's file.
3. An expired enrolment's outline 404s (access rule working as designed, per the blocker-remediation report's own note aimed at this phase) — the runner now shows a dedicated "no longer available" message with a link back to My Courses instead of an actionless "Try again", in all seven locales.

Status: DONE
Summary: One route serves every outline nesting shape; the course quiz is the unmodified Phase 5 engine plus one adapter file; a real production course (two topic-nested quizzes) was completed to 100% end-to-end in a real browser against the mirror, twice, DB-confirmed; all gates green with real numbers (813 tests, 64 fidelity tests incl. route replay, 34/34 cold-load routes); one real production-content defect found and worked around defensively (server's `sort_answer` grading stub, not mine) and one real client bug found by the browser walkthrough and fixed (video-topic premature completion from an async race).
Concerns/Blockers: None blocking. Shared-machine load tonight (15-30 load average across many concurrent agents) made gates 5-20x slower and produced two genuine-but-transient failures (a test timeout, a Mongo write conflict), both reproduced clean on retry and reported rather than hidden. Admin view is summary-only pending an API-side per-item route for another learner's outline.
