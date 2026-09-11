---
title: "Scan list: rows, groups and actions"
description: "Close the gap between the Scan Vault list and the legacy dashboard's row: drop the duplicated file count, make groups readable past the first name, and give every row the five actions the original has."
status: pending
priority: P1
branch: "main"
tags: [scan-vault, scan-list, parity, row-actions]
blockedBy: []
blocks: []
created: "2026-09-11T20:42:32.088Z"
createdBy: "ck:plan"
source: skill
---

# Scan list: rows, groups and actions

## Overview

The Scan Vault list is ahead of the legacy dashboard on triage — one parameterised column
factory instead of six drifting copies, a Waiting column that sorts correctly, honest empty
states. It is **behind** it on what a row lets you *do*. A legacy row offers five actions;
ours offers one. A legacy row is also missing things ours has, so this is not a copy job.

Three defects, all visible in the group-queue screenshot:

1. **The file count is printed twice** — `3/3 files` under the title and `3/3` in its own
   column, one word apart. The column is the redundant one; the sub-line is the one with
   room for the tags beside it.
2. **Groups stop at the first name.** The rest is a `+N` badge whose only expansion is a
   `title` tooltip. One scan in this database belongs to **705 groups**; 55 scans are past
   700. A 705-name tooltip is not an expansion.
3. **One action, `Assess`.** The legacy row has Open Scan, Share, Download, Comment and
   Delete Scan. Scan Vault has no download path at all and no delete endpoint in
   `packages/api-client`.

Phase 5 carries the row-metadata design already drafted and awaiting review; it touches the
same two files as Phase 1, so it is sequenced behind it rather than run alongside.

## What the data says

Measured against the local `gusi_dev` database (31,495 scans), read-only:

| Question | Answer | Consequence |
|---|---|---|
| Do the `complete`/`incomplete` tags agree with `fileCount`/`fileTotal`? | **No. They disagree on 5,115 scans** — 2,651 are short on files but tagged `complete`; 2,428 have every file but are tagged `incomplete` | Never render those two tags. They contradict the count printed beside them. Phase 1 |
| Which tags are worth a chip? | `expert_scan_review` 2,634, `resubmitted` 17, `dicom` 10 | Only `expert_scan_review` earns permanent space; the other two are rare but cheap |
| How many scans are in more than one group? | 10,572 of 31,495 (33.6%). Max **705** | `+N` has to open something. Phase 2 |
| Does the list route cap the groups it returns? | No. `batchGetGroupsByScanIds` returns every row's full set | The dialog needs no new fetch — and a 705-group row ships ~30 KB of names |
| Who can call `DELETE /api/scan/:id/delete`? | It requires `delete:scan` — **which all five roles hold** — and the controller does **no ownership check** | The permission bit gates nobody. Phase 4 gates on the owner client-side |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [One file count not two](./phase-01-one-file-count-not-two.md) | Pending |
| 2 | [Groups you can open](./phase-02-groups-you-can-open.md) | Pending |
| 3 | [The actions a row needs](./phase-03-the-actions-a-row-needs.md) | Pending |
| 4 | [Delete gated on the owner](./phase-04-delete-gated-on-the-owner.md) | Pending |
| 5 | [Metadata the reviewer triages on](./phase-05-metadata-the-reviewer-triages-on.md) | Pending |

## Dependencies

- Phases 1 and 2 are independent of everything and of each other. Either can ship alone.
- Phase 4 depends on Phase 3: the Delete item needs the menu Phase 3 builds.
- Phase 5 edits `list-cells.tsx` and `scan-columns.tsx`, the same files as Phase 1. Sequence
  them; do not run both at once.
- Phase 5 is **gated on the row-metadata design being accepted**. Everything else is ready.
- No server change in any phase. The one server defect found (delete has no ownership check)
  is recorded in Phase 4 for the API backlog, not fixed here.

## Acceptance criteria

- [ ] No row prints its file count twice, and a short-file row is still visibly short
- [ ] Every group a scan belongs to is reachable in two clicks, at 1 group or at 705
- [ ] Every list view offers exactly the actions its legacy twin offers, minus the ones the
      server cannot authorise safely, and each is permission-gated on this side
- [ ] Download produces the same archive as the legacy dashboard for the same scan
- [ ] Delete never appears on a row the signed-in user does not own
- [ ] `pnpm -w typecheck`, `lint`, `test`, `build` green; contrast gate green

## Source material

- Legacy row actions, one file per view, verified 12 Sep:
  `gusi_web_dashboard/src/pages/dashboard/scans/{my-scans,pending-scans,reviewed-scans,shared-scans,expert-scans,expert-reviewed-scans}/components/data-table-row-actions.tsx`
- `gusi_nodejs_api/src/app/scan/scan.route.ts:32` — the delete route and its permission
- `gusi_nodejs_api/src/app/scan/scan.mapper.ts:53` — `batchGetGroupsByScanIds`, uncapped
- [Create Scan Study, redrawn](../260912-0321-create-scan-study-redesign/plan.md) — the
  create-side plan; no file overlap with this one
