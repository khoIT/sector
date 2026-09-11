---
phase: 2
title: "Groups you can open"
status: pending
priority: P1
dependencies: []
---

# Phase 2: Groups you can open

## Overview

Make the `+N` badge on the Groups cell a control that opens the full list, and stop shipping
a 705-name string into a `title` attribute nobody can read.

## Requirements

- Functional: from any row, see every group the scan routes to, sorted, searchable once the
  list is long enough to need it; the count on the row stays accurate at 1 group and at 705.
- Non-functional: no new request — the names are already on the row; keyboard-reachable and
  screen-reader-labelled; the dialog opens from the row without navigating away.

## Architecture

`GroupsCell` today renders the first group's name, a `+N` badge, and a `title` holding every
name joined by commas. Measured on 31,495 scans:

| Groups on one scan | Scans |
|---|---|
| 1 | 20,923 |
| 2–9 | 5,307 |
| 10–99 | 210 |
| 700+ | 55 (max **705**) |

The long tail is not theoretical and it is not an import artefact — those are the
everyone-groups. A `title` tooltip cannot render 705 names; the browser truncates it and the
reviewer learns nothing.

`batchGetGroupsByScanIds` (`gusi_nodejs_api/src/app/scan/scan.mapper.ts:53`) returns every
group for every row with no `$limit` and no `$slice`, deduplicated. So the dialog is a pure
client-side expansion of data already in hand. It also means a 705-group row is already
costing the list response ~30 KB of names today — worth recording, not worth fixing here,
because capping it is a server change and a filter the reviewer cannot see.

Design: first name stays as the readable label. `+N` becomes a `<button>` styled as the badge
is now. It opens the existing `@scanvault/ui` Dialog listing every name, one per line,
alphabetically, in a scroll container. A filter input appears only when the list is longer
than 12 — below that it is one more thing to skip past. Plain list, no virtualisation: 705
rows of text is nothing, and a virtualiser here would be complexity bought for no user.

When a scan has exactly one group there is no button and no dialog; today's markup is right.

## Related Code Files

- Modify: `apps/web/src/features/scan-list/rows/list-cells.tsx` — `GroupsCell` drops the
  `title`, gains the button
- Create: `apps/web/src/features/scan-list/rows/scan-groups-dialog.tsx`
- Create: `apps/web/src/features/scan-list/rows/scan-groups-dialog.test.tsx`

## Implementation Steps

1. `scan-groups-dialog.tsx`: props `{ groups, scanTitle, open, onOpenChange }`. Sorts by name
   with `localeCompare`. Renders the count in the dialog title ("Groups — 705"). Shows the
   filter input only when `groups.length > 12`; filter is case-insensitive substring on name.
2. `GroupsCell`: hold `open` state, render the badge as a button with
   `aria-label={`Show all ${groups.length} groups`}`, remove the `title` attribute entirely.
3. Guard the empty-name case — a populated group with a blank `name` should render its id
   rather than an empty row, since `batchGetGroupsByScanIds` selects only `_id name`.
4. Test: 1 group renders no button; 3 groups render `+2` and the dialog lists all three; a
   long list renders the filter and narrows on input; sorting is applied.

## Tests / Validation

- `pnpm --filter @scanvault/web test`
- By eye on `/scans/group`: a `+1` row opens a two-name dialog; the dialog closes on Escape
  and returns focus to the badge

## Risk Assessment

- **The dialog opens from inside a table row.** Radix Dialog portals to the body, so the row
  click handler and the dialog do not nest; check that opening it does not also trigger the
  row's title link. The badge is not inside the `<Link>` today, so this should hold — verify.
- **A very long list is slow to sort on every render.** Memoise on `groups`.
- Rollback: revert; the cell falls back to the current badge and tooltip.
