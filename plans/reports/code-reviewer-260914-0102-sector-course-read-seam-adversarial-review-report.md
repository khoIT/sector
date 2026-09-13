# Course Read Seam — Adversarial Review (phase 06, merged into `feat/sector`)

Date: 2026-09-14. Reviewer: code-reviewer subagent. Report only; no code changed.

## Scope

- Commits `ba5978d..9a38bc5` (8) + merge `330d4cd`; diffed against `1abd82c`.
- 36 files, ~2,357 insertions. Verified the seam is unchanged between `330d4cd` and current `feat/sector` head (`3cc428b`), and that the reviewed working-tree files are clean vs. HEAD.
- API read against `<scratchpad>/wt/api` (`feat/sector-api`), served by the running `:5002` mirror instance. No server was started, stopped or killed; no write touched any database except a throwaway local `sector_review_scratch` DB created and dropped by one probe.

Evidence sources used, named per finding: **S** = API/client source, **L** = live `:5002` responses, **M** = `gusi_prod_mirror` read-only queries, **B** = browser against the running `:3101` dev server, **Z** = the real zod schemas run over payloads via `tsx`.

## Overall Assessment

The client code is disciplined: server-side pagination with no client slicing, abort signals wired, query keys correct, pure display logic unit-tested, 48/48 i18n keys in all seven locales, no `any`, no swallowed errors. The defects are not in the code that was written — they are in the **set of response shapes that was sampled**. The seeded learner has 115 *personal* enrolments, all with `expiresAt: null` (written explicitly by `scripts/data/seed-test-accounts.ts`), none expired, none with a failed quiz. Every shape outside that fixture is unvalidated, and three of them make the schemas throw.

Because `client.ts:193-201` turns a parse miss into a thrown `ApiError{kind:'parse'}`, each of these is a whole-surface failure — "This list could not be loaded / Unexpected response shape from /api/v2/learners/courses" — not a degraded cell.

**Blockers: 4.**

---

## Blockers

### B1. A failed quiz breaks the whole outline page
`items[].status` is `courseProgressStatusSchema` (3 values). The API's `ProgressStatus` has **four**: `learners.quiz.track.ts:263` sets `quizItem.status = ProgressStatus.FAILED` whenever a learner answers every question and scores below the passing mark (also `user-course-progress.service.ts:157,186`). `buildOutlineProgressItems` (`learners.outlinecontent.helper.ts:108`) passes the stored value through unmapped, and `learners.outline.helper.ts` types it `'not_started' | 'in_progress' | 'completed' | 'failed'`.

- Z: `courseOutlineSchema.safeParse` on the baseline payload with one item flipped to `failed` → `invalid_enum_value ... received 'failed'` at `items.1.status`.
- M: the mirror holds only 5 `usercourseprogresses` docs (all seeded), so no failed row exists locally — this is exactly the shape the green run cannot see. (S for reachability, not L.)
- Impact: any learner who has ever failed a quiz in a course cannot open that course's outline. Fails closed, loudly, on the first real user.
- Fix: add `'failed'` to the item status union (a separate schema from the outline-level `status`, which the builder derives and can only be the three values), and give it a row tone/label.

### B2. `expirationType: 'course_assignment'` is not in the client enum
`learners.service.ts` (group branch) emits `expirationType: isGroupExpired ? 'group_expired' : isMembershipExpired ? 'membership' : 'course_assignment'`. `normalizeLearnerCourses` only drops rows whose `expirationType` is `membership`/`group_expired` (or whose group is deleted/expired), so a row expired by the **group-course assignment's own `expiresAt`** survives into `expired` carrying the fourth value. `EXPIRATION_TYPES` in `schemas/course.ts:43` lists three.

- Z: parse of such a row → `invalid_enum_value ... received 'course_assignment'`.
- M: 42 live (`deletedAt: null`) `groupcourses` are already past their `expiresAt`, across 18 groups whose own `expirationDate` has not lapsed; 249 distinct non-expired learner/leader memberships sit in those groups.
- The schema's doc comment ("`normalizeLearnerCourses()` checks all three") documents the wrong thing — it enumerates the drop rules, not the emitted values.
- Fix: add `'course_assignment'` to the enum (and correct the comment).

### B3. Row-level `expiresAt` is omitted for most group assignments
`expiresAt: groupCourse.expiresAt` is read off a `.lean()` document. `expiresAt: {type: Date, default: null}` is a **Mongoose default, and lean reads do not apply defaults** — so for a document that never stored the key, the value is `undefined`, and `sendResponse` (`JSON.stringify`) drops the key entirely. The client requires it (`expiresAt: z.string().nullable()` rejects missing).

- Proof of the lean behaviour (throwaway local DB `sector_review_scratch`, created and dropped): a doc inserted without the key reads back `{group:'g1'}` — `hasKey: false` — while the hydrated read shows `null`. Serialised: `[{"group":"g1"},{"group":"g2","expiresAt":null}]`.
- Z: a row with the key deleted → `invalid_type, expected string, received undefined, path ["expiresAt"]`.
- M: **1,783 of 2,969** live `groupcourses` have no `expiresAt` field (1,205 store an explicit `null`). Those sit in 701 groups holding **9,426 distinct** learner/leader members, out of 18,518 mirrored learners.
- L: the seeded `leader@sector.test` and `reviewer@sector.test` accounts *do* exercise the group branch (2 rows each) and parse fine — because the group the seed picked happens to have `expiresAt` stored. That is luck, and it is why manual verification passed.
- Same class, unquantifiable here: `usercourses` in the mirror are 100 % seeded rows, so the personal branch's `expiresAt` was never observed against production-shaped data.
- Fix: `expiresAt: z.string().nullish()` (and the same for any other field the API reads straight off a `.lean()` doc with a schema default — this is a general rule for this API, not a one-off).

### B4. Outline `courseMetaVersion` is typed `z.number()`, the controller sends `number | null`
`learners.controller.ts#getLearnersCourseOutline` sets `reportedVersionNumber = null` in two branches it documents deliberately: a progress row with `courseMetaVersionNumber == null` ("report it as null rather than claim precision the record doesn't have"), and a pinned version snapshot that no longer exists. It also falls back to `activeCourseMetaVersion?.version ?? null`.

- Z: `courseMetaVersion: null` → `invalid_type, expected number, received null`.
- L: 40/40 sampled outlines returned a number, and M shows 0/5 mirrored progress docs with a null pin — so reachability is **source-verified only**, not observed. The API author wrote the null path on purpose; the client contradicts it.
- Fix: `z.number().nullable()`, and render the "unknown version" case as unknown.

---

## Should-fix

### S1. An empty course tells the learner they completed it
Verified live and in code. `resumeItem === undefined` (because `resume` is `null`) is the *only* condition for the completed banner, so a course with no renderable items renders **both** "You have completed this course." and "This course has no content yet", at 0 %.

- L: `GET /api/v2/learners/courses/68f04e61fa8359afd6836877/outline` → `{status:'not_started', progress:0, totalItems:0, completedItems:0, resume:null, items:[]}`.
- M: 6 of 157 `v2coursemetas` have an empty/absent `structure`; the walk also drops every unpublished item, so any course whose content is all draft lands here too.
- Fix: gate the banner on `outline.totalItems > 0 && outline.status === 'completed'`, not on the absence of a resume pointer.

### S2. The "Expired" status filter can never show a row, and says the wrong thing
With `status=expired` the service keeps only `isExpired` rows and `normalizeLearnerCourses` routes every one of them into `expired`; `items` and `totalItems` are therefore *always* empty for that filter.
- L: `?status=expired` → `{totalPages:0, totalItems:0, items:[], expired:[]}`.
- B: the page renders "No courses match your search" + "No course title matches “”." — an empty keyword interpolated into a keyword-shaped sentence, because `hasActiveNarrowing` is true for a filter-only narrowing.
- Two fixes, both small: drop `expired` from `COURSE_LIST_STATUS_FILTERS` (or make it scroll to / reveal the expired section), and use a filter-aware empty-state description when `keyword` is blank.

### S3. The expired section is unpaginated and repeats on every page
The API sends the **complete** `expired` array with every page (it is not sliced by `startIndex/endIndex`; only `activeCourses` is). `ExpiredCoursesSection` renders all of it, on every page, with no cap. A learner with a long expired history pays that cost on each page change and sees the same list six times. Cap it, collapse it, or render it only on page 1.

### S4. `resume` can point at a blocked quiz
`buildCourseOutline`'s resume selection filters on `status !== 'completed'` and leaf-ness, but **not** on `blockedReason`. A blocked quiz is a leaf and can never be `completed`, so:
- a course whose first incomplete leaf is a zero-question quiz opens with "Start: <unopenable quiz>";
- a course where every completable item is done still shows a Start/Resume button (pointing at the blocked quiz) instead of the completed banner, at 100 %.
None of the 40 sampled outlines hits this today (S only; the two courses that carry blocked items resume onto a normal leaf). The fix belongs in the API (`items.find(... && !item.blockedReason)`), with the client's completed-banner condition from S1 as the backstop.

### S5. Legacy item deep links dead-end on a generic 404
`legacy-route-map.ts` redirects every legacy lesson/topic/quiz URL to `/learn/courses/:courseId/:itemId`, and `legacy-route-map.test.ts:142-148` asserts it. `coursesRoutes` mounts only two paths, so that target falls through to the `*` route.
- B: `/dashboard/my-courses/<c>/lessons/<l>/quizzes/<q>` → `/learn/courses/<c>/<q>` → "Page not found". The parent course URL one segment up resolves to a real outline.
- Not a regression (the unbuilt placeholder was exact-path too), but `courses-links.ts`'s comment claims all three shapes are pinned and asserted, which reads as coverage it does not have. Either route `:courseId/:itemId` to the outline (anchored on the item) or say why not, the way this repo says why not everywhere else.

### S6. The resume action promises an action it does not perform
- B, on the 384-item course: button reads "Start: Ultrasound Basics Physics and Probes Quiz", click scrolls 311 px, URL gains `#item-…`, nothing opens; the target row is a `<div>` with no affordance. Repeat clicks and a cold load with the hash both scroll correctly (that part is solid — see Positives), so the mechanics are fine and the *label* is the problem.
- The phase retired `/learn/courses` from `unbuilt-surfaces.ts`, i.e. it gave up the honest "not built yet" copy for this area. The scroll-only action should say so — "Go to: {{title}}" plus a line stating the course runner lands next — rather than borrowing the vocabulary of an LMS that opens content.

### S7. `courseMetaVersion` totals are required but absent on 12 % of version documents
`learnerCourseMetaVersionSummarySchema` requires `totalItems`/`totalQuiz`/`totalLessons`/`totalTopics`; the service copies them straight off a `.lean()` version doc (same missing-key mechanic as B3).
- M: 43 of 347 `v2coursemetaversions` have no `totalItems`/`totalQuiz`. Only one of those is version 1, and no `usercourses`/`groupcourses` currently point at any of them — so this is latent, not live. It becomes live the moment a learner's `userCourse.courseMetaVersion` pins one of the other 42 (the personal branch honours that pin).
- Z: confirms the parse failure if it happens. Make the four totals `.catch(0)` or optional.

### S8. The status filter is cast from the URL, not validated
`filterValue(url.filters, 'status') as CourseListStatusFilter | undefined` (`my-courses-page.tsx:46`) type-asserts arbitrary URL input. `filterValue` can also return `string[]`.
- B: `?filters=[{"id":"status","value":"bogus"}]` → the page shows the API's raw validator text: "Invalid enum value. Expected 'not_started' | 'in_progress' | ... received 'bogus'". A stale bookmark from a future filter rename produces the same.
- Validate against `COURSE_LIST_STATUS_FILTERS` and ignore anything else — the list already knows the legal set.

### S9. Two surfaces, two denominators, no reconciliation
The card's percentage comes from the stored `UserCourseProgress` counters; the outline derives its own. For the 384-item course, the same payload that feeds the card carries `courseMetaVersion.totalItems: 384` while the outline reports `totalItems: 383` (one blocked quiz). This is not a request to reverse the derivation decision — it is the observation that both numbers reach the learner, on adjacent screens, with nothing explaining the gap. Either show the card's progress from the same rule, or don't show a percentage on the card.

---

## Nits

- `toolbar.clearSearch` exists only in `en.json`; the new page renders it twice (aria-label + empty-state button), so a fully translated `courses` namespace still shows English there. Pre-existing (groups and scan-list do the same) and consistent with the documented fallback policy — listed for completeness, not as a phase defect.
- `course-outline-item-row.tsx:65`: `bestPercentage ?? 0` renders "Best: 0%" when `attempts > 0` and no attempt has a score. Show a dash.
- `courseKeys.listRoot()` and `courseItemPathFor()` are both unused. `listRoot` exists for invalidation after mutations; this phase has none. YAGNI.
- The outline heading is always the generic "Course outline" (B, confirmed): `course-card.tsx` links without `state.title`, and the comment describes the gap rather than closing it — one `<Link state>` away.
- A 404 outline still offers "Try again", which will always fail. Both the 404 and the 400 (`/learn/courses/not-an-object-id` → "Invalid ObjectId") render raw API strings; the 400 also reveals the route's validator vocabulary. No PII, but it is server phrasing in a learner's UI.
- `getCourseOutline` interpolates `courseId` into the path without `encodeURIComponent`. Consistent with every other endpoint in the package and fed by a router param, so cosmetic — but it is the package's convention that is wrong, not this file.
- The list error state discards the previously rendered rows (`keepPreviousData` keeps the data; the early `if (query.isError)` return throws it away) and offers no route back to page 1.

---

## Answers to the specific questions asked

- **`duration`, `cmeCredits`, `cmeUrl`, `cmeCode`** — the implementer's report is correct and now independently confirmed. L: across 100 live rows, `duration` never appears at all, and the three cme fields appear as strings on 33 rows and are absent on 67. M: `duration` is missing on all 175 `v2courses`; cme fields are string-or-missing (93/82), never null, never numeric. `.optional()`/`.nullish()` are right. (If a WP-era numeric `cmeCredits` ever lands, Z shows it fails — but no such document exists in the mirror.)
- **Pagination** — no client-side slicing anywhere; `limit`/`page` are sanitised by `parseLimit`/`parsePage` before they reach the query. L: 115 enrolments, `totalPages: 6` at limit 20, page 99 returns `items: []` with `totalItems: 115` and the page renders the "Nothing on this page / Go to first page" state. `expired` is the one thing that is not paginated (S3).
- **Resume anchor** — honest about *where* it goes, dishonest about *what it does* (S6). Behaviour on 384 items is good: 384 rows, 3,746 DOM nodes, 454 ms to interactive anchor, first click scrolls, a second click after scrolling away re-scrolls, and a cold load with the hash already in the URL lands on the target. No console errors.
- **Error and empty states** — zero-enrolment learner: not reproducible locally (no such seeded account), but the code path is the same `items.length === 0 && !narrowed` branch that B exercised. 404: correct message, and it is the *same* message for "not enrolled" and "does not exist", so no course-existence enumeration. Mid-flight failure: `signal` is wired, so a superseded keystroke aborts rather than racing; a genuine failure replaces the surface (see nits).
- **Query keys** — `outline(courseId)` cannot collide between courses; `list(query)` hashes the full query object. Nothing to invalidate in this phase.
- **i18n** — 48 leaf keys × 7 locales, verified from the merged commit: no missing, no extra, no true orphans (everything that looked orphaned is composed at runtime — `statusFilter.${value}`, `kind.*`, `itemStatus.*`, plural `_one/_other`). No key is reused with a different meaning; `index.status.*` and `outline.itemStatus.*` are deliberate near-duplicates at different scopes. **The French/Italian/Portuguese reasoning holds and is now evidenced**: `gusi_web_dashboard/src/i18n/locales/{fr,it,pt}.json:510` contain `"resumeCourse": "Curriculum vitae"`, `"Curriculum del corso"`, `"Curso de currículo"` — all CV mistranslations. The new strings (`Poursuivre`, `Continua`, `Continuar`) avoid the trap and are correct.
- **Casts vs parses in the schemas** — the schemas themselves parse, and unknown server fields are stripped rather than rejected (Z), so an additive server change is absorbed silently and safely. The only cast in the seam is the URL status filter (S8). What would *not* be absorbed is a new enum member or a newly-omitted key — which is precisely B1–B4.

---

## Why the green suite missed all of this

Worth stating plainly, because it will recur next phase: the fidelity manifest adds exactly one entry for this seam (`v2courses → the course inside a My Courses item`) and lists **every other course schema in `NOT_REPLAYED`** — the list item, the progress block, the group block, the meta-version summary, the envelope and all six outline schemas. `live-api-shape-check.test.ts` was not extended either. So "fidelity 100 %" covers the embedded course object and nothing else, and the only validation the new shapes ever received was one seeded learner with 115 personal, never-expiring, never-failed enrolments.

The cheapest durable fix is a live shape check that walks a handful of *group-assigned* enrolments and a course with a failed quiz, not more unit tests over pure functions.

## Recommended Actions

1. B1–B4: four schema corrections (`'failed'`, `'course_assignment'`, `expiresAt` nullish, `courseMetaVersion` nullable). Smallest possible diff, largest blast radius avoided.
2. S1 + S4 together: fix the completed-banner condition and the resume-selection filter; they are the same bug seen from two ends.
3. S2: remove or rewire the Expired filter option, and fix the filter-only empty-state copy.
4. S3, S6, S5: expired-section bound, honest action label, and a decision on `:courseId/:itemId`.
5. Add group-assignment coverage to the seed (`--group-enrol`) or to the live shape check, so the next course phase cannot repeat this.

## Metrics

- Type coverage: no `any`, no `as unknown as`, one type assertion (S8). Lint/typecheck/build reported clean by the author; not re-run.
- Test coverage added: 2 pure-model suites + 1 i18n parity suite. Zero wire-shape coverage for the two new routes (see above).
- Schema payloads validated during this review: 40 live outlines + 5 live list responses + 10 synthesised drift cases through the real schemas.

## Unresolved Questions

1. B4 and S7 are source-verified but unobserved: does production hold `usercourseprogresses` rows with a null `courseMetaVersionNumber`, and do any live enrolments pin one of the 42 version documents that lack `totalItems`? Both are one Atlas read (read-only, allowed) away.
2. B2/B3 could not be exercised end-to-end locally because every mirrored user account has `status: 'pending'` and is rejected at `authUser`. Is there an approved way to mint a session for a mirrored learner, or should the seed grow a group-assigned learner instead?
3. S6 is a product call: does "Start"/"Resume" stay on the outline until the runner lands, or should the action be relabelled now?
4. S9: should the My Courses card show a percentage at all before the two denominators agree?
