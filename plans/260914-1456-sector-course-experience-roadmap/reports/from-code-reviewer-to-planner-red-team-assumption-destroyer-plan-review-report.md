# Red-team plan review — Assumption Destroyer / Scope Auditor

**Plan:** `plans/260914-1456-sector-course-experience-roadmap/` (plan.md + phases 1–8) and the source brainstorm.
**Date:** 2026-09-14. **Method:** every claim below was checked against `scanvault` (feat/sector), the API worktree (feat/sector-api), `gusi_scanhub_console`, `gusi_web_dashboard`, the `gusi_prod_mirror` database, and Vimeo's published docs. No code was edited or run.

---

## Finding 1: Phase 6's transcript is built on an SDK property that does not exist

- **Severity:** Critical
- **Location:** Phase 6, "Architecture" (TRANSCRIPT column), step 5 `use-vimeo-text-tracks.ts`, "Why the transcript is fetched in the browser and not proxied", and Security ("the browser needs no token").
- **Flaw:** The plan states `player.getTextTracks()` returns `[{ language, kind, label, mode, link }]` and that the browser will `fetch(track.link)`. The Vimeo Player SDK's documented return shape is `{ label, language, kind, mode }` — there is **no `link`** and no way to obtain the caption file URL from the embed. The only source of a VTT URL is the REST endpoint `GET /videos/{id}/texttracks`, whose `link` is a **signed, expiring** URL (`link_expires_time`) that requires the account token Phase 1 keeps server-side. So the design the plan explicitly rejects ("proxying it server-side would mean handing the Vimeo token a second job…") is the only design that works.
- **Failure scenario:** Phase 1 ships and reports coverage ≥70%. Phase 6 starts, `use-vimeo-text-tracks.ts` is written, `track.link` is `undefined`, and the phase discovers mid-sprint that it needs a new authenticated API route, a per-request Vimeo call (or a cache with expiry handling), a fidelity decision for a new schema, and a CORS story for fetching `vimeo.com` VTT from the browser. The 7-day estimate and the "API owns nothing for transcript" ownership table are both wrong. This is the phase most under-estimated in the plan.
- **Evidence:**
  - Vimeo Player SDK README, `getTextTracks()` — track object is `label / language / kind / mode` only ("Kind can be either captions or subtitles. The mode can be either showing or disabled."): https://github.com/vimeo/player.js/blob/master/README.md
  - REST text-track object carries `uri, active, type, language, link, link_expires_time, hls_link, hls_link_expires_time, name` (signed download URL): https://www.postman.com/api-evangelist/vimeo/request/r8e6t4f/get-all-the-text-tracks-of-a-video ; https://developer.vimeo.com/api/reference/response/text-track
  - Phase 1 stores only `hasTextTracks` / `textTrackLanguages` (phase-01 step 3 model) — no `link`, and a stored link would expire anyway.
- **Suggested fix:** Re-architect Phase 6 transcript as: `GET /api/v2/learners/courses/:courseId/topics/:topicId/transcript?lang=` on the API, which calls `/videos/{id}/texttracks` with the Phase 1 token, follows `link`, and streams/caches the VTT (cache key = `vimeoVideoId + track.uri`, TTL under `link_expires_time`). Move VTT parsing either server-side or keep it client-side on the proxied body. Add the schema + fidelity entry. Re-estimate Phase 6 (realistically 9–10 days) and re-check the ≥70% gate rationale since the cost side has changed.

---

## Finding 2: Phase 4's send ceiling is already exceeded by the first run, and the overdue digest has no age cutoff

- **Severity:** High
- **Location:** Phase 4, step 8 "The handler" (`ASSIGNMENT_REMINDER_MAX_EMAILS`, default 500), requirement 2, Risk "First run emails thousands of people".
- **Flaw:** The plan says "nobody has measured how many distinct learners that is." It is measurable on the mirror today: **2,435 overdue-open rows belong to 843 distinct learners.** With a 500 default the very first run — and every subsequent daily run, because nothing is stamped when the ceiling trips — sends zero learner mail and one operator email, forever, until someone edits the ceiling. Separately, 496 of those rows have `dueDate` in 2025 (oldest 2025-10-08); 2,013 of 2,435 are `module`-level assignments. A digest that tells a learner about an 11-month-old module deadline is not a reminder; it is a reason to unsubscribe, and the plan has no age window on query B.
- **Failure scenario:** Switch flipped after copy sign-off → ceiling breach → no mail, daily operator noise; ceiling raised to 1,000 → 843 learners receive a digest listing up to a year of stale module deadlines on day one, with the only escape hatch being a per-group opt-out surface most of them have never seen.
- **Evidence:** `mongosh gusi_prod_mirror` — `groupassignments` `{deletedAt:null, dueDate<now, status∈{active,in_progress}}` → 2,435 rows, `$group by user` → 843; by `$year(dueDate)` → `{2025: 496, 2026: 1939}`; by `assignmentType` → `{module: 2013, topic: 280, course: 142}`. Phase 4 step 8 text: "default 500 … nobody has measured".
- **Suggested fix:** State the measured number in the phase. Add an age window to the overdue query (e.g. `dueDate ≥ today − 30d`) and a one-time backfill that stamps `overdueDigestSentAt` on rows older than the window so they never enter the digest. Choose the ceiling from the measured population (or ramp per group / per day), and make a ceiling breach stamp nothing but *alert*, not silently repeat.

---

## Finding 3: Phase 3 keeps a table of 1,051 links that open a new tab on the retired host

- **Severity:** High
- **Location:** Phase 3, Overview item 3, step 7 "Wire it into `lesson-view.tsx`" ("a table whose links still resolve through `legacy-route-map.ts:238-266`"), Success criterion "both sets of links resolving".
- **Flaw:** The claim that the hand-authored table links "still resolve through the legacy redirect table" holds only for **relative** hrefs. On the mirror, lesson HTML contains **417 relative `/dashboard/...` hrefs in 80 lessons** and **1,051 absolute `https://scanhub.upscan.com/dashboard/...` hrefs in 172 lessons.** The sanitiser forces every absolute `http(s)://` href to `target="_blank" rel="noopener noreferrer"` — it is treated as leaving GUSI — so React Router's legacy map never sees the click; the browser opens a new tab on `scanhub.upscan.com`. Whether that resolves post-cutover depends on what is served at that host, which this plan does not control. The plan's "keep the table below the cards" mitigation therefore ships a grid of new-tab links for the majority of the 155 table lessons.
- **Failure scenario:** Learner opens a module page after cutover, clicks a card image in the authored table (the visually dominant element), lands in a new tab on the old host — a dead page or a redirect loop — and the generated cards above are ignored because the familiar ones are below.
- **Evidence:** mirror `v2lessons` regex counts (`href="/dashboard/` vs `href="https?://…/dashboard/`), host histogram `{"https://scanhub.upscan.com": 1051}`; `packages/ui/src/components/sanitize-rich-text.ts:66-70` ("A link whose `href` is an absolute `http(s)://` URL is forced to `target="_blank" rel="noopener noreferrer"` … A relative link … is left alone"). Legacy images do resolve today: `curl -sI https://legacywp-content.s3.ap-southeast-1.amazonaws.com/wp-content/uploads/2019/03/GUSI-Topics-Thumbnails-Website.024.jpeg` → `200`.
- **Suggested fix:** Either (a) rewrite same-host absolute `scanhub.upscan.com/dashboard/*` hrefs to relative paths in the sanitiser (one hostname allow-list, unit-tested with a real lesson body), or (b) hide the authored table when the generated cards cover every link in it, in this phase rather than "a follow-on". Add a sweep `needs` on one of the 172 absolute-link lessons, not only the empty ones.

---

## Finding 4: "80% watched" is playhead position, not watched time — and Phases 5–6 hand the learner a seek button

- **Severity:** High
- **Location:** Phase 2, requirement 1 ("≥80% of duration watched"), "Why the threshold lives in the client", step 8 `hasCrossedWatchThreshold(seconds, duration)`; Phase 6 steps 8–10 (`seekTo` from cues, chapters, notes).
- **Flaw:** `hasCrossedWatchThreshold` returns `seconds / duration >= 0.8` where `seconds` is the current playhead from `timeupdate`. That is a **position** check: a single seek to 81% completes the topic. The plan's prose ("the watched-ratio itself depends on the player's own `timeupdate` stream and cannot be reconstructed server-side") implies accumulation that exists nowhere — not in Sector, not in the dashboard. Parity is real (the dashboard did the same), but the plan does not say so, and it does not weigh that Phase 6 adds three first-class seek controls (cue click, chapter rail, note timestamp), so "click the last chapter" becomes the fastest way to complete every video. `/track` has no duration check server-side, and the position route deliberately accepts backwards writes, so nothing on the server can tell 80% watched from 80% skipped.
- **Failure scenario:** Completion rate rises, the brainstorm's "18.5% → 25%" metric is hit, and the number means nothing for a CME-adjacent product. The "single constant, one-line change" framing hides that a threshold on *position* and a threshold on *watched segments* are different features.
- **Evidence:** `gusi_web_dashboard/src/pages/dashboard/my-courses/content/_components/topic-content-v3.tsx:128-132` (`player.on('timeupdate', ({ percent }) => { if (percent >= 0.8) markTopicComplete(); })`); Sector `apps/web/src/features/courses/runner/use-vimeo-watch-tracking.ts:31-33` (only `ended` today); API `learners.process.topic.ts:117-136` (`determineTopicStatus` reads booleans only); `learners.schema.ts:39-50` (`/track` body has no duration/position). No accumulation code in either repo (grep `watched|percent|timeupdate`).
- **Suggested fix:** State explicitly that the rule is "playhead reached 80% (dashboard parity)" and get the clinical/CME owner to accept *that*, or implement watched-segment accumulation client-side (merge `[from,to]` intervals from `timeupdate`, fire at ≥80% coverage) — still pure and testable, still no server change. Decide before Phase 2, because Phase 6's seek seam makes the position rule strictly weaker than today's `ended`.

---

## Finding 5: The "forward-only" regression gate and the mirror-based progress claims run on seeded data

- **Severity:** High
- **Location:** Phase 2, Regression gate item 7, Success criterion 3, Overview ("reaches 185 entries on a real course"), requirement 9 ("reaches 20 entries per item on the mirror"); Phase 1 manual validation.
- **Flaw:** The mirror's progress collections are seeded, not production: **10 `usercourseprogresses` documents (8 `in_progress`), 194 `usercourseactivities`, largest `items[]` is 62, and `items.metadata` has exactly one key (`lastAccessedDates`, 188 entries in total).** Gate 7 — "count completed items before, run a browser pass, count after, any decrease is a stop-ship" — compares two counts over ten seeded rows that the tester's own clicks modify. It cannot detect a downgrade on the 3,970 production completers it claims to protect. The "185 items" and "20 entries per item" figures cannot have come from this mirror as described.
- **Failure scenario:** The gate is green by construction; a regression that downgrades completed items on documents the tester never opened ships. The plan's Risk table rates that "Critical — visible to 3,970 completers".
- **Evidence:** mirror counts above; plan text in Phase 2 "Regression gate" #7 and "Overview". The plan's own source note says progress rows are seeded (this review's brief).
- **Suggested fix:** Prove forward-only with a unit test on `wasCompleted` (`learners.process.topic.ts:193-197`) and a functional test that PUTs a position and re-POSTs `/track` without `videoCompleted` against a pre-completed item. For production, take the read-only aggregate on Atlas secondary before and 24h after deploy (reads are permitted) and record both in `reports/`. Correct the 185/20 figures or cite their real source.

---

## Finding 6: Phase 8's "one shared row builder" is an N+1 loop, and the IDOR fix is a contract change with unlisted callers

- **Severity:** High
- **Location:** Phase 8, "Why a new leader route rather than reusing the export", step 2 ("pure refactor with no behaviour change"), step 4 ("never a per-member loop"), step 1 ("omitting `userId` entirely returns the caller's own assignments").
- **Flaw:** `exportGroupCourseProgress` assembles rows by calling `userCourseProgressService.getUserProgressByCourseId(user.id, course.id)` **per user per course** inside nested loops (`manager.controller.ts:876`; same shape at `:717` and `:1428`). Step 2 says extract it unchanged; step 4 says the extracted builder must be batched with no per-member loop. Both cannot be true — the refactor rewrites the export's data access, and the only tests touching that export are the leadership-scoping tests, which assert 403/200, not row content. Separately, `getUserDashboardAssignmentsSchema` declares `userId: z.string().min(1, 'User ID is required')`; making it optional is a request-contract change on a permission-gated route whose non-Sector callers (mobile, legacy dashboard) the phase does not enumerate.
- **Failure scenario:** Either the "identical workbook" promise is kept and the new report inherits the N+1 (a 200-member group × 30 courses = 6,000 queries per page view), or the batching is done and the export silently changes with no row-level test to catch a drift — the exact "leader's screen and spreadsheet disagree" outcome the phase calls "the worst possible".
- **Evidence:** `manager.controller.ts:796-802` (assertLeadsGroup ✔), `:876` (per-user loop); `tests/functional/group/manager/manager-leadership-scoping*.test.ts` are the only files referencing `export-course-progress`; `group-assignment.schema.ts` (`userId` required); `group-assignment.controller.ts:673-678` confirms the format-only check.
- **Suggested fix:** Split step 2 into (a) characterisation test of the workbook rows on a seeded group, then (b) the batched builder, with the export switched over and the test re-run. Enumerate callers of `dashboard/user` before relaxing `userId` (or keep it required and enforce `userId === req.user.id` unless leader/full-access). Re-estimate: 4 new functional API test files plus a refactor of a 100-line export is not 5 days alongside a sixth tab, CSV, and a four-home panel.

---

## Finding 7: The Continue row is a client-side scan over one page of enrolments

- **Severity:** Medium
- **Location:** Phase 3, "The Continue row's data path", requirement 8, step 8 `selectContinueCourses`.
- **Flaw:** `GET /api/v2/learners/courses` returns no resume pointer — `learnerCourseProgressSchema` carries `lastAccessedAt` only; `courseOutlineResumeSchema` lives on the outline route. The plan therefore filters `useCourses({ limit: 100 })` client-side for `in_progress`, sorts by `lastAccessedAt` client-side (because the server's `sortBy` is broken for nested fields, as `my-learning-panel.tsx:37-40` documents), then fetches four outlines. Learners with more than 100 enrolments — the exact bug `endpoints/course.ts:38-42` warns about — never surface an in-progress course beyond page 1, and "most recently accessed" is computed over an `enrolledAt:desc` page, not the enrolment set. The server already supports `status=in_progress` (`learners.service.ts:75`) and the plan does not use it.
- **Failure scenario:** A cohort learner enrolled in 120 courses resumes course #110 yesterday; the Continue row shows four older courses and omits the one they were in.
- **Evidence:** `packages/api-client/src/schemas/course.ts:143-155`, `course-outline.ts` (`courseOutlineResumeSchema` outline-only), `endpoints/course.ts:38-42`, `apps/web/src/features/home/my-learning-panel.tsx:36-46`, API `src/database/learners/learners.service.ts:452-540` (in-memory filter/sort).
- **Suggested fix:** Request `status=in_progress&limit=4` and fix the route's nested `sortBy` (`progress.lastAccessedAt`) in Phase 3 instead of a client sort; or add `resume` to the list route once, which also removes the four extra outline calls.

---

## Finding 8: The Vimeo inventory numbers are off by their own filter, and three embed shapes are unaccounted for

- **Severity:** Medium
- **Location:** Phase 1, "Verified against the mirror" table, step 5.1 (`TopicV2.find({ deletedAt: null })` → "1,480 docs"), Success criteria ("465 distinct video ids from 869 topics", "≈869 documents").
- **Flaw:** With `deletedAt: null` — the filter step 5.1 specifies — the mirror has **1,472 topics, 868 with a `player.vimeo.com/video/<id>` embed, 464 distinct ids** (8 soft-deleted topics carry the 869th/465th). The success criteria will fail by one on the plan's own query. Not counted anywhere: **272 topics (170 ids) embed unlisted videos with `?h=<hash>`** (the regex discards the hash — fine for the owning account's token, but the report should say so); **1 topic** embeds a bare `https://vimeo.com/271215560` WordPress core-embed block the regex misses; **7 topics (2 ids) embed YouTube**, which will never get a duration and will read as "absent" forever with no content-team flag. `multipleEmbeds` is 0, so that whole branch is dead weight.
- **Failure scenario:** Success criterion "465/869" is red on a correct run; the run is "fixed" by loosening the criterion instead of reconciling the count; YouTube topics silently never get durations.
- **Evidence:** mirror aggregation over `v2topics` with `deletedAt: null`: `player {docs: 868, distinct: 464}`, `hashed {docs: 272, distinct: 170}`, `bareNonPlayer {docs: 19, distinct: 11}` of which 1 id is not also a player embed, `youtube {docs: 7, distinct: 2}`, `multiEmbed: 0`, `deleted topics: 8`.
- **Suggested fix:** Pin the criteria to the filtered set (868/464) or drop the exact numbers in favour of "equals the extractor's dry-run count". Add `vimeo.com/<id>` and `youtube` to the extractor's *report* (not the fetch), and list unresolvable providers for the content team.

---

## Finding 9: Two brainstorm success metrics have no event to count, and the plan adds none

- **Severity:** Medium
- **Location:** plan.md Overview / brainstorm §7 ("resume-at-timestamp used on ≥40% of return visits"; "Started courses stalled <25%: 58% → ≤45%").
- **Flaw:** There is no client analytics or event pipeline in `apps/web` or `packages/api-client` (grep for posthog / mixpanel / segment / amplitude / gtag / `analytics.track` / `trackEvent` finds only incidental word matches). No phase defines a "resume clicked" or "return visit" event, so the headline adoption metric for Phases 2–3 cannot be measured. The stall metric can be re-counted from `usercourseprogresses.progress`, but Phase 2's threshold change alters the denominator's meaning (Finding 4), so before/after is not like-for-like.
- **Evidence:** grep results above; brainstorm §7; no phase's "Related Code Files" includes an events/telemetry module.
- **Suggested fix:** Either drop the resume-adoption metric or add one narrow server-side counter in Phase 2 (e.g. count of first position PUT after ≥24h idle per learner-course — derivable from `lastAccessedAt` deltas) and name it in the report cadence.

---

## Finding 10 (Scope audit): the new `items[]` fields can be wiped by two whole-array writers the plan does not mention

- **Severity:** Medium
- **Location:** Phase 2, step 3 `writeItemPosition` ("no `.save()`"), Security ("no existing index changes"), Risk "positional `$` selects the wrong item".
- **Flaw:** The position route is a positional `updateOne`, but two existing paths reassign or re-save the whole `items[]` array: `cleanseUserProgress` (`userProgress.items = cleanedItems` then `.save()`, reachable via `POST /lms/create-user-progress`), and the `processCourseProgressRecomputeJobs` Lambda that rewrites progress after a course version change. A `.save()` that sets the full array after a concurrent position write is a lost update; a rebuild that constructs item objects from a known field list drops `videoPositionSeconds` entirely. Neither site appears in Phase 2's file list or risk table.
- **Evidence:** `src/database/user-course-progress/user-course-progress.service.ts:753-773` (`cleanDuplicateItems` → `userProgress.items = cleanedItems as any`), `src/app/lms/lms.route.ts:17`, `serverless.yml` `processCourseProgressRecomputeJobs`, `src/workers/process-course-progress-recompute-jobs.ts`.
- **Suggested fix:** Add both to Phase 2's "Modify" list; assert in the functional test that a position survives `cleanseUserProgress` and a recompute; or move position out of `items[]` into its own `(user, course, item)` collection, which also removes the "positional `$` on a 185-entry array" concern.

---

## Verification Results (Scope Auditor)

| State addition | Lifetime | Write sites (planned) | Read sites (planned) | Existing state with same purpose? | Note |
|---|---|---|---|---|---|
| `usercourseprogresses.items[].videoPositionSeconds / videoDurationSeconds` | persisted | new `PUT …/items/:itemId/position` (`updateOne`) | outline route | **None** — `items.metadata` on the mirror has exactly one key (`lastAccessedDates`); `timeSpent` is elapsed-on-page, not position | Whole-array rewriters exist (Finding 10) |
| `v2topicmedia` (new collection) | persisted cache | `scripts/db/backfill-topic-media.ts` | outline join (Ph 3), tab gating (Ph 6) | **None** — no `vimeo` string anywhere in API `src/` or `scripts/`; no media/duration collection | Sidecar decision sound |
| `VIMEO_ACCESS_TOKEN` secret | process-global via `secrets.get` | Secrets Manager | backfill; **must also serve Phase 6 transcript proxy** (Finding 1) | Absent from `secrets.ts` schema and `LOCAL_DEV_SECRETS` (verified) | Plan's "token has one job" claim is false after Finding 1 |
| `groupassignments.reminderSentAt / overdueDigestSentAt` | persisted | reminder Lambda | reminder Lambda | **None** — document keys are `group, author, assignmentType, contentRefModel, contentId, courseId, lessonId, topicId, user, assignedAt, completedAt, dueDate, status, …`; no notification bookkeeping | Needs backfill for stale rows (Finding 2) |
| `assignmentreminderpreferences` (new collection) | persisted | new PUT | Lambda filter, account page | `groupnotifications` exists but is leader-keyed with enum `scan_created/submitted/reviewed/failed` (`group-notification.model.ts:10-15`) — verified not reusable | Decision sound |
| `coursetopicnotes` (new collection) | persisted | 4 new learners routes | notes tab | `scannotes` exists (scan domain, different lifecycle); `note.eta` mail template exists — unrelated | No overlap |
| `v2courses.level / objectives` | persisted | console via `PUT /api/v2/courses/:id` (multipart, `upload(imageFilter).single('image')`) | learners course detail/list | Absent on all 175 docs; array-through-multipart has precedent (`bundleId: z.array`) | OK |
| `?tab=` search param (nuqs) | URL/session | shell | shell | none | No new `localStorage` keys in any phase; 18 existing `localStorage` sites, none course-related |
| Single `Player` instance (Ph 5/6) | component lifetime, hoisted | `player-frame.tsx` | tracking hook, transcript, chapters, notes | today `new Player(iframe)` in `use-vimeo-watch-tracking.ts:31` | Two-instance hazard correctly named |
| Email transport | process | `sendEmail` | — | `EMAIL_PROVIDER` **defaults to `sendgrid`** (`secrets.ts:38`), not SMTP; `sendEmail` returns `null` on every failure, never throws | Brainstorm's "existing SMTP path" is a misnomer; plan's null-check is right |

**Other claims checked and confirmed:** `assertLeadsGroup(userId, groupId, userRole)` is a public method on `groupMemberService`, used at 12 sites in `manager.controller.ts`, 2 in scan export, 1 in dashboard — reusable as planned; `GROUP_LEADER_SCOPED_VISIBILITY = true`. `getGroupLeaderDashboardAssignments` (`:768`) checks only group existence — the authorisation hole is real. `learners.route.ts` has exactly the routes the plan cites. `Ring`, `Tabs`, `Textarea`, `Card`, `EmptyState`, `Skeleton`, `StatusPill` exist in `@sector/ui`. Console `course-builder.tsx` `'(0m0s)'` literals at `:1044,:1188,:1199` and `item.duration` at `:1519` confirmed. Referenced API precedents (`backfill-pathology-scan-type.ts`, `migrate-repair-progress-status.test.ts`, `mail.mock.ts`, `mail-hoisted.mock.ts`, `learners.outline.helper.test.ts`) all exist. Web suite: 72 test files / ~601 `it()`/`test()` calls by static count (plan says 872 — likely includes api-client's 30 files and generated cases; not verifiable without running).

**Effort:** Phase 6 is the most under-estimated (Finding 1 adds an authenticated proxy route, cache/expiry handling, schema + fidelity + CORS work). Phase 8 second (Finding 6: four new functional API test files against a `tests/functional/learners` directory that has five files today, plus an export refactor with no row-content tests).

---

Status: DONE_WITH_CONCERNS
Summary: One Critical (Phase 6 transcript relies on a non-existent Player SDK `link` field and needs the server-side token path the plan rejects), four High (reminder ceiling already exceeded and no age cutoff; 1,051 absolute legacy links open new tabs past the sanitiser; "80% watched" is a seekable playhead check; forward-only gate runs on ten seeded rows), plus scope/N+1/contract issues in Phases 3 and 8.
Concerns/Blockers: Vimeo REST rate-limit page and text-track reference render client-side and could not be fetched verbatim; the `link_expires_time` field is cited from Vimeo's Postman mirror and the Player SDK README. Phase 6 gate threshold (70%) should be re-decided after the cost side is corrected.
