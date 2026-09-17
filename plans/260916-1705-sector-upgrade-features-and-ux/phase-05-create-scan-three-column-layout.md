---
phase: 5
title: Create-scan three-column layout
status: completed
priority: P2
effort: 2d
dependencies:
  - 1
---

# Phase 5: Create-scan three-column layout

## Overview

At `2xl` the study surface becomes three columns — files | findings + note |
expert review + routing — so a findings row stops stretching a label across
1,000px. On a phone the order is setup → files → findings → note → review with
a sticky submit bar.

## Requirements

**Functional**

- `2xl`: `files (22rem) | findings + clinical note (fluid) | review + routing (24rem)`.
- `xl`–`2xl`: today's two columns, unchanged.
- `< xl`: stacked, order setup → files → findings → note → review, with
  `CommitBar` sticky at the bottom of the viewport.
- A findings row's label-to-control span never exceeds ~70ch.
- The right column repeats a one-line routing summary (group / expert / neither)
  so the decision is visible without scrolling.

**Non-functional**

- **Draft persistence must not change.** Nothing under
  `apps/web/src/features/create-scan/model/` is edited in this phase — not
  `draft-storage.ts`, not `draft-blob-store.ts`, not `use-create-scan-draft.ts`,
  not `submit-draft.ts`. This is layout only.
- No API change, no new schema → `fidelity/manifest.ts` untouched.
- Strings introduced here are the routing-summary labels only; they go through
  `t()` in all seven locales. The wider create-scan i18n sweep is phase 8, and
  phase 8 depends on this phase so the strings settle first.

## Architecture

```
today (study-surface.tsx:112)
  grid gap-4 xl:items-start xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]
     ├── <StudyRail/>            files, viewer, xl:sticky xl:top-4
     └── column
           ├── <FindingsPanel/>            ← rows stretch to ~1000px at 2200
           ├── missing-required notice
           ├── <ClinicalNotePanel/>
           └── <ExpertReviewPanel/>

after
  grid gap-4 xl:items-start
       xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]
       2xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,24rem)]
     ├── <StudyRail/>                                   (col 1, sticky)
     ├── findings + notice + note                        (col 2)
     └── review column: <ExpertReviewPanel/> + routing summary   (col 3, sticky)
                        ▲ same element, moved by grid placement — NOT duplicated
```

`ExpertReviewPanel` is rendered once. Below `2xl` it is the last child of
column 2; at `2xl` it is the only child of column 3. Achieve that with grid
placement (`2xl:col-start-3 2xl:row-start-1`) on a wrapper, not by rendering the
component twice behind breakpoint visibility classes — two mounted copies would
each hold their own credit-purchase dialog state.

Findings rows already use container queries
(`components/finding-row.tsx:90-102`, `@md:` inside
`findings-panel.tsx:79`'s `@container`), so they adapt to the column they land
in with no change. The ~70ch ceiling comes from capping the findings panel's
label column, not from a viewport breakpoint.

## Related Code Files

Create:

- `apps/web/src/features/create-scan/components/routing-summary.tsx` — the
  one-line "where this study goes" strip
- `apps/web/src/features/create-scan/model/routing-summary-model.ts` +
  `routing-summary-model.test.ts` — pure: `(state) => { group, expert }` label
  keys, derived from the draft state the panels already read

Modify:

- `apps/web/src/features/create-scan/steps/study-surface.tsx:110-165` — the
  grid and the column assignment
- `apps/web/src/features/create-scan/components/study-rail.tsx:42` —
  `xl:sticky xl:top-4` stays; add `2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-y-auto`
  so a long file list scrolls inside the rail instead of fighting the page
- `apps/web/src/features/create-scan/components/findings-panel.tsx` — cap the
  label column so a row's label-to-control run stays ≤ ~70ch
- `apps/web/src/features/create-scan/components/expert-review-panel.tsx` — no
  logic change; accept `className` so the wrapper can place it
- `apps/web/src/features/create-scan/components/group-routing-panel.tsx` — feeds
  `routing-summary-model.ts`; no behaviour change
- `apps/web/src/features/create-scan/components/commit-bar.tsx` — sticky below
  `xl`
- `apps/web/src/features/create-scan/components/setup-bar.tsx` — confirm it
  stays first in the stacked order; no change expected
- `apps/web/src/features/create-scan/create-scan-page.tsx:119` — `PageFrame`
  already applied in phase 1; verify the measure is `working`
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json` —
  `createScan.routingSummary.*`

Delete: none.

## Tests Before

Node environment, `*.test.ts` only. No rendering. The point of these pins is
that the draft survives the layout change untouched.

1. Run and record green, before any edit:
   - `model/draft-storage.test.ts`
   - `model/draft-blob-store.test.ts`
   - `model/draft-blob-store-migration.test.ts`
   - `model/draft-holdings.test.ts`
   - `model/submit-draft.test.ts`
   - `model/readiness.test.ts`
   - `model/transfer-findings.test.ts`
   These must be byte-for-byte green after the phase; any change to them is a
   sign the phase strayed out of layout.
2. Extend `model/readiness.test.ts` with the exact readiness verdicts for:
   no scan type, type but no files, files but missing required findings, ready.
   The sticky `CommitBar` renders from these and must say the same things.
3. Sweep `/scans/create` at 390 / 1440 / 2200 and record the "before" state.

## Refactor

1. Grid template + wrapper placement in `study-surface.tsx` (pure layout
   commit; no component moves in the JSX tree).
2. `routing-summary-model.ts` + `routing-summary.tsx`.
3. Findings label cap.
4. Sticky commit bar.
5. Rail scroll region at `2xl`.

## Implementation Steps

1. `study-surface.tsx`, replace line 112-113's class string with:

   ```tsx
   className={cn(
     'grid gap-4 xl:items-start',
     'xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]',
     '2xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,24rem)]',
   )}
   ```

2. Split the current second child. Findings, the missing-required notice and
   `ClinicalNotePanel` stay in the existing
   `<div className="flex min-w-0 flex-col gap-4">`. Wrap `ExpertReviewPanel` in
   its own sibling:

   ```tsx
   <div className="flex min-w-0 flex-col gap-4 2xl:col-start-3 2xl:row-start-1 2xl:sticky 2xl:top-4">
     {user ? <ExpertReviewPanel …/> : null}
     <RoutingSummary state={state} />
   </div>
   ```

   Below `2xl` the grid has two columns, so this wrapper flows into column 2
   beneath the note — which is exactly the stacked order the requirement asks
   for. Verify at 1440 that it does not create a third empty track.
3. `routing-summary-model.ts`: read the fields `group-routing-panel.tsx` and
   `expert-review-panel.tsx` already read from draft state; return
   `{ groupLabelKey, expertLabelKey }` or nulls. Pure, no hooks — it is
   testable in the node environment, which a component is not.
4. `routing-summary.tsx`: a `rounded-token border border-line bg-surface p-3`
   block, `text-body text-ink-dim`, one line per decision, every string via
   `t('createScan.routingSummary.*')`.
5. Findings label cap in `findings-panel.tsx`: the row is already
   `@md:flex-row` with the controls at `@md:max-w-[60%]`
   (`finding-row.tsx:102`), so cap the LABEL side with `@md:max-w-[38ch]` on
   the label element. 38ch label + 60% controls keeps the eye's travel under
   ~70ch at any column width. Measure it at 2200 rather than trusting the
   arithmetic.
6. `commit-bar.tsx`: outer wrapper gains
   `sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface px-4 py-2 xl:static xl:mx-0 xl:border-t-0 xl:px-0`.
   The negative margin makes it span the page padding; drop it if
   `PageFrame`'s measure makes that read wrong.
7. `study-rail.tsx:42`: add `2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-y-auto`
   beside the existing `xl:sticky xl:top-4`.
8. Locale keys in all seven files. Zero additions to
   `locale-completeness-baseline.json`.
9. Do NOT open any file under `create-scan/model/` except the new
   `routing-summary-model.ts`. If a change there seems necessary, stop — it
   means the layout work has grown into behaviour work and needs its own phase.

## Tests After

- `routing-summary-model.test.ts`: group selected + expert requested; group
  only; expert only; neither; and an expert request with zero credits (the
  summary states the request, not the credit outcome — `ExpertReviewPanel`
  owns that).
- The seven pinned draft/model suites still green, unmodified.

## Regression Gate

```bash
pnpm --filter @sector/web test
pnpm -w typecheck
pnpm -w lint
pnpm -w build
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

Manual: start a study, attach two files, answer findings, reload the page
mid-draft and confirm the draft restores exactly as before (files listed,
findings kept, scan type kept); then submit against the local API.

## Success Criteria

- [ ] Three columns at 2200; two at 1440; stacked below `xl` in the order
      setup → files → findings → note → review.
- [ ] `ExpertReviewPanel` is mounted exactly once at every width (check React
      DevTools or a `data-testid` count in the sweep).
- [ ] A findings row's label-to-control run measures ≤ ~70ch at 2200.
- [ ] Submit is reachable without scrolling at 390 (sticky commit bar).
- [ ] Draft persistence unchanged: reload mid-draft restores files, findings,
      note and scan type; the seven pinned model suites pass unmodified.
- [ ] Nothing under `features/create-scan/model/` modified except the new
      `routing-summary-model.ts` (`git diff --stat` proves it).
- [ ] Zero additions to `locale-completeness-baseline.json`.
- [ ] No horizontal document scroll at 390px on `/scans/create`.
- [ ] 3-width browser sweep (390 / 1440 / 2200) green.

## Risk Assessment

| Risk | L×I | Mitigation |
| --- | --- | --- |
| Grid placement renders a third empty track at 1440 | M×M | The 3-col template only applies at `2xl`; verified in the 1440 sweep pass |
| `ExpertReviewPanel` accidentally duplicated behind visibility classes | M×H | Explicitly forbidden in step 2; success criterion counts mounts. A second copy would hold a second credit-purchase dialog and could double-charge intent |
| Sticky commit bar hides the last finding row | M×M | Add bottom padding to the findings column below `xl`; checked at 390 |
| Layout edit slips into draft logic | L×H | Model directory is off-limits; `git diff --stat` is a success criterion; seven suites pinned before the work starts |
| Rail scroll region traps the page scroll on a trackpad | L×M | Only at `2xl`, where the rail is shorter than the viewport for almost every study; same pattern the course player already ships |

**Rollback:** every commit is layout-only and independently revertible.
Reverting step 1 alone restores the two-column grid; `RoutingSummary` then
renders harmlessly at the bottom of column 2.
