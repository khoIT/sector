---
phase: 1
title: "One file count not two"
status: pending
priority: P1
dependencies: []
---

# Phase 1: One file count not two

## Overview

Delete the standalone Files column, keep its warning on the count that already sits under the
title, and turn the tag list beside it into something worth reading.

## Requirements

- Functional: no row shows its file count twice; a row short on files is still visibly short
  without opening it; tags render as labelled chips rather than raw database strings.
- Non-functional: no new dependency, no API change, no change to column-visibility storage
  beyond dropping one id.

## Architecture

`TitleCell` already prints `{fileCount}/{fileTotal} files` in the sub-line, in `text-ink-dim`.
`FilesCell` prints `{fileCount}/{fileTotal}` in its own column, in `text-warn` when short.
The column is the duplicate, but it holds the *signal* — so the warn tone moves into the
sub-line count and the column goes.

The tag list is a live contradiction today. `TitleCell` renders every tag on the scan, giving
`incomplete` a warn badge. Measured on 31,495 scans:

- 2,428 scans are tagged `incomplete` with **every file present**
- 2,651 scans are tagged `complete` while **short on files**
- 5,841 scans are short on files and carry **no tag at all**

So `complete` and `incomplete` are not a second opinion about completeness, they are noise
that will sit one word from a count that says the opposite. Both are dropped from the render.
What is left is worth showing: `expert_scan_review` (2,634), `resubmitted` (17), `dicom` (10).

Tag → label is a lookup, not a `replace(/_/g, ' ')`: `expert_scan_review` reads as
"Expert review", not "expert scan review".

## Related Code Files

- Modify: `apps/web/src/features/scan-list/rows/list-cells.tsx` — warn tone into `TitleCell`,
  tag rendering through the new map, delete `FilesCell`
- Modify: `apps/web/src/features/scan-list/rows/scan-columns.tsx` — remove the `files` column
- Modify: `apps/web/src/features/scan-list/rows/shared-scan-columns.tsx` — same column there;
  it is already `defaultHidden: true`, so nobody loses a column they had switched on
- Create: `apps/web/src/features/scan-list/rows/scan-tags.ts` — the label map and the
  suppressed set, with the measured counts as the comment that justifies the suppression
- Create: `apps/web/src/features/scan-list/rows/scan-tags.test.ts`

## Implementation Steps

1. Add `scan-tags.ts`: `SCAN_TAG_LABEL` (`expert_scan_review` → `Expert review`,
   `resubmitted` → `Resubmitted`, `dicom` → `DICOM`) and `displayTags(tags)` which drops
   `complete`/`incomplete` and any tag with no label, preserving input order.
2. In `TitleCell`, give the count `text-warn` when `fileTotal > 0 && fileCount < fileTotal`,
   and a `title` naming how many are missing. Keep `sv-num`.
3. Replace the inline `.map` over `tags` with `displayTags(tags)`, rendering each through
   `Badge tone="neutral"`.
4. Delete `FilesCell` and its two column entries. Grep for any other caller first.
5. Add `scan-tags.test.ts`: label mapping, suppression of both completeness tags, unknown tag
   dropped, order preserved.

## Tests / Validation

- `pnpm --filter @scanvault/web test` — new tag test plus the existing list tests
- `pnpm -w typecheck` — catches any missed `FilesCell` import
- By eye on `/scans/group`: the Files column is gone, a short row's count is amber, and a
  scan carrying `expert_scan_review` shows one chip reading "Expert review"

## Risk Assessment

- **A user had the Files column pinned on.** Only possible on Shared Scans, where it was
  hidden by default; the count survives under the title either way. Stale ids in the hidden
  set are ignored by `visibleColumns`, so no migration is needed.
- **Suppressing `complete`/`incomplete` hides something someone relies on.** The measurement
  above is the argument that nobody can be relying on it correctly. If it turns out a
  workflow keys on the tag rather than the count, the suppression is one entry in one set.
- Rollback: revert the commit; nothing is persisted and no contract changes.
