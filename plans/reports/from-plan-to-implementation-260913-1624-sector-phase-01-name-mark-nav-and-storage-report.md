# Phase 1 executed — name, mark, nav model, persisted state

**Date** 13 Sep 2026 · **Branch** `feat/sector-phase-01` · **Plan** [260913-1451-sector-replaces-scanhub](../260913-1451-sector-replaces-scanhub/plan.md)

## Demo frozen first

Tag **`demo/scanvault-pre-sector`** at `566cf3e` — the last state under the ScanVault
name. `git checkout demo/scanvault-pre-sector && pnpm i && pnpm dev` restores it.

## Commits

| | |
|---|---|
| `e7fb835` | rename: workspace, packages, brand (156 files) |
| `8421905` | rail mark and favicon draw one geometry |
| `ce3121d` | persisted state survives the rename |
| `ce9de73` | the rail can carry a non-scan destination |
| `bc4fa4c` | plan corrections |
| `eb88f65` | a corrupt session signs the user out instead of white-screening |
| `ab024ad` `062c6ee` `029ec27` | Prettier: config, one-time format, lint gate |

## Verification

`pnpm -w typecheck` · `pnpm -w lint` green. Tests **320 → 526**:
web 350 (33 files), ui 82, api-client 94 passed / 11 skipped.

Real browser, Chromium against the running dev stack:

- Pre-rename `scanvault.theme=dark` → `sector.theme`, legacy key gone,
  `data-theme="dark"` actually applied. Five legacy localStorage keys moved, zero leftovers.
- `sector.create-scan.flow` already holding `study` was **not** clobbered by a stale `classic`.
- IndexedDB: a seeded legacy `scanvault.create-scan` holding `cardiac-clip.dcm` was copied on
  the first draft-file read — bytes intact — and the old database dropped. This is the path the
  code review could only prove against `fake-indexeddb`.
- Login page: title `Sector`, the wedge renders, no "ScanVault" in the DOM, zero console errors.

## Three classes of `scanvault` deliberately left alone

1. `ScanVaultView`, `SCAN_VAULT_*`, `scan-vault-routes.tsx`, the `scan-vault` nav id and the
   `nav.section` value "Scan Vault". Scan Vault is the **module**; Sector is the product.
2. `@scanvault.test` demo accounts — rows in the local database.
3. `submit-logs`' `details.source`, now the documented `LOG_SOURCE` constant. The API renders
   those entries into the submission email; anything querying the log by that field would
   silently stop matching. One line to flip once someone confirms nothing queries it.

## Corrections to the plan

- **8 storage keys, not 7.** `scanvault.theme` in `packages/ui` was missed; two of the eight
  live outside `apps/web`.
- **The IndexedDB rename cannot ride the boot sweep.** IndexedDB has no rename, so it is
  copy-then-drop and has to live inside `draft-blob-store.ts` or a reader reaches the new
  database before the copy finishes.

## Defect found and fixed during review

`copyLegacyRecords()` deleted the legacy database unconditionally after the copy loop, while
`runOnStore` swallows every failure into the same resolved fallback. A blocked upgrade or a
full quota destroyed the only copy of an unfinished study's bytes. Now: read failure is
distinguished from empty, each record is counted back in the new store, and the drop happens
only when every record is provably across. A partial copy self-heals on the next load.
Regression test verified to fail against the old body.

## Not done

The plan's browser pass — four demo accounts signing in, tab counts 2/4/6, new nav groups —
**is not run.** The demo password is not in the repo (`README.md:53` points at team notes).
Everything not requiring a credential is verified.

## Unresolved questions

1. **`details.source`** — does anything query the server-side user log by it? If not, flip
   `LOG_SOURCE` to `Sector`.
2. **Group Administration is gated on the group-queue permission**, by reference not by a
   copied literal. No seeded role carries a group-management string, so gating on one hides the
   entry from the people it is for. Right about *who*, wrong about *why* — give the surface its
   own permission before putting group data behind it.
3. ~~No Prettier config.~~ **Resolved.** `.prettierrc.json` + `.prettierignore` (which keeps
   `plans/` out, so the documented `pnpm format` can no longer reflow the record of what was
   decided), one mechanical reformat of 99 files, `.git-blame-ignore-revs` so blame skips it,
   and `prettier --check` folded into `pnpm lint`. Verified: eslint passes a double-quoted,
   oddly-spaced import that `prettier --check` rejects — that gap is what the gate closes.
4. ~~A corrupt session white-screens the app.~~ **Resolved** in `eb88f65`: `read()` validates
   against `authSessionSchema` instead of casting, and removes a value that fails. Three
   corrupt shapes verified in Chromium to land on `/login` with no page error.
5. **`i18n/language-store.ts` keeps the bare `language` key**, deliberately matching the legacy
   dashboard. Still wanted now the brand has moved?
6. **A long-running Vite dev server does not survive the package rename** — module resolution
   breaks until restart. Yours was serving 500s from 11 Sep; restarted.
