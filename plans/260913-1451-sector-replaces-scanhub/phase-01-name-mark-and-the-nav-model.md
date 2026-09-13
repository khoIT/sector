---
phase: 1
title: "Name, mark and the nav model"
status: completed
priority: P1
effort: "3 days"
dependencies: []
---

# Phase 1: Name, mark and the nav model

## Overview

Rename ScanVault to **Sector**, draw the mark, and widen the navigation model so
non-scan destinations can exist at all. Both jobs get more expensive every week —
the rename scales with the codebase, and the nav model blocks five later phases.

## Why Sector

The product is about to hold courses, quizzes, a gallery and group administration.
"Scan Vault" is already a module name inside ScanHub *and* an unreachable tab in
the old dashboard; using it for the whole platform guarantees an ambiguous sentence
in every conversation. Rationale and the rejected candidates are in the brainstorm
report.

The mark is the **phased-array sector** — the wedge that is literally the shape of
an ultrasound image. `--accent` (#EE7625) on `--scan-ground` (#14120F), both already
in the token file. Geometry and SVG in `design/` beside this plan.

## Requirements

- Functional: app presents as Sector everywhere a user can see; nav can carry a
  destination that is not a scan list; no user is signed out by the rename.
- Non-functional: rename is one mechanical commit, separable from behaviour changes.

## Related code files

- Modify: `package.json`, `apps/web/package.json`, `packages/*/package.json` —
  `scanvault` → `sector`, `@scanvault/*` → `@sector/*` (5 manifests)
- Modify: `CONTRACTS.md`, `README.md` — import specifiers and prose
- Modify: ~20 files under `apps/web/src` carrying the literal "ScanVault"
  (`shell/sidebar.tsx` brand mark, `shell/app-shell.tsx` document.title,
  `auth/login-page.tsx`, `app/not-found-page.tsx`, `app/route-error-page.tsx`, …)
- Modify: **8** storage keys — `scanvault.create-scan.draft`,
  `scanvault.create-scan.flow`, `scanvault.review-draft.`,
  `scanvault.scan-list.last-tab.`, `scanvault.scan-list.columns.`, the
  `scanvault.create-scan` IndexedDB database, the `scanvault.session` auth key,
  and `scanvault.theme` in `packages/ui/src/theme/theme-provider.tsx`, which
  this list originally missed. Two of the eight live outside `apps/web`.
- Modify: `apps/web/src/shell/nav-config.ts` — `NavItemId`, `NAV_GROUPS`,
  `visibleNavGroups`, `shellTitleKeyFor`
- Modify: `apps/web/src/features/scan-list/scan-list-views.ts` — `SCAN_VAULT_PATH`
  stops being the only destination table
- Create: `design/sector-mark.svg`, `design/sector-app-icon.svg`,
  `apps/web/public/favicon.svg`
- Create: `apps/web/src/shell/nav-destinations.ts` — the widened model

## Implementation steps

1. **Mark first.** Draw the wedge at 16, 32 and 512px; check the 16px favicon
   survives. Wordmark lockup for the rail.
2. **Rename the workspace.** Scopes, manifests, import specifiers, docs. One commit,
   no behaviour change, `pnpm -w typecheck && pnpm -w lint && pnpm -w test` green.
3. **Rename the user-visible strings**, including `document.title` (which is now
   `"<title> · ScanVault"` in `app-shell.tsx`) and the i18n brand key.
4. **Migrate storage keys.** Two mechanisms, because the stores differ in timing:
   a synchronous localStorage sweep at boot, before first render, and an
   IndexedDB migration inside `draft-blob-store.ts` itself — IndexedDB has no
   rename, so the module that owns the database has to own the copy-and-drop, or
   a reader can reach the new database before the copy finishes. A learner with a
   live 7-day create-scan draft must not lose it.
5. **Widen the nav model.** `NavItemId` stops being a closed union of four scan ids.
   A destination becomes `{ id, labelKey, icon, path, visibleWhen }` where
   `visibleWhen` is a permission predicate, and the scan entries keep resolving
   through `canOpenView` as a special case. Add the `Learn` and `Administer` groups
   with placeholder routes that render an honest "not built yet" panel.

## Tests / validation

- `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test` after step 2 and again at the end.
- New unit test: storage migration moves a populated draft and leaves nothing behind.
- New unit test for `visibleNavGroups` covering a non-scan destination gated on a
  permission the role lacks.
- Browser: all four demo accounts sign in **without re-authenticating**, see the
  correct tab counts (learner 2, leader 4, reviewer 6), and the new nav groups.

## Success criteria

- [x] Nothing user-visible says "ScanVault"; nothing in the workspace imports `@scanvault/*`
- [x] A pre-rename session and a pre-rename draft both survive the upgrade
- [x] A nav destination that is not a scan list renders and is permission-gated
- [x] Favicon legible at 16px in both light and dark browser chrome

### How each was met

Packages are `@sector/*`, the document title is `Sector`, and every remaining
"Scan Vault" string names the module, which keeps its name by design.
`migratePersistedStorage` runs from `main.tsx` and renames the session, theme,
draft and recovery keys; `draft-blob-store.ts` copies the legacy IndexedDB
database on first open. Both are covered by tests. The Learn and group
destinations render and are permission-gated, confirmed on a cold load of each
real URL. The favicon carries its own tile so it holds against light and dark
chrome; the depth arc resolves from about 24px and at 16px the mark reads as a
wedge, which is as much as a favicon does.

## Risk / rollback

Blast radius is wide but shallow — it is a rename plus one type widening. Keep them
as two commits so the nav change can be reverted without undoing the brand. The one
real risk is the storage migration: get it wrong and every user loses a draft on
first load, silently. Test it with a populated IndexedDB before merging.
