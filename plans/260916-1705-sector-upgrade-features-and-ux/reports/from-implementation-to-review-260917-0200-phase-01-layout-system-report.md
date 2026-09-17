# Phase 1 — layout system and width measures

**Date:** 2026-09-17 · **Branch:** `main` · **Mode:** `/ck:cook --tdd` · **Stack:** web `:3102` → API `:5002` → `gusi_dev`

Evidence: [`sweep-260917-before-phase-01.txt`](./sweep-260917-before-phase-01.txt) ·
[`sweep-260917-after-phase-01.txt`](./sweep-260917-after-phase-01.txt)

## Result

| Measure | Before | After |
| --- | --- | --- |
| Horizontal-overflow findings (390 / 1440 / 2200) | **3** | **0** |
| Routes healthy at 1440 | 32 / 35 | **34 / 35** |
| Content width at 2200 on a working route | 1400 of 1960px panel (71%) | **1911 of 1960px (98%)** |
| Reviewed group queue at 390 | document 1356px wide, drags 966px | **fits 390px, renders as cards** |
| Tests | ui 133, web 984 | **ui 142, web 1003** |

The one remaining failure, `/learn/course-progress/<learnerId>/<courseId>` → "User not
found", is **pre-existing and unrelated**: it fails identically in the before-sweep. The
committed `sweep-routes.json` embeds a learner id that exists only in the mirror, which the
port-leftovers audit already recorded. Not fixed here — out of this phase's scope.

## The bug the sweep was built to find

The phase predicted a 390px overflow on the expert queue and listed candidates, all of which
turned out to be innocent. What it actually was:

`sr-only` is `position: absolute`. An absolutely positioned element is clipped by an
ancestor's `overflow` **only when that ancestor is also its containing block** — and the
table's scroll container was `position: static`, so it was not one. The accessible labels
inside a wide table therefore took their position from the shell's `relative` wrapper,
landed at the far edge of the table's own 1366px width, and dragged the document sideways.
The table itself scrolled inside its box exactly as designed.

Confirmed rather than argued, in the browser:

- `window.scrollTo(400, 0)` moved `window.scrollX` to 400 → a real user-visible drag, not a
  measurement artifact.
- `overflow-x: hidden` on the scroller changed **nothing** (1356px), which is what ruled out
  every "the table is too wide" explanation.
- `contain: paint` fixed it, and so did `position: relative` — both work by making the
  scroller a containing block.

Fix: `relative` on the container, in `packages/ui/src/components/table-scroll-container.ts`,
with the reason recorded next to it and pinned by a unit test. Extracted as a constant
precisely because a future reader would delete a "redundant" `relative` from JSX.

**This also falsified my own tooling.** The first culprit reporter listed elements whose box
extends past the viewport — which names the innocent table and hides the guilty label. It now
skips elements inside a scroll container, except those that escape one. Verified by
reinstating the bug in a live page: it names `span.sr-only [absolute] → 1604px`.

## Deviation from the phase file

The phase specified a `PageFrame` component wrapped around each of ~24 route roots, plus a
separate `{routePath, measure}` table for the test. Implemented instead as
`handle: { measure }` on the route objects, applied once by the shell.

Reasons, both found while doing it:

1. **Route roots have more than one render branch.** `course-landing-page.tsx` returns a
   skeleton, an error state and the page. A wrapper in the success branch leaves the other
   two unmeasured — and the loading state is when a width mistake is most visible.
2. **A wrapper plus a test table is two sources that can disagree.** With `handle`, the test
   walks the same objects the router walks, so "every route declares a measure" is a fact
   about the routes rather than a list somebody must remember to update.

`PageFrame` was written, then deleted unused; `pageMeasureClass` survives and is what the
shell applies. One further deviation: the read-only course-progress admin surface is
`reading`, not `working` — it capped itself at `max-w-xl`, which says reading.

## Changed

**New:** `packages/ui/src/components/page-measure.ts` (+ test),
`packages/ui/src/components/table-scroll-container.ts` (+ test),
`apps/web/src/routes/route-measure.ts`, `apps/web/src/routes/route-measures.test.ts`,
`apps/web/src/features/scan-list/table/card-columns.ts` (+ test),
`apps/web/src/features/scan-list/table/data-card-list.tsx`.

**Modified:** the shell (cap removed, measure applied), 11 route files (measures declared),
`packages/ui/src/components/table.tsx`, `data-table.tsx` (cards under `sm`), five pages whose
own caps the route measure replaces, four grid files (`2xl` steps),
`scripts/check/cold-load-sweep.mjs` (three widths, overflow assertion, non-zero exit),
`README.md`.

`packages/api-client/src/fidelity/manifest.ts` untouched, as the phase required.

## Gates

`pnpm -w typecheck` · `pnpm -w test` (1,373 passing) · `pnpm -w lint` · `pnpm -w format:check`
· `pnpm -w build` · 3-width sweep — all green.

## Unresolved questions

1. `sweep-routes.json` carries a mirror-only learner id, so one route can never pass against
   `gusi_dev`. Fix the fixture, or move the sweep to the mirror?
2. The card fallback switches at `sm` (640px). A 480–640px phone in landscape gets cards
   where a table might fit. Left at `sm` deliberately; revisit if anyone reports it.
3. `working` is capped at 120rem (1920px). On a 2560px monitor that leaves real gutter. Is
   1920 the right far edge, or should `working` be uncapped with only a padding gutter?
