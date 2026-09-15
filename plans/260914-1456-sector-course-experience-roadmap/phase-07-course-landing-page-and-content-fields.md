---
phase: 7
title: "Course landing page and content fields"
status: pending
priority: P2
effort: "5 days"
dependencies: [1, 3]
---

# Phase 7: Course landing page and content fields

## Overview

<!-- Red team 2026-09-14: folded corrections — delta: the console PR is now gated on a NAMED
     content owner committing to author the fields (this phase rates "never filled" as High
     likelihood, so engineering should follow demand rather than predict its absence); the
     invented "12 objectives × 300 chars" caps are removed; and the CME block's dependency on
     Phase 2's now server-decided completion is stated. Effort unchanged at 5d. -->

A learner opening a course today sees a list of items and a percentage. Nothing answers the
three questions the research says a landing page has to answer before someone commits:
**what is this, how long will it take, and what do I get?**

The honest starting position is that GUSI mostly cannot answer them either, and this phase is
as much about creating the fields as about rendering them.

**Verified against `gusi_prod_mirror.v2courses`, 14 Sep 2026 — all 175 documents:**

| Field | Key present | Non-empty | Note |
| --- | --- | --- | --- |
| `title`, `slug`, `status` | 175 | 175 | 146 `published`, 29 `draft` |
| `content` (HTML description) | 175 | **17** | 158 of the 175 describe themselves with nothing |
| `imageUrl` (cover) | 76 | **2** | and both are on `(Deleted)` test courses |
| `cmeCode` / `cmeCredits` / `cmeUrl` | 93 | **0** | all three are the empty **string** on all 93 (`$type` check) |
| `duration` | **0** | 0 | the key does not exist on any course document |
| `level`, `objectives` | **0** | 0 | no such fields anywhere |

Two corrections this forces on the brainstorm's item 12:

1. **"Backfill objectives from existing HTML where present" is not worth writing.** Seventeen
   courses have a description at all. A parser, its tests and its review cost more than a
   content person spending an afternoon on 17 records. Cut it.
2. **CME cannot be rendered from data.** 93 courses carry the three CME keys and every one of
   them is empty. The accreditation statement is a content-entry task, not an engineering one —
   and it is entangled with certificates being disabled (`CERTIFICATE_DOWNLOAD_MAINTENANCE`,
   CTP-834/399, 2,860 completers holding a record with no file). Advertising CME credits for a
   course whose certificate cannot be downloaded is a promise the product cannot keep.

**And one trap worth naming loudly:** `course.duration` is **not** a runtime. It is
`{ value, unit: hours|days|weeks|months|years }` (`packages/api-client/src/schemas/course.ts:80-84`),
authored through `DurationInput` in the console
(`gusi_scanhub_console/src/components/ui/duration-input.tsx:29-50`) and rendered in the course
list as a value/unit pair (`.../course-list.tsx:121-132`). It is an **access** duration — how
long an enrolment lasts. "Total hours of video" is a different number entirely, and it comes
from Phase 1's `v2topicmedia.durationSeconds` summed by Phase 3's `summariseOutline`. Never
render one where the other belongs.

So this phase does three things: adds the two genuinely missing fields (`level`, `objectives`)
to the model and the wire — **not** the console, which is a separately gated item
(step 11); builds the landing page; and renders every optional
block conditionally so that a course with no description, no level and no CME still looks
deliberate rather than broken. **Which is 158 of 175 courses on day one** — the empty state is
the common case here, not the edge case.

## Requirements

**Functional**

1. A course landing route showing: title, cover image, description, level, learning
   objectives, total video time, the module list with per-module counts and minutes, the quiz
   count, and the CME block.
2. A single primary CTA — `Start` / `Continue` / `Review` — resolving to the exact next item
   via the rule that already exists, not a new one.
3. `level` and `objectives[]` are accepted by `PUT /api/v2/courses/:id` and served on the
   course. Console form controls are a later, separately gated item.
   <!-- Red team 2026-09-14: folded correction -->
4. Every optional block renders only when it has content. No `—`, no "Not specified", no
   empty card.
5. A course with only a title still renders a coherent page: title, module list, counts,
   total time, CTA.
6. The My Courses card links a **not-started** course to the landing page and an
   **in-progress** course straight to its resume target.

**Non-functional**

7. One request beyond what the outline route already costs. The landing page's counts and
   minutes are derived from the outline the shell already holds.
8. The CME block renders only when `cmeCredits` is non-empty **and** carries an explicit note
   about certificate availability while the certificate flag is off.
9. Every new string through `t()` in all seven locales; no addition to
   `locale-completeness-baseline.json`.
10. Parse-not-cast: the two new fields get Zod schemas and a fidelity decision.

## Architecture

```
CONSOLE (gusi_scanhub_console — NOT in this phase; gated on a named content owner)
   course-edit.tsx / course-create.tsx  ──►  PUT /api/v2/courses/:id   ← the route already
                                                                      accepts both fields
        + Level select        (beginner|intermediate|advanced)
        + Objectives list     (string[], add/remove rows)
                                   │
                                   ▼
API (feat/sector-api)     v2courses.level, v2courses.objectives[]
                                   │
                    GET /api/v2/learners/courses/:courseId   (getLearnersCourseDetails,
                                   │                          learners.controller.ts:202)
                                   ▼
api-client   learnerCourseSummarySchema  (schemas/course.ts:113-126 — already carries
                 │                        content, imageUrl, duration, cme*; + level, objectives)
                 ▼
web    features/courses/landing/course-landing-page.tsx
         ├─ description      RichText (sanitised)      ← course.content            (17/175)
         ├─ level + objectives                          ← new fields               (0/175 today)
         ├─ total video time + module list + counts     ← summariseOutline(items)  (Phase 3)
         │                                                over Phase 1's durations
         ├─ CME block                                    ← cme* + certificate caveat (0/175)
         └─ CTA  resolveResumeTarget(items, outline.resume?.itemId ?? null)
                   ← course-outline-model.ts:81-89, unchanged
```

**Who owns what**

| Side | Owns |
| --- | --- |
| **console repo** | **Nothing in this phase.** The two form controls are a separate, later item gated on a named content owner — `PUT /api/v2/courses/:id` already accepts the fields without them. <!-- Red team 2026-09-14: folded correction --> |
| **API** | The two model fields and serving them. Nothing computed. |
| **api-client** | Two schema fields, the fidelity decision, the barrel export. |
| **web** | The whole page, and every "is there anything to show here" decision. |

**Why nothing is computed server-side.** Total minutes, module counts and quiz counts are all
sums over the outline array the client already has, and Phase 3 already owns that arithmetic in
`outline-summary.ts`. Putting the same numbers on the wire would create a second source of
truth for a value the client can always derive — the same call Phase 3 made, for the same
reason `course-outline-model.ts:8-14` gives about not re-deriving navigation.

**Route placement, and the collision to know about.** The landing page is
`/learn/courses/:courseId/about`, a **static** child of the Phase 5 shell. React Router ranks a
static segment above a dynamic sibling, so `about` is matched before `:itemId` — which is
correct here because every real item id is an ObjectId and can never be the literal string
`about`. Name this in the route file's doc comment; it is exactly the kind of ranking
assumption that is invisible until someone introduces a slug-based item id.

**Ownership rule with Phase 5.** Phase 5 owns `courses-routes.tsx` and `courses-links.ts`. This
phase depends only on Phase 1, so it *can* land first. If it does, Phase 5 absorbs `about` into
its nest. If Phase 5 lands first, this phase adds `about` as a child of the existing shell. The
two must not both restructure the route tree.

## Related Code Files

**Create**

- `apps/web/src/features/courses/landing/course-landing-page.tsx`
- `apps/web/src/features/courses/landing/course-landing-model.ts` + `.test.ts` — pure:
  `landingBlocks(course, summary)` returning which blocks have content;
  `formatTotalTime(seconds)`; `ctaLabelKey(status)`.
- `apps/web/src/features/courses/landing/module-summary-list.tsx` — module rows with counts
  and minutes, built from `groupOutlineItemsForDisplay` + `groupTotalSeconds` (both Phase 3).
  Total, not remaining — see step 7.
- `apps/web/src/features/courses/landing/cme-block.tsx`
- API repo: `tests/functional/learners/course-detail-content-fields.test.ts`

**Modify**

- API repo: `src/database/v2/course/course.model.ts` — add
  `level: { type: String, enum: ['beginner','intermediate','advanced'], default: null }` and
  `objectives: { type: [String], default: [] }`. Both additive with defaults, so all 175
  existing documents stay valid and no migration runs.
- API repo: `src/app/lms/learners/learners.controller.ts:202` (`getLearnersCourseDetails`) —
  include the two fields in the course object it serves.
- API repo: `src/app/lms/learners/README.md`
- API repo: the v2 course write schema and controller used by the console's course edit
  (`PUT /api/v2/courses/:id`) — accept and persist `level` and `objectives`. Trace it from
  `src/app/v2/course/*`; do not widen any other field while in there.
- `packages/api-client/src/schemas/course.ts` — `learnerCourseSummarySchema` (`:113-126`) gains
  `level: z.enum([...]).nullish()` and `objectives: z.array(z.string()).default([])`. Both
  nullish/defaulted for the same reason the file already documents at `:105-112`: a course
  document that never set a key sends no key, and `.optional()` is the honest model, not a
  server-side default nobody wrote.
- `packages/api-client/src/fidelity/manifest.ts` — the existing
  `v2courses → the course inside a My Courses item` entry (`:512-520`) already proves
  `learnerCourseSummarySchema` by collection replay over all 175 documents. Adding two
  defaulted fields keeps it green *and* is exactly the case replay is good at: 175 real
  documents with neither key must still parse.
- `packages/api-client/src/index.ts` — append-only under the courses header (`:609`).
- `apps/web/src/features/courses/courses-links.ts` — `courseAboutPathFor(courseId)` and
  `COURSE_ABOUT_ROUTE_PATH`.
- `apps/web/src/features/courses/courses-routes.tsx` — mount it (see ownership rule).
- `apps/web/src/features/courses/my-courses/course-card.tsx` — not-started links to `about`.
- `apps/web/src/features/courses/outline/course-outline-page.tsx` — an "About this course"
  link in the header.
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json` — `courses.landing.*`
- `apps/web/src/i18n/courses-namespace-parity.test.ts`
- `scripts/check/sweep-routes.json`
- console repo (**deferred — separate item, gated on a named content owner**):
  `src/pages/dashboard/courses/course-edit.tsx` (form reset at `:79-104`, fields
  at `:206-476`) and `course-create.tsx` — add the Level select and the Objectives list beside
  the existing Content field (`:374`) and above Duration (`:390`).

**Delete** — nothing. In particular, do **not** delete or rewrite the 17 existing HTML
descriptions; they render through `RichText` as-is.

## Implementation Steps

1. **Add the two model fields** (API). Additive, defaulted, no migration. Confirm on the mirror
   afterwards that all 175 documents still read and that `level` reads as `null` rather than
   absent-and-undefined once Mongoose hydrates them.
2. **Serve them** from `getLearnersCourseDetails` (`learners.controller.ts:202`) and from
   whatever assembles the course object on `GET /api/v2/learners/courses`
   (`learnersService.getLearnerCourses`), so the two routes do not disagree about a course's
   shape. `learnerCourseSummarySchema` models one shape for both.
3. **Accept them on write** in the v2 course update path the console calls. Validate `level`
   against the three-value enum and reject anything else — a free-text level is how
   `pathologygalleries.category` became 1,305 rows of un-relatable strings, which
   `phase-09` of the cutover plan spent a phase undoing. **Do not invent element-count or
   per-entry length caps.** <!-- Red team 2026-09-14: folded correction --> An earlier draft
   proposed "12 objectives × 300 characters" with a literal "say," — arbitrary limits become
   contract and tests for a field with zero rows today. Apply only the body-size limit the
   route already enforces; if a cap is genuinely wanted, the content owner sets the number.
4. **api-client.** Two fields, `.nullish()` / `.default([])`. Re-run `manifest.test.ts` — the
   existing `v2courses` replay entry (`manifest.ts:512-520`) now proves the new fields parse
   against 175 documents that have neither, which is the real risk and is worth stating in the
   entry's comment.
5. **`course-landing-model.ts`.** Three pure functions:
   - `landingBlocks(course, summary)` → `{ description: boolean, level: boolean, objectives: boolean,
     totalTime: boolean, cme: boolean }`. A block is present only when its data is genuinely
     non-empty — `content` must be non-empty **after trimming**, because an empty `<p></p>` is
     what a CMS leaves behind; `cme` requires a non-empty `cmeCredits`, since a code with no
     credits says nothing to a learner.
   - `formatTotalTime(seconds)` → `'3h 40m'`, `null` when the summary has no durations.
     Delegates to Phase 3's `formatDurationShort` rather than reimplementing it.
   - `ctaLabelKey(status)` → reuses the existing vocabulary in
     `course-row-model.ts:40-49` (`start` / `resume` / `review`) rather than inventing a
     fourth set of verbs.
6. **Build the page.** Read the outline from the Phase 5 shell context (or fetch it directly if
   this lands first), run `summariseOutline(items)`, and render blocks in order: hero
   (cover, title, level chip, total time, counts), description, objectives, module list, CME,
   CTA. Any block whose `landingBlocks` flag is false renders **nothing** — not a heading with
   an empty body, which is the specific failure mode that makes 158 sparse courses look broken.
7. **Module list.** One row per depth-0 group from `groupOutlineItemsForDisplay(items)`:
   module title, `n topics · n quizzes`, and minutes from **`groupTotalSeconds`** — the landing
   page wants total, not remaining. Phase 3 already exports both from `outline-summary.ts`;
   this phase adds no summing loop of its own.
   <!-- Red team 2026-09-14: F12 — groupTotalSeconds now lands in Phase 3, not here -->
8. **CTA.** `resolveResumeTarget(outline.items, outline.resume?.itemId ?? null)`
   (`course-outline-model.ts:81-89`) — the same function the outline page (`:70`) and Phase 3's
   Continue row already use. It already handles the blocked-quiz pointer and the
   everything-complete case. Do not re-implement "first incomplete item"; that rule has one
   owner and a 17-case test file.
9. **CME block.** It rests on a completion this plan had to make trustworthy first: Phase 2
   moves the completion decision server-side because it is client-forgeable today
   (`learners.schema.ts:44-49`, `learners.process.topic.ts:132-136`). Without that change a
   CME credits block advertises an accreditation claim any learner can mint with a loop of
   `POST /track` — so do not ship this block against a build that predates Phase 2.
   <!-- Red team 2026-09-14: F1 -->
   Render `cmeCredits`, `cmeCode` and a link from `cmeUrl` when present. While
   `CERTIFICATE_DOWNLOAD_MAINTENANCE` is on, include a short, plain sentence that the
   certificate is temporarily unavailable. This is the difference between an honest page and a
   page that promises a PDF 2,860 people already cannot download. Gate the sentence on a config
   value, not a hard-coded boolean, so removing it is a config change when CTP-399 ships.
10. **Entry points.** `course-card.tsx`: a `not_started` course links to
    `courseAboutPathFor(id)`; `in_progress` and `completed` link where they link today.
    `course-outline-page.tsx`: an "About this course" link in the header block (`:80-95`).
11. **Console fields — out of this phase, and gated on a named owner.**
    <!-- Red team 2026-09-14: folded correction -->
    This phase delivers the API model + write schema + Sector rendering. That is already
    enough to populate the fields: `PUT /api/v2/courses/:id` accepts them, so a script or a
    content person with API access can author content today. The console form controls (a
    `Select` for Level, an add/remove list for Objectives, beside Content at
    `course-edit.tsx:374` and in the `course-create.tsx:323` region) are a **separate item in
    a third repo with its own release cadence, blocked on the content owner named in
    plan.md committing to author a first batch.** This phase rates "content team never fills
    them" as **High** likelihood and hands them a CSV in step 12 — building a console PR that
    is then never used is engineering predicting demand instead of following it. When the
    first batch of authored content exists, open the console PR.
12. **Hand the content team a list.** Not a backfill script: the 17 courses with descriptions,
    the 146 published courses needing a level and objectives, and the 93 carrying empty CME
    keys. A CSV out of the mirror, attached to the phase, is the deliverable — the writing
    itself is theirs.

## Tests / validation

**Unit**

- `apps/web/src/features/courses/landing/course-landing-model.test.ts` —
  `landingBlocks` with a fully populated course (all true); with a title-only course (all
  false); with `content: '<p></p>'` (description false, the CMS-empty case); with
  `content: '   '` (false); with `cmeCode` set but `cmeCredits` empty (cme false);
  with `objectives: []` (false). `formatTotalTime(null)` is `null`, `(13200)` is `'3h 40m'`.
  `ctaLabelKey` for all three statuses.
- `apps/web/src/features/courses/outline/outline-summary.test.ts` (**exists**, Phase 3) —
  extended with `groupTotalSeconds`: sums every child regardless of status; returns `null` when
  no child has a duration (distinct from `0`).
- **Existing, must stay green untouched**:
  `apps/web/src/features/courses/outline/course-outline-model.test.ts` (17 cases) —
  `resolveResumeTarget` is reused, not modified;
  `apps/web/src/features/courses/my-courses/course-row-model.test.ts` (10 cases) —
  `courseActionLabelKey` is reused for the CTA vocabulary.
- API `tests/functional/learners/course-detail-content-fields.test.ts` — a course with no
  `level`/`objectives` serves `level: null` and `objectives: []`; a course with both serves
  them; a write with `level: 'expert'` is **400** (closed enum). **No element-count or
  per-entry length assertions** — this phase invents no such caps.
  <!-- Red team 2026-09-14: folded correction -->
- API `tests/functional/learners/course-detail-content-fields.test.ts`, continued: a course
  document written before these fields existed parses with `level: null` and
  `objectives: []` rather than failing — the case that matters, since it is all 175 today.
- `apps/web/src/i18n/locale-completeness-gate.test.ts` and `courses-namespace-parity.test.ts`
  green across all seven locales, no baseline addition.

**Fidelity**

- `packages/api-client/src/fidelity/manifest.ts`: **no new entry** — and that is the decision,
  recorded in the existing entry's comment. `v2courses → the course inside a My Courses item`
  (`:512-520`) already replays all 175 production course documents through
  `learnerCourseSummarySchema`, so the two added fields are proved against real data that has
  neither of them, which is precisely the case that would break a non-defaulted schema.
  `manifest.test.ts` stays green and the guard is satisfied without an excuse.
- Route replay: `pnpm fidelity` with `SECTOR_MIRROR_JWT_SECRET` set and `:5002` up.
  `routes.fidelity.test.ts` already replays `learnerCoursesPageSchema` over every page for the
  seeded accounts (`:9`); the new fields ride along. A run printing `route replay skipped`
  (`:65-70`) has proved nothing.

**Browser** — `node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>` against
`:3101` → `:5002` with a minted session. Add to `scripts/check/sweep-routes.json`:

```json
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b/about", "role": "learner",
  "needs": "Pediatric Residency|Start|Continue" }
{ "path": "/learn/courses/681a4b67779a0d9e6c9cc574/about", "role": "learner",
  "needs": "Review|modules" }
```

The second id is the completed course already in the sweep, so its CTA must read `Review` —
the one assertion that catches a CTA wired to course status incorrectly. Both ids are courses
with **no** description, **no** level and **no** CME, which makes them the right adversarial
case: the sweep is proving the sparse page renders, because the sparse page is 158 of 175.

Plus a **manual** pass, since the suite renders nothing (`environment: 'node'`,
`include: ['src/**/*.test.ts']`, `apps/web/vitest.config.ts`):

1. Open `/about` on a sparse course. Confirm no empty headings, no `—`, no orphaned card, and
   no layout gap where the description would be.
2. Open `/about` on one of the 17 courses with a description. Confirm the HTML renders through
   `RichText` with tables and embeds intact.
3. Set `level` and three `objectives` on a mirror course by hand, reload, confirm both blocks
   appear.
4. Confirm the module list's minutes match the outline page's for the same course — two
   surfaces, one arithmetic.
5. Confirm the CTA opens the exact item the outline page's own resume button opens.
6. Console clean.

## Success Criteria

- [ ] `/learn/courses/:courseId/about` renders for every one of the 146 published courses —
      including those among the 158 (of 175) that have no description
- [ ] A course with only a title shows title, module list, counts and a CTA — and no empty
      block, placeholder dash or "not specified" text anywhere
- [ ] `level` and `objectives` are writable through `PUT /api/v2/courses/:id` and render on
      the landing page when present (console UI is out of scope for this phase)
- [ ] The CTA opens the same item the outline page's resume button opens, for all three
      statuses, including `Review` on a completed course
- [ ] Total video time on the landing page equals the outline page's total for the same course
- [ ] `course.duration` is rendered nowhere as a content runtime
- [ ] The CME block is absent on all 93 empty-CME courses, and carries the certificate caveat
      when it is present
- [ ] `manifest.test.ts` green with the replay decision recorded in the existing entry
- [ ] Cold-load sweep 100% healthy including both new rows

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The page is mostly empty for 158 of 175 courses | **Certain** | High — a landing page that looks broken is worse than no landing page | `landingBlocks` drives every block; both sweep rows target sparse courses; manual step 1 is specifically the sparse case |
| Content team never fills level/objectives | **High** | Medium | The page ships useful without them (counts, minutes, module list, CTA). The console fields are a separate PR and a separate pace, which plan.md already tracks as a non-engineering dependency |
| CME advertised while certificates are disabled | Medium | **High** — 2,860 people already hold a record with no file | Caveat sentence gated on config, not a literal; removing it is a config change when CTP-399 ships |
| `duration` confused with runtime | Medium | Medium | Named in the Overview, in the model doc, and a success criterion asserts it is rendered nowhere as a runtime |
| `about` collides with `:itemId` | Low | Medium | Static segments rank above dynamic in React Router; item ids are ObjectIds. Documented in the route file so a future slug-based id does not silently break it |
| Route-tree conflict with Phase 5 | Medium | Low | Explicit ownership rule: Phase 5 owns `courses-routes.tsx`/`courses-links.ts`; whichever lands second adapts |
| Third repo (console) in scope | **Removed from this phase** | — | The console PR is gated on a named content owner and a first authored batch; `PUT /api/v2/courses/:id` already accepts the fields without it <!-- Red team 2026-09-14: folded correction --> |
| CME advertised on a forgeable completion | **Was certain** | **High** | Phase 2 makes completion server-decided; this phase must not ship the CME block against a pre-Phase-2 build <!-- Red team 2026-09-14: F1 --> |
| Objectives become a free-text dumping ground | Medium | Low | Closed enum for `level`, enforced server-side with a test. **No count or length caps on `objectives`** — step 3 removed them deliberately; the route's existing body-size limit is the only bound, and the content owner sets a number if one is ever wanted <!-- Red team 2026-09-14: folded correction; this row previously contradicted step 3 --> |

## Security Considerations

- `course.content` is author-supplied HTML migrated from WordPress and **must** render through
  `RichText` / `sanitize-rich-text.ts`, never `dangerouslySetInnerHTML`. The existing policy
  already handles the shapes these 17 bodies carry — nested tables, `player.vimeo.com` iframes,
  Word paste residue (`sanitize-rich-text.ts:16-22`). Do not widen it for this page.
- `objectives[]` is author-supplied but is **not** HTML. Render each entry as plain text in a
  React element. Putting it through `RichText` would be granting a sanitiser exemption to a
  field that has no reason to contain markup.
- `level` is a closed enum validated server-side. Never interpolate it into a translation key
  path or a class name without the enum check — a free-text level reaching
  `t(\`courses.landing.level.${level}\`)` is a missing-key leak at best.
- `cmeUrl` is an author-supplied URL rendered as a link. Force `rel="noopener noreferrer"` and
  `target="_blank"` for an absolute external URL, matching what the sanitiser already does for
  links inside authored content (`sanitize-rich-text.ts:66-70`), and reject a non-`https:`
  scheme rather than rendering it.
- The landing route reads `GET /api/v2/learners/courses/:courseId`, which is `authUser` and
  enrolment-scoped (`learners.route.ts:11`, via `validateAndFetchCourseData`). This phase does
  **not** make it public. A course catalogue for unenrolled visitors is a different product
  surface with a different access rule, and commerce was retired at cutover — do not quietly
  create a public course page here.
- `imageUrl` is presigned per request by the API (`schemas/course.ts:110-111`). Render it, do
  not cache it, and do not persist a presigned URL anywhere client-side.

## Outcome — 2026-09-15

### The phase's headline number was wrong, and the correction is good news

This phase opened on "158 of the 175 describe themselves with nothing" and was
scoped as "as much about creating the fields as about rendering them". Re-measured
against `gusi_prod_mirror.v2courses` before building:

| | all 175 | live (`deletedAt: null`) |
| --- | --- | --- |
| course documents | 175 | **117** (58 are soft-deleted) |
| `content` key present | 175 | 117 |
| description non-empty, raw | 113 | 108 |
| description non-empty after stripping tags | 110 | **107** |
| `status: published` | 146 | **102** |
| carrying any CME key | — | 41 |
| CME credits non-empty | — | **0** |
| `level` / `objectives` | 0 | 0 |

So **10 live courses lack a description, not 158** — and only **six of them are
published**: MedGlobal Bangladesh, MedGlobal Colombia, MedGlobal Yemen, MedGlobal
Yemen 2, Kenya OB Ultrasound pre- & post-tests, Fellowship Biophysical Profile.
The earlier figure counted all 175 documents, soft-deleted ones included, and
inverted "has a description" for "has none".

This does not change what was built — every block was already conditional — but it
changes what the content team is being asked for. The ask is not 158 descriptions.
It is 6 descriptions, a level and a set of objectives on 117 live courses, and a
decision about the 41 courses advertising CME keys with no credits behind them.

### Built

- `level` (closed enum: beginner/intermediate/advanced) and `objectives` on the v2
  course model, additive and defaulted, no migration. Served from **both**
  `getLearnerCourseDetails` and `getLearnerCourses`, so the two routes cannot
  disagree about a course's shape, and accepted on `PUT /api/v2/courses/:id`.
  `objectives` arrives over multipart, so the write path accepts a JSON-encoded
  array, repeated fields or a single value, and drops blank entries.
- api-client: `level`/`objectives` on `learnerCourseSummarySchema`, plus a new
  **narrow** `learnerCourseDetailsSchema`. Narrow deliberately — the details route
  also returns the whole resolved structure with every lesson, topic and quiz
  populated, which is a second definition of an outline that `courseOutlineSchema`
  already owns. Zod strips what is not declared.
- `course-landing-model.ts`: `landingBlocks`, `formatTotalTime`, `ctaLabelKey`.
  Eight unit tests. `ctaLabelKey` delegates to the existing `courseActionLabelKey`
  rather than restating three verbs in a second place.
- `course-landing-page.tsx` at `/learn/courses/:courseId/about` — a sibling of the
  shell, not a child: it answers "should I take this?", which is a different job
  from the contents pane's "where am I in it?". `about` is a static segment, so it
  outranks the shell's `:itemId` child.
- Entry points: a `not_started` course card opens the landing page; the outline
  page links to it. Seven locales, 189 i18n parity tests green.
- The content-team list: `reports/course-content-authoring-list.csv`, one row per
  live course with what it has and what it lacks.

### Not built

- **Step 11, the console form controls.** Still a separate item in
  `gusi_scanhub_console`. `PUT /api/v2/courses/:id` accepts both fields today, so
  content can be authored by script or API before that PR exists.
- The `landingBlocks` "empty" path is now the rare case rather than the common one.
  Worth re-reading the page once real levels and objectives exist.

**Verified**: API typecheck clean; api-client typecheck clean; web typecheck clean;
183 tests across the courses feature and the route map; 189 i18n tests.
