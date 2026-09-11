---
phase: 3
title: "The actions a row needs"
status: pending
priority: P1
dependencies: []
---

# Phase 3: The actions a row needs

## Overview

Give every list row the actions its legacy twin has — Open, Share, Download, Comment — behind
one menu, permission-gated, without moving anything off the scan's own page that belongs
there. Delete is Phase 4.

## Requirements

- Functional: the four non-destructive actions work from every view that has them in the
  legacy dashboard; Download produces the same archive the legacy dashboard produces; Share
  and Comment reuse the surfaces the detail page already has rather than growing second
  copies.
- Non-functional: the menu is keyboard-operable and labelled; no action fires without the
  permission the server requires; a failed download says so.

## Architecture

### The matrix, read off the legacy source

Verified 12 Sep, one `data-table-row-actions.tsx` per view:

| View | Open | Share | Download | Comment | Delete | Also |
|---|---|---|---|---|---|---|
| My Scans | ✓ | ✓ | ✓ | ✓ | ✓ | request expert review, logs, reset upload |
| Group queue (pending) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Reviewed | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Shared with me | ✓ | — | ✓ | ✓ | — | — |
| Expert queue | ✓ | ✓ | ✓ | ✓ | — | AI review generator |
| Expert reviewed | ✓ | ✓ | ✓ | ✓ | ✓ | AI review generator |

The three "also" columns are out of scope here: logs and reset-upload are recovery tools that
belong on the scan, and the AI review generator is one of the AI surfaces the parity audit
already has open. Delete is Phase 4.

### Shape

`Assess` stays a visible primary button on the queues — it is the action the queue exists for
and burying it in a menu would be a regression. Everything else goes behind a `⋮` trigger
beside it. On non-queue views the primary is `Open` / `Open review`, unchanged, plus the menu.

`packages/ui` has Dialog, Select and Tabs from Radix but no menu. Add
`@radix-ui/react-dropdown-menu` and a `dropdown-menu.tsx` wrapper styled from the tokens —
`--surface` ground, `--line` border, `--radius`, `--accent-ink` focus ring. It is the same
pattern as the existing `select.tsx`; follow it rather than inventing a second one.

### Download

Both legacy hooks are worth copying exactly once each:

- one file → fetch the blob, `saveAs(blob, filename)`
- more than one → `JSZip`, one entry per file, `saveAs(zip, `${scan.title}.zip`)`

`jszip` and `file-saver` are both dynamically imported in the legacy implementation
(`gusi_web_dashboard/src/lib/file-utils.ts:166`), which keeps them out of the main bundle;
do the same. The URLs come straight off the row — `scan.files[].url` is on the list schema
(`packages/api-client/src/schemas/scan.ts:277`) and on the shared-scan list schema
(`schemas/shared-scan-list.ts:41`) — so Download needs no detail fetch.

Two failure modes the legacy implementation swallows and this one must not:

1. **A presigned URL that 403s.** Every scan submitted after 2025-11-10 in the current local
   setup answers 403, because `gusi_dev` holds production records while `.env` points at the
   staging bucket (`docs/local-setup-lms.md`). A partial zip must not be presented as a
   complete one — report which files failed, by name.
2. **A row with zero files.** Disable the item rather than producing an empty archive.

Duplicate filenames inside one scan are possible (the create-scan wizard de-duplicates, but
old data was not written by it) — suffix on collision rather than letting JSZip overwrite.

### Share and Comment

Both already exist as panels on the detail page: `scan-share-panel.tsx` and
`scan-notes-thread.tsx`. Lift each into a component that renders the same body inside a
Dialog, and have the detail page render the same component inline. One implementation, two
mounts — not a copy.

Notes are separately permissioned (`read:scan:note`, `create:scan:note`), so the Comment item
is gated on `read:scan:note`, and the composer inside it on `create:scan:note`. All five roles
hold both today, so the gate is defensive rather than load-bearing.

## Related Code Files

- Create: `packages/ui/src/components/dropdown-menu.tsx` + export from `packages/ui/src/index.ts`
- Modify: `packages/ui/package.json` — add `@radix-ui/react-dropdown-menu`
- Create: `apps/web/src/features/scan-list/rows/scan-row-menu.tsx` — the per-view matrix
- Create: `apps/web/src/lib/download-scan-files.ts` + `download-scan-files.test.ts`
- Create: `apps/web/src/features/scan-detail/components/scan-share-dialog.tsx`,
  `scan-notes-dialog.tsx` — thin Dialog wrappers over the existing panel bodies
- Modify: `apps/web/src/features/scan-list/rows/row-actions.tsx` — `AssessAction` keeps its
  own rules, gains the menu beside it
- Modify: `scan-columns.tsx`, `shared-scan-columns.tsx` — actions cell renders the menu
- Modify: `apps/web/package.json` — `jszip`, `file-saver`, `@types/file-saver`

## Implementation Steps

1. Add the Radix dependency and `dropdown-menu.tsx`; mirror `select.tsx` for tone, focus ring
   and dark-mode tokens. Contrast test must stay green.
2. `download-scan-files.ts`: `downloadScanFiles({ files, zipName })`. Single-file path, zip
   path, per-file failure collection, collision suffixing. Dynamic imports.
3. Unit-test it against a stubbed `fetch`: one file, many files, one 403 among many, zero
   files, two identical filenames.
4. Extract the share and notes dialogs; re-point the detail page at the shared components and
   confirm the detail page renders unchanged.
5. `scan-row-menu.tsx`: takes `{ scan, view, user, returnUrl }`, resolves the matrix above,
   renders only the items that view allows and the user is permitted.
6. Wire it into both column factories. Shared Scans passes `share.scan` for files and title
   but the share id for navigation — keep those straight.
7. Test the matrix: each view renders exactly its expected item set; no Share on Shared Scans;
   Comment hidden without `read:scan:note`.

## Tests / Validation

- `pnpm --filter @scanvault/api-client test`, `--filter @scanvault/web test`, `-w typecheck`,
  `lint`, `build`
- `pnpm --filter @scanvault/ui test` — the token contrast gate covers the new menu surface
- By hand against staging: download a 1-file scan and a 3-file scan, and one scan known to
  403, and confirm the third names the file that failed

## Risk Assessment

- **Bundle size.** `jszip` is ~100 KB gzipped. Dynamic import keeps it off the first paint;
  verify with `pnpm --filter @scanvault/web build` that it lands in its own chunk.
- **Zipping large videos in the browser.** A 3-file scan of 28 MB clips is ~84 MB held in
  memory. Legacy has the same ceiling and nobody has hit it; note it, do not pre-solve it.
- **Menu inside a row with a link.** Radix portals the content; check that opening the menu
  does not navigate.
- Rollback: the menu is additive — revert `scan-row-menu.tsx` and the two column edits and the
  rows return to a single primary button.
