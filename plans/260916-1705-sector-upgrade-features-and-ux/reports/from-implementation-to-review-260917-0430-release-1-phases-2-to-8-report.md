# Release 1, phases 2–8 — implementation report

**Date:** 2026-09-17 · **Branch:** `main` (uncommitted) · **Mode:** `/ck:cook --tdd`
**Stack under test:** web `:3199` (built preview) → API `:5010` → `gusi_prod_mirror`

Phase 1's report is beside this one. This covers the rest of Release 1.

## Correction to the phase-1 report

That report names the stack as `:3102 → :5002 → gusi_dev`. It was not. The sweep
fixture's four user ids resolve **only** on `:5010` (`gusi_prod_mirror`); `:5002`
answers `403 User ID not found` for every one of them. So phase 1's sweep ran
against the mirror, as every sweep since has. The numbers in that report stand;
the stack line did not.

That also retires its unresolved question 1: the course-progress route was never
broken — `sweep-routes.json` holds mirror ids and the sweep has to run against
the mirror. It passes.

## Result

| Phase | What shipped | Verified |
| --- | --- | --- |
| 2 Course page merge | `/learn/courses/:id` leads with the description; modules expand in place; `/about` redirects | 11/8/8 modules, 1 open on load; expanding raises child links 14 → 76 without navigating; `/about` → course page, Back does not bounce |
| 3 My Courses density | grid/list toggle in the URL, compact card, 5 columns at `2xl` | list view 20 rows in 1,910px at 1440; toggle survives reload and search; 18 of 20 cards have a 6px strip, not a 230px placeholder |
| 4 Player layout | 3 columns at `2xl`, contents drawer below `lg`, sticky prev/next | 390: video top at 155px (was below the whole contents list), drawer opens → navigates → closes; 1440: `320px 815px`; 2200: `320px 1175px 384px` |
| 5 Create-scan | 3 columns at `2xl`, routing summary, sticky commit bar | 390 / 1440 / 2200 → `357px` / `352px 783px` / `352px 1143px 384px`; ExpertReviewPanel mounted once; Submit in viewport at 390 |
| 6 Command menu | ⌘K / Ctrl-K over nav + cached scans + cached courses | opens, filters, Enter navigates, Esc closes; **0 API calls** on open and while typing; a learner is never offered Group Administration |
| 7 Queue navigation | prev/next + `j`/`k` + row click, scoped to the list you came from | `5 of 3065` → `j` crosses the page boundary → `6 of 3065` → `k` returns; a direct link shows no stepper; the row menu does not navigate |
| 8 i18n sweep | every hard-coded string in three feature trees moved to keys in 7 locales | literal-text count **0 / 0 / 0**, enforced by a ratchet test |

Gates after every phase: `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w format:check`,
`pnpm -w build`, `pnpm -w test` — all green. Tests went **1,373 → 1,492**
(ui 142, api-client 228, web 1,122).

**Final cold-load sweep, built bundle, 36 routes × 390 / 1440 / 2200:**

| | phase 1 (before) | now |
| --- | --- | --- |
| Routes healthy at 1440 | 32 / 35 | **36 / 36** |
| Horizontal-overflow findings | 3 | **0** |

And a locale pass at 390 and 2200 — `de` on create-scan and scan detail, `es` on
create-scan, `fr` on My Courses — all translated, all `overflow=0`. German is the
longest-string locale and was the one the phase's risk table named.

**The German pass earned its keep.** It showed English on the scan-detail media
panel that the scanner had called clean: `title={x > 0 ? 'A' : 'B'}` — a ternary
inside a *translatable attribute*. The attribute check read only the top-level
expression, so it saw neither branch. Fixed (attribute expressions are now
searched, which is safe precisely because the attribute is already known to be
one a reader hears), which surfaced 6 more strings; those are translated and the
count is 0 again. Two of those, `'No preview available'` and `'No media on this
scan'`, were on screen in German a minute before.

## The phase-1 review, applied

The `code-reviewer` returned `DONE_WITH_CONCERNS`. Every finding was acted on:

- **The sweep could exit 0 having asserted nothing** — three paths (`WIDTHS` parsing
  to empty, a non-numeric `PRIMARY`, a `PRIMARY` absent from `WIDTHS`) all printed
  `0/0 routes healthy` and passed. Now `exit 2` with a message, and `PRIMARY` is
  forced into `WIDTHS`. Verified by running each.
- **Overflow was measured before render at the non-primary widths** — the settle
  loop dropped the `pending === 0` check off-primary, and skeletons are `w-full`,
  so an unrendered table reported as fitting. `pending === 0` is now required at
  every width, the cap is 8 iterations, and a measurement taken with placeholders
  on screen prints `unproven`.
- **`clipped()` misidentified the containing block** — it read the scroller's own
  `position` and ignored `transform`/`filter`/`contain`. It now resolves the real
  containing block first. (`contain: paint` was one of the two fixes that worked
  on the original bug, and the old code would have called it an escape.)
- **`routeMeasures()` could not see an index route under a pathless layout route** —
  the codebase wraps surfaces in `<RequirePermission>`, so an index child is
  regularly a grandchild. It now searches through pathless children only.
- **The measure test covered two of three mounting points** — `appShellRoutes` is
  extracted to its own module (importing `router.tsx` would evaluate
  `createBrowserRouter`, which needs a DOM the node suite has not got) and the
  test walks from the real root.
- **`full` left the course quiz left-pinned at wide widths** — `QuizRunner` and
  `QuizResults` capped themselves without centring. Both now `mx-auto`.
- **Both table renderers mounted on every device** — a 390px phone at `?limit=100`
  built 100 cards *and* an invisible 100-row table with a second row menu each.
  Now one renderer mounts, chosen by `useMediaQuery`. Crossing the breakpoint with
  a dialog open now unmounts it cleanly rather than orphaning it.
- **No sort below `sm`** — sorting lived only in the table header. The card list
  has a sort control.
- **`header: ''` produced an empty `<dt>`** — `cardColumns` now returns `actions`
  separately, rendered on their own line.
- **Nested scrollers in `group-progress-table.tsx`** — outer wrapper removed.
- The tautological `table-scroll-container` test was **kept**, as advised: it is a
  deletion tripwire and its comment carries the knowledge.

## Deviations, with reasons found while doing the work

1. **Phase 2 — the shell stopped rendering `CourseShellHeader` on the index route.**
   The course page has the real title and the real progress; the shell header has
   only a title carried in navigation state, so a deep link rendered "Course
   outline" above the course's actual name. `course-shell-header.tsx` is deleted,
   with `courses.outline.progress` / `.remaining` / `.resume.*` /
   `courses.landing.viewOutline` and `resumeActionLabelKey`, which it was the last
   caller of.
2. **Phase 4 — the third column appears at `2xl`, not `xl`.** At 1280 the contents
   pane (20rem) and the panel (24rem) leave the video ~500px, smaller than the
   two-column layout gives it. The plan's own risk table asked for this to be
   measured and moved if so. At 2200 the video is 1,175px.
3. **Phase 4 — the panel column is mounted, not hidden.** A `hidden xl:block` slot
   still exists in the DOM, so `createPortal` into it below the breakpoint would
   put the tabs inside `display: none` and lose them. The slot renders only when
   it is real.
4. **Phase 6 — no jsdom component tests.** Both vitest suites run
   `environment: 'node'` with `include: ['src/**/*.test.ts']`, so a `.test.tsx`
   cannot run and nothing can be rendered. The plan asked for
   `command-menu.test.tsx` and `topbar.test.tsx`. Instead: the pure modules are
   unit-tested (21 tests) and the interaction is verified in a real browser.
5. **Phase 7 — shared scans get no queue stepper.** Shared scans are keyed by
   *share* id, not scan id, and read through a different list hook; supporting them
   means a second queue-state shape. Excluded deliberately.
6. **Phase 7 — quiz views keep an inline prev/next.** A sticky bottom bar over a
   quiz's own Finish button is a worse page. Only topic and lesson views got the
   sticky variant.

## The scanner is the phase-8 deliverable, and it was wrong four times

`scripts/i18n/list-literal-text.ts` is what makes the zero mean anything, so it is
worth saying how it got there. Each round found real strings the round before had
missed, and each fix was checked against the files it changed:

| Round | Count | What it had been missing |
| --- | --- | --- |
| 1 | 255 | — (JSX text and a few attributes) |
| 2 | 965 | added JSX-expression literals (`{busy ? 'Saving…' : 'Save'}`) — but descended into nested JSX and swept up every `cn('flex …')` |
| 3 | 341 | stopped at nested JSX; skipped comparison operands, tag-name bindings and call arguments |
| 4 | **288** | added template literals (`` title={`Cannot preview ${x}`} ``) and the `detail`/`description` copy props |

Known limits, stated rather than hidden: strings in module-level data never pass
through JSX and are invisible to it — `create-scan-flow-setting.tsx`'s two flow
descriptions were exactly that, and were found by reading, not by the tool. The
same applies to `readiness.ts` and `submit-facts.ts`; `readiness.ts` now returns
`labelKey`, and `submit-facts.ts` still builds English (it is rendered as data by
`submit-confirm-dialog`, and is listed below as remaining work).

## Changed

New: `page-measure.ts`, `table-scroll-container.ts`, `route-measure.ts`,
`app-shell-routes.tsx`, `card-columns.ts`, `data-card-list.tsx`,
`row-activation.ts`, `use-media-query.ts`, `editable-target.ts`,
`module-row-state.ts`, `course-card-model.ts`, `course-facts.tsx`,
`course-list-row.tsx`, `course-layout-toggle.tsx`, `html-text.ts`,
`player-layout.tsx`, `contents-drawer.tsx`, `player-position.ts`,
`routing-summary.tsx`, `routing-summary-model.ts`, `course-about-redirect.tsx`,
`queue-position.ts`, `queue-nav.tsx`, `use-queue-hotkeys.ts`,
`command-menu/*` (5 files), `scripts/i18n/list-literal-text.ts` — each with tests
where the node environment allows one.

Deleted: `course-outline-page.tsx`, `course-outline-item-row.tsx`,
`course-shell-header.tsx`.

`packages/api-client/src/fidelity/manifest.ts` untouched throughout — no phase in
Release 1 added or widened a schema.

## Not done, and why

Phases 9–17 are **not** startable in this repository:

- **9, 10, 11, 12, 13** are server-guard-first by design. Each begins with a
  missing authorization check in `gusi_nodejs_api` — a separate git repo, currently
  on `feat/ctp-1119-reviewer-access-control` with uncommitted changes. The plan
  sequences them behind the cutover plan's phase 11 (deploy `feat/sector-*` to
  staging), which has not happened.
- **14** reads as web work but is not: the Vimeo caption file needs the account
  token and returns a signed, expiring URL, so it needs a new API route that
  proxies, parses VTT and caches.
- **15, 16, 17** are gated on decisions nobody in this session can make: media
  access from the Vimeo account owner, a named observable for Notes, and the
  `CERTIFICATE_DOWNLOAD_MAINTENANCE` flag owner.

Two of those guards are worth reading before anything else in the backlog, because
both are live on production today:

- `POST`/`DELETE /api/scan/:scanId/tags` carry `edit:scan` and nothing else, and
  **every role in the production mirror holds `edit:scan`** — any authenticated
  account can flip the completeness tag on any scan id.
- `POST /api/scan-review/request-expert` never compares the caller to the scan's
  owner. A stranger can spend their own credit on someone else's scan, and the
  `group` branch then links that scan into the *caller's* group — another learner's
  study in front of reviewers who should never have seen it. That is a data
  exposure, not only a credit-spend bug.

## Unresolved questions

1. The two authorization holes above are real today, independent of this plan.
   Do they get their own fix now, ahead of the Release 2 sequencing?
2. `working` is capped at 120rem (1920px). On a 2560px monitor that leaves real
   gutter. Is 1920 the right far edge, or should `working` be uncapped with only a
   padding gutter? (Carried from phase 1; a product call.)
3. The card fallback switches at `sm` (640px), so a 480–640px phone in landscape
   gets cards where a table might fit. Left at `sm` deliberately.
4. New clinical terms were translated by reusing vocabulary already in the bundles.
   A clinician should read the six non-English `createScan.findings.*` and
   `scanDetail.review.*` strings before this goes to real learners.
5. `submit-facts.ts` still builds English sentences as data (`'None of N in
   storage yet'`). The scanner cannot see them and the confirm dialog renders them.
   Worth a follow-up; it changes a pinned model and its 14 tests.
6. Component-level tests are impossible in this repo (`environment: 'node'`,
   `*.test.ts` only). Three phases now rely on browser verification instead. Is a
   jsdom project worth adding to `vitest.config.ts`?
