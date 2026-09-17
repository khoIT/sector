---
phase: 1
title: Layout system and width measures
status: completed
priority: P1
effort: 4d
dependencies: []
---

# Phase 1: Layout system and width measures

## Overview

Take page width away from the shell and give it to each route through one
`PageFrame` primitive with three measures. Add `2xl` grid steps, make the Scan
Vault / groups tables usable on a phone, and build the 390/1440/2200 browser
sweep that every later phase is gated on.

> **Built 17 Sep 2026. Two things below turned out to be wrong; see the
> [phase report](./reports/from-implementation-to-review-260917-0200-phase-01-layout-system-report.md).**
>
> 1. **`PageFrame` per route root was replaced by `handle: { measure }` on the
>    route object**, applied once by the shell. A route root has several render
>    branches (skeleton, error, page) and a wrapper in one of them leaves the
>    others unmeasured; and a wrapper plus a test table is two sources that can
>    disagree. `PageFrame` was written, then deleted unused —
>    `pageMeasureClass` is what the shell applies.
> 2. **The 390px overflow was not the table.** Every candidate this file
>    eliminated was innocent, and so was the table: it scrolled inside its box
>    correctly. `sr-only` is `position: absolute`, the scroll container was
>    `position: static` and therefore not its containing block, so the labels
>    escaped the scroller and landed at the far edge of the table's own width.
>    One-line fix in `table-scroll-container.ts`, and the sweep's culprit
>    reporter had to be corrected too — it had been naming the innocent table.

## Requirements

**Functional**

- `PageFrame` in `@sector/ui` with `measure: 'reading' | 'working' | 'full'`.
- `apps/web/src/shell/app-shell.tsx:101` stops capping width; every route root
  declares its own measure.
- Grid steps at `2xl`: gallery 4 → 6, question banks 3 → 4, home panels 3 → 4,
  reviewer stat row already 4 → stays.
- `DataTable` renders a stacked card row under `sm`, driven by the same
  `ListColumn` model, so Scan Vault lists and the two groups tables all get it.
- Expert queue no longer scrolls the document sideways at 390px.
- `scripts/check/cold-load-sweep.mjs` runs each route at 390 / 1440 / 2200 and
  fails a route whose `documentElement.scrollWidth > clientWidth`.

**Non-functional**

- No route may depend on the removed 1400px cap; the measure is explicit per
  route or the route is wrong.
- Token contrast suite (`packages/ui`) unchanged — this phase touches layout,
  never colour.
- No API call changes, no new api-client schema, so
  `packages/api-client/src/fidelity/manifest.ts` is untouched. Stated, not
  assumed: nothing here adds an export to `packages/api-client/src/schemas`.

## Architecture

```
before:  AppShell ── <main> ── div.mx-auto.max-w-[1400px] ── <Outlet/>
                                  ^ one cap, every route, no opt-out

after:   AppShell ── <main> ── <Outlet/>
                                  │
             route root ── <PageFrame measure="reading|working|full">
                                  │
                            page content
```

`PageFrame` is a `div` with one of three class strings. No context, no
provider, no hook — a route that forgets it renders full-bleed, which the
sweep catches at 2200 as content wider than its declared measure.

```
reading  mx-auto w-full max-w-[42rem]    prose + single-column forms
working  mx-auto w-full max-w-[120rem]   lists, grids, dashboards (fluid to 1920)
full     w-full                          media surfaces, the course player
```

`42rem` is not invented: `question-bank-detail-page.tsx:49` and
`quiz-runner.tsx:58` already ship that exact cap for reading surfaces, so this
generalises a decision instead of adding a fourth one. Prose blocks keep their
own `max-w-[62ch]` clamps — `PageFrame` measures the PAGE, the clamp measures
the PARAGRAPH, and the two are not the same job.

Mobile table fallback lives in the app, not `@sector/ui`: `ListColumn` is
defined in `apps/web/src/features/scan-list/table/column-model.ts`, and moving
it into the package to host a card component there would invert the dependency
for no gain. One change in `data-table.tsx` reaches the Scan Vault lists,
`groups-index-page.tsx` and `members-surface.tsx`, which all render through it.

## Related Code Files

Create:

- `packages/ui/src/components/page-frame.tsx` — the primitive
- `packages/ui/src/components/page-measure.ts` — `pageMeasureClass(measure)`,
  pure, unit-testable in the node environment
- `packages/ui/src/components/page-measure.test.ts`
- `apps/web/src/features/scan-list/table/data-card-list.tsx` — the `<sm` fallback
- `apps/web/src/features/scan-list/table/card-columns.ts` +
  `card-columns.test.ts` — which columns a card shows, pure

Modify:

- `packages/ui/src/index.ts` — export `PageFrame`, `PageMeasure`
- `apps/web/src/shell/app-shell.tsx:101` — drop the wrapper div
- `apps/web/src/features/scan-list/table/data-table.tsx` — card list under `sm`
- Route roots, one `PageFrame` each:
  - `apps/web/src/features/home/home-route.tsx` (working)
  - `apps/web/src/features/account/profile-page.tsx:29` (reading — replaces `max-w-3xl`)
  - `apps/web/src/features/scan-list/scan-list-shell.tsx:34` (working)
  - `apps/web/src/features/scan-detail/scan-detail-page.tsx:83` (full — replaces its own `max-w-[1600px]`)
  - `apps/web/src/features/scan-detail/shared-scan-detail-page.tsx:41` (full, same)
  - `apps/web/src/features/courses/my-courses/my-courses-page.tsx:93` (working)
  - `apps/web/src/features/courses/shell/course-shell.tsx:100` (full)
  - `apps/web/src/features/courses/landing/course-landing-page.tsx:104` (working)
  - `apps/web/src/features/create-scan/create-scan-page.tsx:119` (working)
  - `apps/web/src/features/gallery/gallery-page.tsx:67` (working)
  - `apps/web/src/features/question-banks/pages/question-bank-list-page.tsx:19` (working)
  - `apps/web/src/features/question-banks/pages/question-bank-detail-page.tsx` (reading — replaces the three `max-w-[42rem]`)
  - `apps/web/src/features/groups/index/groups-index-page.tsx:145` (working)
  - `apps/web/src/features/groups/members/members-surface.tsx` (working)
  - `apps/web/src/features/groups/forms/group-courses-panel.tsx` (working)
  - `apps/web/src/features/groups/forms/group-assignments-panel.tsx` (working)
  - `apps/web/src/features/groups/exports/group-exports-panel.tsx` (working)
  - `apps/web/src/features/groups/settings/group-settings-page.tsx:43` (reading)
  - `apps/web/src/features/sage/sage-frame.tsx` (full)
  - `apps/web/src/features/courses/admin/course-read-only.tsx` (working)
  - `apps/web/src/routes/unbuilt-surface-page.tsx`, `app/not-found-page.tsx`,
    `app/retired-surface-page.tsx`, `app/route-error-page.tsx` (reading)
- Grid steps:
  - `apps/web/src/features/gallery/gallery-page.tsx:85,104,131` → add `2xl:grid-cols-6`
  - `apps/web/src/features/question-banks/pages/question-bank-list-page.tsx:24` → add `2xl:grid-cols-4`
  - `apps/web/src/features/home/my-learning-panel.tsx:88,161,209` → add `2xl:grid-cols-4`
  - `apps/web/src/features/home/scan-reviewer-home.tsx:58` → already `lg:grid-cols-4`, no change
- `scripts/check/cold-load-sweep.mjs` — multi-width loop + overflow assertion
- `README.md` §"One page load, before anything merges" — document the widths

Delete: none.

## Tests Before

`apps/web` and `packages/ui` both run vitest with `environment: 'node'` and
`include: ['src/**/*.test.ts']` (`apps/web/vitest.config.ts`,
`packages/ui/vitest.config.ts`). **No component can be rendered in a unit
test.** So the regression pins are pure-function tests plus the browser sweep;
do not add jsdom + a testing library for this phase.

1. `packages/ui/src/components/page-measure.test.ts` — write it against the
   not-yet-existing `pageMeasureClass`: `reading` caps, `working` caps,
   `full` does not, and an unknown value falls back to `working`.
2. `apps/web/src/features/scan-list/table/card-columns.test.ts` — the card
   shows the `alwaysVisible` column as its header and the remaining visible
   columns as label/value rows, in declaration order.
3. Baseline sweep, BEFORE any edit, at the three widths, output committed to
   `plans/260916-1705-sector-upgrade-features-and-ux/reports/`: the "before"
   overflow table. Expect `/scans/expert/unreviewed` to fail at 390.

## Refactor

1. `pageMeasureClass` + `PageFrame`, exported from `packages/ui/src/index.ts`.
2. Shell: delete the `max-w-[1400px]` wrapper, keep `<Suspense>` and
   `<Outlet/>` exactly as they are.
3. Route roots in one commit per feature area (courses, scans, groups,
   learn-misc, shell/error pages) so a bad measure is bisectable.
4. `DataTable`: below `sm` render `<DataCardList>`; from `sm` up render the
   table. Both from the same `columns` array — no second column source.
5. Grid steps.
6. Sweep script.

## Tests After

- `page-measure.test.ts` and `card-columns.test.ts` now pass.
- `apps/web/src/shell/route-measures.test.ts` (new, pure): a table of
  `{ routePath, measure }` asserted to cover every leaf path produced by
  `leafPaths(featureRoutes)` + `leafPaths(scanVaultRoutes)` — the same helper
  `apps/web/src/routes/feature-routes.test.ts` already defines. This is what
  stops a new route shipping with no declared measure; it does not render
  anything.
- Sweep rerun at three widths: 0 failures.

## Implementation Steps

1. `packages/ui/src/components/page-measure.ts`:

   ```ts
   export type PageMeasure = 'reading' | 'working' | 'full';
   const CLASS: Record<PageMeasure, string> = {
     reading: 'mx-auto w-full max-w-[42rem]',
     working: 'mx-auto w-full max-w-[120rem]',
     full: 'w-full',
   };
   export function pageMeasureClass(measure: PageMeasure = 'working'): string {
     return CLASS[measure] ?? CLASS.working;
   }
   ```

2. `page-frame.tsx`: `<div className={cn(pageMeasureClass(measure), className)}>`.
   Accept `asChild` only if a call site needs it — none does today, so do not
   add it (YAGNI).
3. Export both from `packages/ui/src/index.ts` beside `Toolbar`/`Stat`.
4. Shell: replace lines 101–105 with the `<Suspense>` block directly under
   `<main>`. Nothing else in `app-shell.tsx` changes.
5. Walk the route-root list above. Each page gains one wrapper; where the page
   already had its own cap (`profile-page.tsx` `max-w-3xl`,
   `scan-detail-page.tsx` `max-w-[1600px]`, `question-bank-detail-page.tsx`
   `max-w-[42rem]`), the wrapper REPLACES it — two caps on one page is the bug
   this phase exists to remove.
6. `data-card-list.tsx`:

   ```tsx
   // one <li> per row: the alwaysVisible column is the card head,
   // every other visible column is a dt/dd pair.
   <ul className="flex flex-col gap-2 sm:hidden">…</ul>
   ```

   and in `data-table.tsx` wrap the existing `<Table>` block in
   `<div className="hidden sm:block">`. Keep `loading` and `empty` handling
   ahead of the split so both paths share it.
7. **Diagnose the 390px overflow before changing it.** Run the sweep's culprit
   probe on `/scans/expert/unreviewed`:

   ```js
   const d = document.documentElement;
   [...document.querySelectorAll('*')]
     .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 1)
     .slice(0, 5)
     .map((el) => `${el.tagName}.${el.className}`);
   ```

   Candidates already eliminated by reading: `Table` does wrap in
   `overflow-x-auto` (`packages/ui/src/components/table.tsx:22`); the tab strip
   wraps (`scan-tab-bar.tsx:39` `flex-wrap`, labels collapse to icons under
   `lg`); the shell's content column carries `min-w-0`
   (`app-shell.tsx:80`); the toolbar's widest child is `min-w-[14rem]` = 224px.
   The most likely remaining cause is a flex/grid ancestor between
   `ScanListShell` and `DataTable` whose scroll container cannot resolve a
   width. Fix the ancestor; do not paper over it with `overflow-hidden`.
8. Grid steps — one line each, `2xl:` only, no other breakpoint touched.
9. Sweep script:

   ```js
   const WIDTHS = (process.env.SECTOR_SWEEP_WIDTHS ?? '390,1440,2200')
     .split(',').map(Number);
   const PRIMARY = Number(process.env.SECTOR_SWEEP_PRIMARY ?? 1440);
   ```

   At `PRIMARY` keep today's full assertion (settled text, no `.sv-skeleton`,
   quiet console). At the other widths do a short settle and assert only
   `scrollWidth <= clientWidth`, printing the widest offending element on
   failure. 35 routes × 3 widths is ~105 cold loads; the cheap non-primary pass
   is what keeps that tolerable.
10. Update the README paragraph with the new env vars and the widths.

## Regression Gate

```bash
pnpm --filter @sector/ui test
pnpm --filter @sector/web test
pnpm -w typecheck
pnpm -w lint
pnpm -w build
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

Browser sweep must report `N/N routes healthy` at 1440 and zero overflow rows
at 390 and 2200.

## Success Criteria

- [ ] `PageFrame` exported from `@sector/ui`; `app-shell.tsx` contains no
      `max-w-` on the content wrapper.
- [ ] Every leaf route path declares a measure; `route-measures.test.ts` green.
- [ ] No horizontal document scroll at 390px on the touched routes
      (`documentElement.scrollWidth <= clientWidth`), including
      `/scans/expert/unreviewed`.
- [ ] 3-width browser sweep (390 / 1440 / 2200) green, zero console errors.
- [ ] At 2200 no `working` route leaves more than 15% of the content panel
      empty on each side (spot-check: My Courses, groups index, expert queue).
- [ ] Scan Vault, groups index and group members render as cards under `sm`
      and as a table from `sm` up.
- [ ] `packages/api-client/src/fidelity/manifest.ts` unchanged.

## Risk Assessment

| Risk | L×I | Mitigation |
| --- | --- | --- |
| Removing the cap breaks a page that silently relied on it | H×M | The 2200 sweep runs on every route before merge; `route-measures.test.ts` makes an undeclared route a test failure, not a visual surprise |
| The 390px overflow has a cause none of the eliminated candidates covers | M×M | Step 7 diagnoses with a DOM probe first and reports the culprit; the fix is scoped to what the probe names |
| Card fallback and table drift apart | M×M | Both render from the same `columns` array; `card-columns.test.ts` pins the mapping |
| Sweep runtime triples and gets switched off | M×H | Only the primary width does the expensive settle; the other two do a short load plus one measurement |
| Netlify demo (staging API, 10 Sep) renders differently | L×M | Nothing here reads a route; layout only. Sweep the Netlify URL once at the three widths before calling the phase done |

**Rollback:** every change is additive except the shell wrapper deletion.
Revert order: sweep script → grid steps → route roots → `data-table.tsx` →
shell → `packages/ui`. Reverting the shell commit alone restores the old cap
while leaving `PageFrame` harmlessly in place (double-capping, not breakage).
