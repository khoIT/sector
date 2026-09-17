---
phase: 7
title: Queue navigation
status: completed
priority: P2
effort: 1.5d
dependencies:
  - 1
---

# Phase 7: Queue navigation

## Overview

Step through a scan list from the detail page: Previous / Next buttons and
`j` / `k` keys move to the adjacent scan in the list the reviewer came from,
and clicking anywhere on a list row opens the scan. Both existed in the legacy
dashboard and are open parity items. Client-only.

## Requirements

**Functional**

- On any scan detail page reached from a list, show `← Previous` / `Next →`
  with a position indicator (`3 of 20`), scoped to the list view, its
  filters, sort and page the user was on.
- `j` = next, `k` = previous, ignored while focus is in an editable element or
  a dialog is open.
- At the end of a page, Next loads the next page's first scan when there is
  one; at the end of the list the button is disabled.
- Row click opens the scan; interactive cells (menu, checkbox, links inside
  the row) keep their own behaviour and stop propagation.
- Reached directly (bookmark, email link): no prev/next, no indicator.

**Non-functional**

- The list position rides in `location.state` (`{ from: ListUrlState & { view } , index }`),
  not in the URL, so emailed scan links stay clean and unchanged.
- Adjacent scan resolution reuses the list query already in the TanStack
  cache; a page boundary triggers the same list query for `page ± 1` through
  the existing hooks, nothing bespoke.
- Strings under `scanDetail.queueNav.*` in seven locales.

## Architecture

```
scan-list/table  row <Link state={{ from, index }}>  ──►  scan-detail-page.tsx
                                                            │
                                                            ▼
                                     scan-detail/queue-position.ts   (pure)
                                       resolveNeighbours(listPage, index, total)
                                       → { prevId?, nextId?, position, total, needsPage?: n }
                                                            │
                                                            ▼
                                     scan-detail/components/queue-nav.tsx
                                       buttons + indicator + useQueueHotkeys()
```

`from` is the serialized `ListUrlState` (page, limit, sort, filters, keyword)
plus the view id from `scan-list-views.ts`, so the detail page can call the
same list hook the table used and get the same ordering.

## Related Code Files

- Create: `apps/web/src/features/scan-detail/queue-position.ts`
- Create: `apps/web/src/features/scan-detail/queue-position.test.ts`
- Create: `apps/web/src/features/scan-detail/components/queue-nav.tsx`
- Create: `apps/web/src/features/scan-detail/components/use-queue-hotkeys.ts`
- Modify: `apps/web/src/features/scan-detail/scan-detail-page.tsx`
- Modify: `apps/web/src/features/scan-detail/shared-scan-detail-page.tsx`
- Modify: `apps/web/src/features/scan-list/rows/scan-columns.tsx` and
  `shared-scan-columns.tsx` (title link carries `state`)
- Modify: the table row component under `apps/web/src/features/scan-list/table/`
  (row `onClick` → navigate; `data-interactive` cells stop propagation)
- Modify: `apps/web/src/features/scan-list/table/list-url-state.ts` (export a
  `serializeListState()` helper if one does not exist; verify first)
- Modify: `apps/web/src/i18n/locales/*.json`

## Tests Before

- `list-url-state` tests exist; add round-trip cases for the exact state
  object rows will carry, so a later change to filter encoding fails here.
- `scan-row-actions.test.ts` and `scan-columns` render tests pin the current
  row menu behaviour; add an assertion that clicking the row menu trigger does
  NOT navigate (the new row-click must not regress it).
- Detail page render test (new if absent): renders without `location.state`
  and shows no queue nav.

## Refactor

- Title link in the columns passes `state`; the row gets an `onClick` that
  navigates unless the event originated inside `[data-interactive]`.
- Detail pages render `<QueueNav/>` only when `location.state?.from` parses.

## Tests After

- `queue-position.test.ts`: first/last on a page, page boundary asks for
  `needsPage`, position math, list shorter than index (row deleted meanwhile).
- `queue-nav.test.tsx`: `j`/`k` navigate; keys ignored inside `<textarea>`
  and while a Radix dialog is open; disabled at list end.
- Row click test: click on cell text navigates; click on menu trigger,
  checkbox, or inner link does not.

## Implementation Steps

1. `queue-position.ts` + tests.
2. Serialize list state in the row link `state`; row-level click handler with
   interactive-cell guard.
3. `queue-nav.tsx`: buttons, indicator, hotkeys; page-boundary fetch through
   the existing list hook.
4. Mount in both detail pages beneath the back link, right-aligned; on
   `< sm` collapse to icon buttons.
5. Locale keys; sweep at three widths.

## Regression Gate

```
pnpm --filter @sector/web test -- src/features/scan-detail src/features/scan-list
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] From Expert Scans › Unreviewed, a reviewer can step the whole queue with
      `j` without returning to the list; position indicator stays correct
      across a page boundary.
- [ ] Emailed scan links render exactly as before (no nav, no indicator).
- [ ] Row click opens the scan; row menu, checkboxes and inner links unchanged.
- [ ] No horizontal document scroll at 390px on list and detail; sweep green.
- [ ] Locale parity for `scanDetail.queueNav.*`.

## Risk Assessment

- **List changes underneath the reviewer** (a scan reviewed by someone else
  drops out of Unreviewed) → neighbours resolve against the cached page; if
  the target id is gone the detail 404 page offers the list link. Acceptable.
- **Hotkey collisions** with the review textarea → editable-target guard, and
  hotkeys are off while any dialog is open.
- **Row-click swallowing a selection click** → interactive cells marked and
  guarded; test covers it.
