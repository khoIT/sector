---
phase: 3
title: "Outline and home re-entry surfaces"
status: completed
priority: P1
effort: "6 days"
dependencies: [2]
---

# Phase 3: Outline and home re-entry surfaces

## Overview

<!-- Red team 2026-09-14: F9 + F12 + folded corrections — delta: the module page now
     REPLACES the authored table (1,051 of 1,468 hrefs are absolute scanhub.upscan.com URLs
     the sanitiser forces to target=_blank, so they never reach the legacy redirect map);
     the Continue row uses the server's own `status=in_progress` filter plus
     `lastItemAccessed` on the list route instead of four outline fetches; the outline
     header is written ONCE as a shared component Phase 5 mounts unchanged; and this phase
     no longer edits the outline contract, which Phase 2 now owns end to end. Effort
     unchanged at 6d. -->

Phases 1 and 2 put durations and positions in the database. This phase is the first one a
learner can see, and it targets the number the whole plan is sequenced by: **58% of started
courses stall under 25%** (9,586 rows at 1–24%, 4,152 at 0%), and only 1,743 progress rows
were touched in the last 30 days.

Three surfaces answer that:

1. **An outline header that says how much is left.** Today the outline says
   `n/m completed (p%)` (`course-outline-page.tsx:88-95`) and nothing else. It gains the item
   breakdown, a progress ring, per-item durations and "X min left" per module — built as a
   **standalone component**, not inline, because Phase 5 mounts the same component in the
   persistent shell. <!-- Red team 2026-09-14: F8 -->
2. **A "Continue where you left off" row** on all four role homes:
   `<course> · <topic> · 62% · 18 min left · resume at 12:43`.
3. **A generated module page that replaces the authored table.**

**The module page is a replacement, not an addition — and the earlier reasoning for keeping
the table was wrong.** <!-- Red team 2026-09-14: F9 -->
An earlier draft kept the hand-authored `<table>` below the generated cards because "its
links still resolve through `legacy-route-map.ts:238-266`". That holds only for **relative**
hrefs. Measured on the mirror:

| Lesson-body hrefs | Count | Lessons | Behaviour |
| --- | --- | --- | --- |
| Relative `/dashboard/...` | 417 | 80 | Resolve via the legacy redirect map |
| Absolute `https://scanhub.upscan.com/dashboard/...` | **1,051** | **172** | Forced to `target="_blank" rel="noopener noreferrer"` by `sanitize-rich-text.ts:66-70` — a new tab on the retired host; React Router never sees the click |

So the majority of the authored links open a new tab on a host this programme is
decommissioning. Keeping the table ships a grid of dead links below a working one, with the
familiar element on the bottom. The table goes.

Legacy images are a different story and **do** still work:
`legacywp-content.s3.ap-southeast-1.amazonaws.com/wp-content/uploads/…` returns `200` today,
so a lesson's `imageUrl` remains a usable fallback thumbnail where Phase 1 found no Vimeo
picture. Use it; do not re-host it; expect the bucket to be retired eventually.

## Requirements

**Functional**

1. Outline header shows `n modules · n topics · n quizzes`, a progress ring, and total and
   remaining minutes — from a component Phase 5 can mount unchanged.
2. Every outline and sidebar row for a video topic shows its duration.
3. Every module group shows `X min left`.
4. A learner-home Continue row lists up to 4 in-progress courses with percent, minutes
   remaining, the next item's title, and `resume at mm:ss` when a position exists.
5. A lesson opens a **generated** module page. The authored HTML table is **not rendered**.
6. Absent duration renders as absent — never `0m`, never `—`, never a layout gap.

**Non-functional**

7. **Zero extra requests on the home screen.** The Continue row reads the list route that
   `MyLearningPanel` already has in flight (`my-learning-panel.tsx:36`), narrowed
   server-side. No per-course outline fetch. <!-- Red team 2026-09-14: folded correction -->
8. This phase **does not edit the outline contract**. Phase 2 added `positionSeconds`,
   `durationSeconds` and `imageUrl` in one pass; Phase 3 is render-only on that route.
   <!-- Red team 2026-09-14: F12 -->
9. Every new string through `t()` in all seven locales. The completeness gate
   (`locale-completeness-gate.test.ts`) fails otherwise. Its baseline
   (`locale-completeness-baseline.json`) currently excuses **432 pre-existing keys across 6
   locales** — do not add to it. <!-- Red team 2026-09-14: fact-check correction (was "74") -->
10. Duration formatting is one shared function across three surfaces.

## Architecture

```
            (Phase 2 already serves these on the outline item)
            positionSeconds · durationSeconds · imageUrl
                               │
                               ▼
  apps/web/src/features/courses/outline/outline-summary.ts     ← ALL arithmetic, pure
      summariseOutline(items)   → { modules, topics, quizzes, totalSeconds, remainingSeconds }
      groupTotalSeconds(group)  · groupRemainingSeconds(group) · formatDurationShort(s)
                               │
      ┌────────────────────────┼──────────────────────┬────────────────────────┐
      ▼                        ▼                      ▼                        ▼
 course-shell-header.tsx   outline rows         module-page.tsx          Continue row
 (NEW, mounted by the      + runner sidebar     (replaces the table)           │
  outline page now, by                                                        │
  the Phase 5 shell later)                                                    │
                                                                              │
  GET /api/v2/learners/courses?status=in_progress&limit=4  ◄──────────────────┘
        progress.lastItemAccessed: { id, title, positionSeconds } | null   ← NEW on the LIST route
```

**Who owns what**

- **API**: one change, and it is on the **list** route, not the outline —
  `learnerCourseProgressSchema` gains `lastItemAccessed`, and the route's `status` filter is
  used rather than re-implemented in the browser.
- **api-client**: that one schema field plus its fidelity decision.
- **web**: all arithmetic, all rendering.

**The Continue row, corrected.** <!-- Red team 2026-09-14: folded correction -->
The earlier design fetched `useCourses({ limit: 100 })`, filtered `in_progress` in the
browser, sorted by `lastAccessedAt` in the browser, then fetched **four outlines**. Three
problems: it contradicted Requirement 7; a learner with >100 enrolments never surfaces a
recent course past page 1 (the exact bug `endpoints/course.ts:38-42` warns about); and four
185-item outlines is ~740 items pulled to render four lines of text.

The server already supports `status=in_progress`. The progress document already stores
`lastItemAccessed` (`user-course-progress.model.ts:68,234`), which Phase 2's position write
`$set`s on every tick. Adding `lastItemAccessed: { id, title, positionSeconds } | null` to
the list route's progress projection makes the Continue row **zero-request**.

Two consequences to accept honestly: the row's pointer is the stored `lastItemAccessed`
rather than `resolveResumeTarget`'s blocked-quiz-aware rule, and the route's nested `sortBy`
is broken for `progress.lastAccessedAt` (documented at `my-learning-panel.tsx:37-40`). For a
"continue where you left off" row, the stored pointer is the more honest answer anyway — it
is literally where they left off. Fix the nested `sortBy` in the same API change, or request
`limit=4` on the server's default ordering and sort those four in the browser.

**The header is written once.** <!-- Red team 2026-09-14: F8 -->
`course-shell-header.tsx` is created **in this phase**, in
`apps/web/src/features/courses/shell/`, and mounted by `course-outline-page.tsx`. Phase 5
mounts the same file from `CourseShell` and relocates nothing. This is a deliberate
cross-phase file placement: Phase 3 creates the directory, Phase 5 fills it.

## Related Code Files

**Create**

- `apps/web/src/features/courses/outline/outline-summary.ts` + `.test.ts`
- `apps/web/src/features/courses/shell/course-shell-header.tsx` — ring, counts, minutes,
  breadcrumb. Written in its **final** home. <!-- Red team 2026-09-14: F8 -->
- `apps/web/src/features/courses/module/module-page.tsx`
- `apps/web/src/features/courses/module/module-card-model.ts` + `.test.ts`
- `apps/web/src/features/home/continue-learning-row.tsx`
- `apps/web/src/features/home/continue-learning-model.ts` + `.test.ts`

**Modify**

- API repo: `src/database/learners/learners.service.ts` — project `lastItemAccessed`
  (id + title + the item's `videoPositionSeconds`) onto the list route's progress object;
  fix the nested `sortBy` for `progress.lastAccessedAt`.
- API repo: `src/app/lms/learners/README.md`
- `packages/api-client/src/schemas/course.ts` — `learnerCourseProgressSchema` (`:143-155`)
  gains `lastItemAccessed`, `.nullish()`.
- `packages/api-client/src/fidelity/manifest.ts` — the existing `usercourses` replay entry
  (`:522-539`) proves `learnerCourseProgressSchema`; reword it to name the new field.
- `packages/api-client/src/index.ts` — append-only under the courses header (`:609`).
- `packages/ui/src/components/sanitize-rich-text.ts` — **optional**, see step 7: rewrite
  same-host absolute `scanhub.upscan.com/dashboard/*` hrefs to relative paths so any
  surviving authored link resolves internally. One hostname allow-list, unit-tested against
  a real lesson body. <!-- Red team 2026-09-14: F9 -->
- `apps/web/src/features/courses/outline/course-outline-page.tsx` — mount the header
  component; drop the inline header block (`:84-95`).
- `apps/web/src/features/courses/outline/course-outline-item-row.tsx` — duration chip.
- `apps/web/src/features/courses/runner/outline-sidebar.tsx` (`:111-114`) — duration chip.
- `apps/web/src/features/courses/runner/lesson-view.tsx` — render `<ModulePage/>` **instead
  of** `<RichText html={detail.data.content}/>` (`:50`).
- `apps/web/src/features/home/{learner,group-leader,scan-reviewer,admin}-home.tsx`
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`
- `apps/web/src/i18n/courses-namespace-parity.test.ts`, `home-locale-parity.test.ts`
- `scripts/check/sweep-routes.json`

**Delete** — no files. The authored lesson HTML stays in the database untouched; it simply
stops being rendered on the module page.

## Implementation Steps

1. **API: `lastItemAccessed` on the list route.** Project `{ id, title, positionSeconds }`
   from the progress document's `lastItemAccessed` plus the matching `items[]` entry. `null`
   when never opened. Fix the nested `sortBy` while in there.
2. **api-client.** One `.nullish()` field on `learnerCourseProgressSchema`; reword the
   `usercourses` manifest entry. **No outline-schema edit** — Phase 2 owns it.
3. **`outline-summary.ts`.** Pure:
   - `summariseOutline(items)` → counts by kind **excluding `blockedReason` items** (the
     server excludes them from `totalItems`, `learners.outline.helper.ts:246-250`; two
     disagreeing denominators is worse than one slightly small);
     `totalSeconds`/`remainingSeconds`, both `null` when no item has a duration so callers
     can tell "0 minutes left" from "unknown".
   - `groupTotalSeconds(group)` and `groupRemainingSeconds(group)`.
   - `formatDurationShort(seconds)` → `'4m'`, `'1h 12m'`, `'48s'`, `null` for `null`.
4. **`course-shell-header.tsx`.** Props: `courseId`, `courseTitle`, `outline`. Renders the
   breadcrumb, `<Ring/>` (`packages/ui/src/components/ring.tsx`), the counts line and
   `t('courses.outline.remaining', …)` when `remainingSeconds !== null`. No data fetching —
   it takes the outline as a prop so both the page and the Phase 5 shell can feed it.
5. **Mount it** from `course-outline-page.tsx`, replacing the inline block at `:84-95`.
6. **Row durations.** `course-outline-item-row.tsx` and `outline-sidebar.tsx:111-114` render
   `formatDurationShort(item.durationSeconds)` as a dim chip when non-null.
7. **Decide the sanitiser change.** Two options, pick one and record it:
   (a) rewrite absolute `scanhub.upscan.com/dashboard/*` hrefs to relative in
   `sanitize-rich-text.ts` so any authored link that survives elsewhere in the product
   resolves internally; or (b) skip it, since this phase stops rendering the tables anyway.
   Recommended: **(a)**, because those 1,051 links also appear in topic bodies and question
   stems that this phase does not touch, and one hostname allow-list is cheaper than finding
   them later. <!-- Red team 2026-09-14: F9 -->
8. **Module page.** Props: `courseId`, `lessonItem`, `items`. Calls
   `groupOutlineItemsForDisplay(items)` (`course-outline-model.ts:25`, unchanged), finds the
   group whose `header.id === lessonItem.id`, renders one card per child: thumbnail, title,
   kind label, duration, status pill, linking to `courseItemPathFor(courseId, child.id)`.
   Thumbnail precedence: `child.imageUrl` (Vimeo, Phase 1) → the lesson's own
   `imageUrl` (legacy S3, still `200`) → no image. Never a broken-image icon.
9. **Replace the table.** `lesson-view.tsx` renders `<ModulePage/>` and **not** the authored
   `content`. A group with no children renders an `EmptyState`, not a blank page — that is
   the 166 body-less lessons' answer too.
10. **Continue row model.** `selectContinueCourses(items, limit)` over the already-filtered
    server response; `formatResumePosition(seconds)` → `'12:43'`, `'1:02:07'`, `null` for `0`
    and `null`.
11. **Continue row component.** `useCourses({ query: { status: 'in_progress', limit: 4 } })`.
    Render title, `progress.lastItemAccessed.title`, `roundedProgress(progress.progress)`,
    and `formatResumePosition(progress.lastItemAccessed.positionSeconds)`. Link to
    `courseItemPathFor(courseId, lastItemAccessed.id)` with `state={{ title }}`, as
    `course-outline-page.tsx:99` already does. **Minutes-remaining is not shown here** — it
    needs the outline, which this row deliberately does not fetch; it is shown on the outline
    header where the data already is.
12. **Three distinct states.** Pending → `Skeleton`. Error → `<CardError/>`
    (`home/card-error.tsx`). No in-progress courses → render **nothing**, not an empty card.
13. **i18n.** All keys into `en.json` and all six other locales in the same commit. Review
    the diff for literal English in JSX — the gate checks key presence only.

## Tests / validation

**Unit**

- `outline-summary.test.ts` — counts by kind; blocked quiz excluded; `remainingSeconds`
  subtracts the in-progress item's position; both second-counts `null` when no item has a
  duration; `groupTotalSeconds` vs `groupRemainingSeconds` on a half-done module;
  `formatDurationShort` at `0`/`48`/`60`/`4200`/`null`.
- `module-card-model.test.ts` — Vimeo thumbnail preferred; legacy lesson `imageUrl` used as
  fallback; neither present → no image element; a quiz card shows no duration.
- `continue-learning-model.test.ts` — `formatResumePosition(0)` and `(null)` → `null`;
  `(3727)` → `'1:02:07'`; a course with `lastItemAccessed: null` renders a link to the course
  rather than to an item; the limit is honoured.
- `sanitize-rich-text.test.ts` (**exists**) — extended if step 7(a) is taken: an absolute
  `https://scanhub.upscan.com/dashboard/my-courses/x` href becomes relative and keeps no
  `target="_blank"`; a genuinely external `https://example.com` href still gets
  `target="_blank" rel="noopener noreferrer"`. Use a real lesson body from the mirror.
- **Existing, must stay green untouched**: `course-outline-model.test.ts` (17 cases),
  `course-row-model.test.ts` (10 cases).
- i18n: `locale-completeness-gate.test.ts`, `courses-namespace-parity.test.ts`,
  `home-locale-parity.test.ts` — green with **no** new baseline entries.

**Fidelity**

- `manifest.test.ts` green. The **existing** `usercourses → a personal My Courses row` entry
  (`manifest.ts:522-539`) already replays `learnerCourseProgressSchema` against real
  documents; reword it to name `lastItemAccessed`, which is exactly the case replay is good
  at — the field is absent on every historical row and must parse as `null`.
- Route replay: `pnpm fidelity` with `SECTOR_MIRROR_JWT_SECRET` set and `:5002` up.
  `routes.fidelity.test.ts:9` already replays `learnerCoursesPageSchema` over every page.
  A run printing `route replay skipped` (`:65-70`) proves nothing.
- **No outline-schema entry in this phase** — Phase 2 made that decision.

**Browser** — `node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>` against
`:3101` → `:5002`. Add/strengthen in `scripts/check/sweep-routes.json`:

```json
{ "path": "/", "role": "learner", "needs": "Welcome back|Continue" }
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b", "role": "learner",
  "needs": "modules|topics|quizzes" }
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b/681a4d96acc6f28eaec5e30b",
  "role": "learner", "needs": "Ultrasound Basics" }
```

Plus **one row on a lesson from the 172 with absolute legacy links**, so the sweep proves
the table is gone rather than only proving the empty case renders:
<!-- Red team 2026-09-14: F9 -->

```json
{ "path": "/learn/courses/<courseId>/<lessonId-with-absolute-links>",
  "role": "learner", "needs": "modules|topics" }
```

Pick the id from the mirror (`db.v2lessons.findOne({content: /scanhub\.upscan\.com/})`) and
record it in the phase report.

The sweep asserts a cold first paint and a quiet console — the only gate that catches a React
lifecycle bug, since the suite runs `environment: 'node'` with `include: ['src/**/*.test.ts']`
(`apps/web/vitest.config.ts`) and renders no component.

Manual: open a lesson from the 172 and confirm **no** `scanhub.upscan.com` link is present in
the DOM.

## Success Criteria

- [ ] The outline header states counts and, when durations exist, minutes remaining; a
      duration-less course shows no duration line and no gap
- [ ] The header is a component file that Phase 5 mounts without edits
- [ ] Every video topic row shows an identically formatted duration on both the outline page
      and the runner sidebar
- [ ] The Continue row appears on all four role homes and costs **zero** extra requests
- [ ] The Continue row links to `lastItemAccessed` and shows `resume at mm:ss` when a
      position exists
- [ ] A learner with no in-progress course sees no Continue row and no placeholder
- [ ] Opening any of the 166 body-less lessons shows cards or an explicit empty state, never
      a blank page
- [ ] Opening a lesson from the 172 with absolute legacy links renders **no**
      `scanhub.upscan.com` anchor
- [ ] All new strings in all seven locales with no addition to
      `locale-completeness-baseline.json` (which stands at 432 keys)
- [ ] Cold-load sweep 100% healthy including the legacy-link lesson row

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Phase 1 produced no durations | Low (oEmbed needs no token) | Medium | Every duration surface is conditional on non-null |
| Replacing the table loses content the cards do not cover | Medium | **High** — authored content disappears from view | The cards are generated from the same outline the table linked to; preview with the content team before merge; the HTML stays in the database and can be re-enabled with one line |
| Generated cards look worse than hand-authored ones | Medium | Medium | Content-team preview is a merge gate, not a follow-on |
| `lastItemAccessed` points at a blocked quiz | Low | Low | The Continue row links to it anyway and the item page explains itself (`outline-sidebar.tsx:86-98` already handles blocked items); `resolveResumeTarget` still governs the outline page's CTA |
| Nested `sortBy` fix regresses the list route | Low | Medium | Covered by the existing route replay over every page of `/learners/courses` |
| A component bug ships invisibly | **High** — no test renders React | High | Four sweep rows with `needs`, plus the manual DOM check |
| New English strings hard-coded past the key gate | Medium | Medium | Reviewer reads the diff for literals |

## Security Considerations

- No new endpoint. The list route is already `authUser`-scoped to the caller's own
  enrolments; this phase adds one projected field to it.
- `lastItemAccessed` is the learner's own pointer, served only on their own list. It must not
  reach the leader report (Phase 8) or any export.
- Thumbnails render in a plain `<img>` in a React component, **not** through `RichText` — no
  sanitiser policy change is needed for them and none should be made.
- If step 7(a) is taken, the sanitiser change is a **narrowing**, not a widening: one known
  host's absolute URLs become relative. It must not introduce a general "rewrite any absolute
  URL" rule, and the allow-list must be a literal hostname comparison, not a substring match
  — `scanhub.upscan.com.evil.test` must not match.
- Legacy S3 thumbnails are public, unsigned, https URLs. Render them; do not proxy them, and
  do not assume they will keep resolving after the bucket is retired — the fallback chain
  ends at "no image", which is the correct terminal state.

## Outcome — 2026-09-15

Shipped. Gates at the head: typecheck 0, lint 0, **1,283 tests** (927 web, 133 ui, 223
api-client), **35/35 routes healthy on a cold load with 0 console errors**.

**Two steps were changed by measurement, both against the plan as written.**

**Step 8's thumbnail fallback was dropped.** The plan's precedence was
`child.imageUrl` → the lesson's own `imageUrl` → no image. The lesson image is real —
`GET /api/lms/courses/:courseId/lessons/:lessonId` sends one — but it is a *single*
presigned URL shared by every child, and `generateLessonImageUrl` never returns null: a
lesson with no image of its own gets a generic default photo. So the fallback would paint a
grid of identical, often unrelated pictures. Measured against it: 843 of 894 video topics
(94%) carry a real thumbnail of their own, so the gap being papered over is small. The
precedence is now `child.imageUrl` → no image, and only an `https://` poster is used, so a
mixed-content URL shows the kind icon instead of a broken-image box.

**Step 9's wholesale replacement would have deleted teaching content.** The plan said the
module page renders *instead of* the authored body. Measured over all 606 non-deleted
lessons, discounting text inside links:

| Body | Lessons |
| --- | --- |
| Under 100 non-link characters — a navigation table, nothing more | 399 |
| Real teaching prose (scanning technique, probe selection, series overviews; up to 2,192 chars) | 207 |

Replacing every body would have removed instructional text from a third of the library.
`lesson-body.ts` splits the two populations on one threshold — they barely overlap in
length, so no tuning is involved — and the body renders when it teaches something and is
suppressed when it is only a worse copy of the list printed underneath it.

**Step 7(a) taken.** All 1,060 absolute links to the app's own host in lesson, topic and
question bodies are `scanhub.upscan.com/dashboard/*` — one host, one path prefix, measured.
They are rewritten to relative paths and stay in this tab; every other absolute link
(PubMed, WHO, journals) still opens in a new one. The allow-list is a whole-hostname
comparison, so `scanhub.upscan.com.evil.test` does not match, and there is a test for it.

**A gate was found lying, and tightened.** The lesson route had been reporting healthy while
its panel sat on a loading placeholder the whole time: the sweep settles on *stable text*,
and a skeleton's text is perfectly stable, so `needs: "Ultrasound Basics"` was satisfied by
the breadcrumb alone. The sweep now refuses to settle — or to pass a route — while any
`.sv-skeleton` is on screen, and the two lesson rows assert something only the panel can
produce (`echogenicity` from the prose, a child's title from the cards). Re-running the full
sweep under the stricter rule found no other route in the same state.

**Verified in a browser against real content**, not only in unit tests:

- A lesson with prose and children (`681a4d96acc6f28eaec5e30b`): the body renders, then 10
  cards — 5 topics with runtimes (`10m`, `7m`, `5m`) and 5 quizzes — with **5 Vimeo
  thumbnails decoded** (`naturalWidth` 295), every link internal, 0 errors.
- A lesson whose body is only a link table (`681a4d9eacc6f28eaec5e337`): no prose, **12
  cards**, 6 thumbnails decoded, 0 errors.

**Also fixed, not mine:** two source-tree-walking tests (`group-assignment.test.ts`,
`storage-migration.test.ts`) inherited vitest's 5s default and timed out under a
four-package parallel run — 34.7s vs 1.2s in isolation. The assertions are untouched; they
now declare a timeout that matches the I/O they actually do. This had produced a false red
twice.
