# Bringing the rest of ScanHub into the new app

**13 Sep 2026.** Seven parallel agents read every remaining ScanHub module — the learner
dashboard at :3000, the API, and the new app — and costed a redesigned port. Every claim below
carries file:line evidence in the agent transcripts; the numbers come from the local dev database
and from production BSON dumps, not from estimates.

Scope per instruction: **ignore** monorepo, AI-app integration as a workstream, and the Sales API.

---

## Read this first: eight authorization guards are commented out on `main`

`gusi_nodejs_api/src/app/course-meta-version/course-meta-version.route.ts` — verified by hand,
present on `main`, introduced 2025-09-09:

```
router.post('/:versionId/publish', authUser,
  //   withPermission(['publish:course']),
```

The same for `archive`, `restore`, `addApproval`, `getVersionsForUserGroup`, `assign/user-course`,
`assign/users` and `migrate/:userCourseId`. `set-default` never had one. All are `authUser` only,
so **any authenticated account — including a learner — can publish or archive a course version,
approve one, assign learners to a version, or migrate them between versions.**

Two more from the same sweep, unverified by me but specific:

- Any signed-in user can read any other user's referral list, including email addresses.
- An unauthenticated-tier write endpoint ships in the production route table.

These are not port questions. They are live and they should be triaged before any of the below.

---

## The honest headline

**Most of ScanHub is not worth porting, and a surprising amount of it is already dead.**

| Module | Reachable LOC | Verdict |
| --- | --- | --- |
| Courses (learner) | 6,087 of 15,223 | Port. 60% is unreferenced dead code, not flag-gated variants. |
| Quizzes | ~2,070 of ~3,900 | Port **one** engine. Four exist; two are unreachable. |
| Question banks | 1,094 | Same engine. `isQbank: true` on a quiz is the entire distinction. |
| Rapid Review ×2 | 251 | **Iframes** onto a third-party Reflex app. Both flags default off. |
| Sage AI | 6 | **Iframe.** |
| Resources | 3 | `ComingSoon` stub, no nav entry, no inbound link. Delete. |
| Pathology Gallery | 569 | Port. Small, real, read-only. |
| DICOM upload | 1,058 | Real, no nav entry, reachable by any signed-in user. |
| Dashboard home | ~8,570 | 12 charts, 14 endpoints, 2 of 4 role dashboards commented out. |
| Manage groups | ~5,500 of ~7,800 | Port. Two whole screens are dead routes. |
| Fellowship | 2,347 | **Do not port.** Frozen V1 against a backend that has already replaced it. |
| Commerce + account | ~395 of 15,400 | Port 2.6%. The rest is a WooCommerce-era storefront. |

Money in this product does not flow through the commerce module. Locally: **3,111
`scanreviewpurchases` against 0 orders, 0 subscriptions, 0 payment methods.** That path — scan
review credits — is already ported end to end.

---

## The course/quiz question the handoff left blank

Dion's handoff names "Course / Quiz Structure Representation (DB refactor/redesign)" as a track
and **leaves the body empty**. There is no written statement of the problem anywhere. Here is
what the code says.

**It is not a missing schema. It is a versioning system that versions the wrong thing.**

`V2CourseMetaVersion` stores the course tree with `status`, `version`, `isActive`, an approval
list and a unique `(courseId, version)` index. It looks like a proper versioned model. But:

1. **A published version is not immutable.** The snapshot is `CourseMeta.toObject()` — a bag of
   ObjectIds. Lesson bodies, quiz descriptions, questions and `correct` flags are always read
   live. An author fixing a typo in a question changes it **for every learner on every version,
   mid-attempt**.
2. **Progress cannot be per-version.** `UserCourseProgress` has a unique index on `(user, course)`
   — one document per learner per course. Publishing a version with one extra lesson demotes
   every learner who had finished. Two of the fifteen migration scripts in the repo exist to
   repair exactly that.
3. **A version-resolution bug that corrupted 14,940 learner records is still live in nine
   places.** `migrate-repair-demoted-progress.ts` documents it verbatim: `versionNumber || 1`
   renders the *oldest* structure to any learner whose enrolment has no version pin. Five
   different resolution ladders disagree, so a learner can read version 1 while their clicks are
   recorded against version 7.
4. **The tree is materialised in five places** and a migration script exists only to detect the
   drift between them.
5. **Nested structure items have no schema, no ordering field and no concurrency control.** Two
   authors reordering one course: last write wins, silently.

**So the redesign is one change:** make the published version an immutable **content** snapshot —
every title, body, question and answer, each node carrying an explicit integer order — and make it
the only thing the learner API reads. That deletes the N+1 walk, makes the version pin real, and
makes progress-per-version possible.

**And where "clunky to add a course" actually lives:** not in this repo. There is no
create-course or create-quiz code in `gusi_web_dashboard` at all. Authoring happens in
`gusi_scanhub_console`, the internal admin console — **the one repo in the stack we have never
cloned.** Before anyone plans course work, clone and read it. It is the only thing that answers
whether the friction is the data model above or that UI.

---

## What a single quiz engine buys

Four implementations exist. Two are unreachable — all three route entry points hardwire V3 — so
~1,850 lines and the whole `POST /api/lms/quizzes/:id/finalize` endpoint are dead. The two live
ones (course quizzes, question banks) differ on **one axis**: course quizzes submit per question
and read resume state from the learner-course document; question banks autosave and grade in one
batch. That is a three-method adapter — `loadProgress`, `saveAnswer`, `finish` — not two engines.

The three-way nesting (course / course>lesson / course>lesson>topic) is already **one** code path
behind three 9-to-13-line `useParams` wrappers. All 507 production quizzes have
`course`/`lesson`/`topic` null; placement lives entirely in the course-meta tree.

Six answer types are declared. Production holds **single 2,227 (95.1%), multiple 113 (4.8%),
sort_answer 1, and zero free_choice / fill_blank / essay** — and the server hard-codes the last
three to `isCorrect = false`. Build two, not six.

Bugs worth fixing in the rewrite rather than porting:

- **Client and server score by different formulas.** Server: correct ÷ total. Client: earned ÷
  possible points. Masked only because every one of the 2,341 production questions has `points: 1`.
- **Time spent accumulates quadratically.** The quiz start time is sent with every per-question
  submit, so a 10-question quiz taken in 10 minutes records ~55 minutes. Every time-on-task and
  CME report built on it is inflated.
- **The on-screen timer freezes after the first answer.**
- **146 published course quizzes have zero questions** — the learner presses Start and lands on
  "Question data not found", and the attempt can never complete.
- **Per-question `incorrectMessage` is authored, returned, typed, carried into state, and never
  rendered.** Clinician authors write remediation text no learner has ever seen.

---

## Courses — 28–32 days, and the redesign makes it cheaper

15,223 lines under `my-courses`, of which **6,087 across 33 components are reachable**. The v1
and v2 variants are not flag-gated alternatives — `page.tsx`, `list/page.tsx` and `content/layout.tsx`
all hardcode the V3 import, and the `COURSE_NEW_UI_V2_ALL` / `COURSE_NEW_UI_V3_ALL` flags are
declared and read by nothing. Eight routes, four of which are the quiz runner under different
`useParams` wrappers.

Estimate basis: 6,087 live lines, 9 missing api-client endpoints, 7 missing UI primitives, at the
~200 live-lines/day rate implied by ScanVault's existing scan surfaces. **+30%** if the `z.any()`
progress shapes have to be reverse-engineered rather than pinned against staging.

**The one redesign: have the server return the resolved outline** — an ordered flat item list with
per-item status, `next`/`prev`, and the resume pointer — instead of four parallel arrays joined by
`itemRef` with progress typed `z.any()`.

The client currently re-derives navigation **four times**: `generateCourseRoutesV3` (~90 lines),
`generateBreadcrumbsV3` (~175), the Start/Resume walk in `course-progress-button-v3`, and a fourth
assembly inside the 1,005-line sidebar. Each with its own edge cases, and the class of bug where
Resume, the breadcrumb and the sidebar highlight disagree.

Cost ~2 API days — the traversal already exists server-side in `learners.structure.helper.ts` (336
lines) — and it **deletes ~420 lines of client code and about 4 of the 30 days.** It is also what
turns the quiz runner's resume hydration from `isRecord` guards over a blob into a typed read.

Other things found on the way, worth fixing rather than porting:

- My Courses pulls 100 courses and filters in the browser; the API's own keyword/status filters go
  unused, and a learner with more than 100 enrolments silently cannot see them all.
- A feature is gated on **four hardcoded user emails committed to the repo**, beside the
  GrowthBook flag that exists to do exactly that.
- **Certificates are switched off by a hardcoded constant** — completion has no payoff today.
- Sequential access control was written and then disabled in place: a prop that reads as access
  control and enforces nothing.
- **677 lines of render-time WordPress HTML repair** between the database and the learner.

## Pathology Gallery — 3–4 days, port it, but not its taxonomy

The smallest real surface here: 569 UI lines over 4 components, 154 API lines, **3 read-only
endpoints, no writes, no permissions**, 27 i18n keys. A category bar, a sub-category rail, a
20-per-page card grid, and a dialog with the clip in an iframe.

The taxonomy is the problem. `category` and `subCategory` are nullable **free-text strings** with
no reference to ScanType; the server guesses which scan type each means by lowercasing names and
returns `id: null` when it guesses wrong; and the client then **throws away anything outside a
hardcoded 13-name array** in `scan-type-list.tsx`. So:

- Content people cannot publish a new category. The server returns it, the UI drops it silently.
- A typo or a casing change orphans a whole category from its icon.
- Corrections ship as one-off scripts — `scripts/db/update-pathology-gallery.ts` is **775 lines**
  of re-filing, with comments like "Client Request 1A: Fix subcategory for shooters abscess items".

Three more defects, all cheap to not-repeat: the default category comes from a *different
endpoint* than the category bar (so a first visit can land on a category with no button
highlighted and an empty grid); the categories endpoint issues **~13 serial S3 presigns plus a
full collection scan on every page load**, uncached, and it gates the whole screen; and an
unfiltered list fetch fires before any category exists and is thrown away.

**Recommendation: give the pathology document a real `scanTypeId` reference, serve the category
bar from that relation, and delete the client whitelist.** ~4–6 days, most of it the backfill
migration rather than code. Porting the gallery first and fixing the taxonomy later means porting
the whitelist into the new app, where it will be just as invisible.

## Dashboard home — 20–30 days, and I would not spend it

The heaviest thing in the study by an order of magnitude: **~8,570 lines, 23 components, 14
endpoints**, a 1,189-line member table with Excel export, 242 i18n keys × 7 locales, and recharts
— which is not a dependency of the new app at all.

**21% of it is already unreachable.** Two of the four role dashboards are dead: `group_leader`
and `scan_reviewer` fall through to `<AdminDashboard/>`, so two roles are served a surface built
for a third — including its group-wide member table and export — while 412 lines of purpose-built
dashboards sit unshipped.

More telling for a port: chart colours and translation keys are derived by comparing **English
label strings returned by the API** (`label === 'Completed'`, `'Pending'`, `'Reviewed'`). Rename
or localise a status server-side and slices render grey with a raw missing-key string, failing
silently. And `console.log` ships inside a `useMemo` in the admin hot path, printing group names
and ids on every interaction.

**The new app has already made this decision.** `router.tsx` sends `/` to `VaultIndexRedirect` —
the first scan list the role may open. There is no dashboard home in ScanVault, Insights is the
stated replacement for the analytics, and adding one back is a product reversal, not a port.

**Bundle: ~5–8 days** for gallery + the Sage frame + a decision on DICOM, against ~30–45 to port
all five faithfully. The difference is almost entirely the dashboard home.

## One blocker before any of them

`apps/web/src/shell/nav-config.ts` types `NavItemId` as a **closed union of four scan ids**, and
`visibleNavGroups` resolves every destination through `SCAN_VAULT_PATH[landing]` and `canOpenView`.
Adding Pathology Gallery, Courses or Sage means widening that model, not appending a row. Half a
day, and it has to land first.
