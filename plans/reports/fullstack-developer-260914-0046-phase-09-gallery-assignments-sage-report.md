# Phase 9: pathology gallery, group assignments, Sage frame

Plan: `plans/260913-1451-sector-replaces-scanhub/phase-09-assignments-gallery-and-sage.md`
Branches: `feat/sector-phase-09` (scanvault, off `feat/sector`), `feat/sector-pathology-taxonomy` (API, off `feat/sector-api`)
Worktrees: `scratchpad/wt/phase-09`, `scratchpad/wt/api-pathology`

## Summary

Gave `pathologygalleries` a real `scanTypeId` relation, backfilled it against the local
mirror (1,288/1,305 mapped, 17 reported unmapped — matches the plan's pre-measured
numbers exactly), rewrote the category endpoint to serve from that relation with a
5-minute cache, and deleted nothing client-side because there was no whitelist to
delete — Sector never had one; this port built the gallery without ever introducing it.
Ported the gallery, a read-only per-group assignments table, and the Sage AI iframe.
All three fully translated across seven locales. Verified against a real API instance
(not the shared mirror) and a real browser.

## API repo (`feat/sector-pathology-taxonomy`)

- `src/database/pathology-gallery/pathology-gallery.model.ts` — added `scanTypeId`
  (ObjectId ref ScanType, nullable), compound index `{scanTypeId, status}`.
- `src/database/pathology-gallery/pathology-gallery.service.ts` — `getPublishedScanTypeIds()`,
  `getUnmappedCategoryNames()`, `setScanTypeIdForCategory()` (migration-only), `scanTypeId`
  added to `GetAllQuery`.
- `src/app/pathology-gallery/pathology-gallery.schema.ts` — `scanTypeId` on create/update
  bodies and the list query.
- `src/app/pathology-gallery/pathology-gallery.controller.ts` — `getPathologies` prefers
  `scanTypeId` over `category` when both could apply; `getPathologyCategories` rewritten:
  joins distinct `scanTypeId`s (published only) against ScanType for name + presigned icon,
  appends unmapped `category` names with `id: null`, sorts by name, caches the result
  in-process for 5 minutes (`resetPathologyCategoriesCache()` exported for tests).
- `scripts/db/backfill-pathology-scan-type.ts` — new migration. Loopback-only guard
  (refuses non-localhost hosts and any `mongodb.net` host outright), `--dry-run` support,
  matches by exact case-insensitive name, prefers a scan type's v2 document over v1 when
  both exist (so one category name converges on one scan type, not one button per
  version), reports mapped/unmapped by name and count rather than guessing.
- `tests/functional/pathology-gallery/get-pathology-categories.test.ts` — 5 tests: 401
  without auth, scanTypeId-relation category served with a presigned icon, an unmapped
  category kept visible (not dropped), draft items excluded, and the cache genuinely
  delays a newly-published category until reset.
- Module `README.md`s added per repo convention (`src/app/pathology-gallery/`,
  `src/database/pathology-gallery/`).

**Migration run against `gusi_prod_mirror` (localhost only)**, dry-run then live:

```
Categories examined: 15
Documents mapped: 1288
  AAA(28) DVT(73) Echo(296) FASH(40) FAST(143) GI(56) Gallbladder(135)
  Lung(181) MSK(124) OB 1st Tri(92) OB 2nd/3rd(23) Renal(47) Soft Tissue(50)
Categories with NO matching scan type (left unmapped, not guessed): 2
  "FAST/EFAST" — 2 items
  "Rapid Reviews" — 15 items
Total unmapped documents: 17
```

Matches the plan's pre-measured numbers exactly. Both unmapped categories are exactly
the two the plan flagged as pending a clinical/product decision (see Unresolved below);
neither was guessed at.

## Client (`feat/sector-phase-09`)

`packages/api-client`:
- `schemas/pathology.ts`, `endpoints/pathology.ts`, `react/use-pathology-gallery.ts` —
  category/list/sub-category schemas and hooks. `scanTypeId` modelled `.nullish()` after
  the fidelity replay found 17 raw documents with the field entirely absent (not `null`)
  — the live API sends `null` via the model's schema default, but the 17 unmapped items
  predate the field at the storage layer.
- `schemas/assignment.ts`, `endpoints/assignment.ts`, `react/use-assignments.ts` — a
  read-only `GET /api/group-assignment` schema, verified against a **live mirror
  response**, not the legacy (never-parsed) Zod object: `contentId` is the full populated
  course/lesson/topic/quiz document, not `{id, title}`; `author` on a row can be `null`.
  Renamed the type/status enum exports (`GROUP_ASSIGNMENT_TYPES` etc.) to avoid colliding
  with `schemas/course.ts`'s unrelated `ASSIGNMENT_TYPES` (`'personal'|'group'`).
- `query-keys.ts` — `pathologyKeys`, `assignmentKeys`.
- `fidelity/manifest.ts` — `pathologyGalleryItemSchema` replays against `pathologygalleries`
  (1,305/1,305 = 100%, published only); `pathologyCategorySchema` and the assignment
  schemas recorded as `NOT_REPLAYED` with reasons (computed joins / polymorphic content
  ref — see the manifest comments).

`apps/web`:
- `features/gallery/**` — `gallery-page.tsx`, `category-bar.tsx`, `sub-category-rail.tsx`,
  `pathology-card.tsx`, `use-gallery-params.ts` (URL state via `useSearchParams`, not nuqs
  — no `<NuqsAdapter>` mounted, same reasoning as the scan-list table's URL state),
  `gallery-links.ts`/`gallery-routes.tsx`. Mounted at `/learn/gallery` — pinned by
  `app/legacy-route-map.ts`'s `SECTOR_PATH.gallery`, already wired to the
  `/dashboard/pathology-gallery` redirect by an earlier phase.
- `features/assignments/**` — `assignments-surface.tsx` (table + keyword/status/type
  filters, no URL state — a deliberate scope cut, see Unresolved), `assignments-links.ts`,
  `assignments-routes.tsx`. Mounted at `/administer/groups/:groupId/assignments` —
  pinned by `SECTOR_PATH.groupAssignments`, gated on `read:group-assignment`.
- `features/sage/sage-frame.tsx` — the iframe + entitlement check (no user → EmptyState,
  never renders the iframe without a real `userName` to assert). Mounted at `/learn/sage`.
- `shell/nav-config.ts` — added `gallery` and `sage` nav entries (ungated, under Learn).
  Assignments has **no nav entry**, deliberately: it is group-scoped
  (`groupAssignmentsPathFor(groupId)`), and the sibling members surface
  (`groupMembersPathFor`) set the same precedent in phase 8 — reached from a row action,
  not the rail. See Unresolved: nothing currently links to it from the groups index.
- `routes/feature-routes.tsx` — wired all three route arrays.
- `i18n/locales/*.json` (all 7) — `nav.gallery`, `nav.sage`, and the `gallery`/`sage`/
  `assignments` namespaces, one leaf-key-parity test added
  (`gallery-assignments-sage-namespace-parity.test.ts`).
- `vite-env.d.ts` — `VITE_SAGE_URL` typed.
- `shell/nav-config.test.ts` — updated the one hardcoded nav-id list this genuinely changed.
- `scripts/check/sweep-routes.json` — added the three routes.

## Not ported, deliberately

- **Assignment create/edit/delete** — the legacy dialogs pull in course/lesson/topic/quiz
  content pickers and bulk-assignment, a materially larger surface than "the surface plus
  its i18n keys" reads as. Scoped to the read/visibility half; see `schemas/assignment.ts`'s
  doc comment.
- **Sage's marketing "user guide" dialog** — explicitly out of scope ("do not rebuild the
  tutor"); the frame keeps only a one-line description plus the iframe.

## Tests / gates (real numbers)

| Gate | Result |
| --- | --- |
| `pnpm -w typecheck` | clean, 0 errors |
| `pnpm -w lint` (eslint + prettier) | clean, 0 errors/warnings |
| `pnpm -w test` | api-client 169 passed / 11 skipped (20 files); web 572 passed (46 files) |
| `pnpm -w build` | succeeds; gallery/assignments/sage each a separate lazy chunk (4-7 kB) |
| `pnpm fidelity` | `pathologygalleries → GET /api/pathology-gallery item`: **1305/1305 = 100.00%**; all other entries unchanged and 100% |
| API repo `pnpm exec vitest run tests/functional/pathology-gallery/` | 5/5 passed |
| API repo full suite (`vitest run`, mongo-test container) | **1 failed / 1721 passed / 11 skipped** (1733 total, 224 files) — the one failure (`get-groups-by-user-id.test.ts`, an unrelated `/api/groups/manage/user/:userId` auth-guard test) reproduces as **10/10 passing in isolation**; pre-existing cross-file test-order flake, not touched by this branch (verified: no groups/auth files in this diff) |
| Cold-load sweep, own dev server (:3104) → own API (:5003) → `gusi_prod_mirror` | **26/26 routes healthy** |

The sweep and the manual browser checks below were run against **my own API instance**
on `:5003`, not the shared mirror on `:5002` — the shared instance is running an older
branch without this phase's controller changes, and a first pass against it produced a
false "unfiltered `scanTypeId` query" result purely because that instance doesn't have
the code. Confirmed via direct `curl` before and after switching targets.

## Manual browser verification (Playwright, real mirror data via :5003)

- First visit to `/learn/gallery`: category bar shows all 15 categories in one request
  (`AAA DVT Echo FASH FAST FAST/EFAST Gallbladder GI Lung MSK OB 1st Tri OB 2nd/3rd
  Rapid Reviews Renal Soft Tissue`) — both unmapped names present, un-hidden. "AAA" is
  auto-selected (`aria-selected="true"`) and its grid is populated with 20 real cards
  (`AAA 1 (Short Axis)`, ...) — never an empty grid with nothing highlighted.
- Opening a card: dialog renders a live `player.vimeo.com` iframe src.
- Clicking the unmapped "FAST/EFAST" tab: selects it, grid shows exactly its 2 items
  (`eFAST Anatomy`, `eFAST Pathology`) — matches the migration report exactly.
- `/administer/groups/6a6ae3d759ab84398c7cee4f/assignments`: real assignment rows
  (learner, course/lesson content title, type, due date, status pill).
- `/learn/sage`: title + description render; the iframe itself never paints in this
  sandbox because `sage.gusiaidev.com` has no egress here (`curl` to it times out,
  confirmed separately) — zero console errors, not a code defect.

## Unresolved / open questions

1. **`FAST/EFAST` and `Rapid Reviews` remain unmapped by design**, per the plan — both are
   clinical/product decisions for the user, not something this migration should guess at.
   `FAST/EFAST` is either the `FAST` scan type or a separate `eFAST` one; `Rapid Reviews`
   is the retired third-party product's 15 items (drop, or keep as a non-scan-type
   category). Both show in the category bar today as `id: null` categories rather than
   being hidden.
2. **Assignments has no nav entry or link from the groups index page.** It is reachable
   by URL (and by the legacy redirect), gated correctly, but nothing in the UI currently
   points at it — mirroring phase 8's own `groupMembersPathFor` precedent (also nav-less,
   reached from a groups-index row action). Did not add a link from
   `features/groups/index/groups-index-page.tsx` to avoid touching another phase's file
   without being asked; flagging as a likely follow-up.
3. **Assignments scope was cut to read-only** (list + filters), not the full legacy
   create/edit/delete console — the plan's one-line treatment of "Assignments" read as
   much smaller than the ~1,742-line legacy surface (page + 4 dialogs), and porting the
   write half would have meant modelling course/lesson/topic/quiz content pickers and
   bulk-assignment, well beyond "the surface plus its i18n keys." Confirm this cut is
   correct, or scope a follow-up phase for the write half.
4. Assignments filters are **plain component state, not URL state** (unlike the gallery
   and every Scan Vault table) — a deliberate corner cut given the surface's reduced
   scope; flag if URL-shareable filters are actually wanted here too.
5. i18n key count for assignments is ~24, not the plan's estimated 40 — a function of the
   read-only scope cut (item 3), not a gap in what was built.

## Files touched

**API repo** (`scratchpad/wt/api-pathology`, commit `58d3b5a4`):
`src/database/pathology-gallery/{pathology-gallery.model,service,type}.ts`,
`src/app/pathology-gallery/{pathology-gallery.controller,schema}.ts`,
`scripts/db/backfill-pathology-scan-type.ts` (new),
`tests/functional/pathology-gallery/get-pathology-categories.test.ts` (new),
`src/app/pathology-gallery/README.md`, `src/database/pathology-gallery/README.md` (new).

**scanvault** (`scratchpad/wt/phase-09`, commits `427b46c`, `77f28e0`):
`packages/api-client/src/{schemas,endpoints,react}/{pathology,assignment}.ts` (new),
`packages/api-client/src/{query-keys.ts,index.ts,fidelity/manifest.ts}`,
`apps/web/src/features/{gallery,assignments,sage}/**` (new),
`apps/web/src/{routes/feature-routes.tsx,shell/nav-config.ts,shell/nav-config.test.ts,vite-env.d.ts}`,
`apps/web/src/i18n/locales/*.json` (all 7), `apps/web/src/i18n/gallery-assignments-sage-namespace-parity.test.ts` (new),
`scripts/check/sweep-routes.json`.

Status: DONE_WITH_CONCERNS
Summary: Gallery (relation-backed category bar, no whitelist), assignments (read-only), Sage frame all built, translated x7, and verified against real mirror data through a browser; migration applied to the local mirror with exact matching numbers; all gates green except one pre-existing, unrelated, non-reproducing-in-isolation API test flake.
Concerns/Blockers: two data decisions (FAST/EFAST scan-type choice, Rapid Reviews disposition) are the user's per the plan, not mine; assignments has no nav/row-action entry point yet (mirrors phase 8's existing pattern for members); assignments write actions (create/edit/delete) were cut from scope — confirm or follow up.
