---
phase: 9
title: "Assignments, gallery and Sage"
status: in-progress
priority: P2
effort: "9 days"
dependencies: [5, 8]
---

# Phase 9: Assignments, gallery and Sage

## Overview

Three small surfaces that finish the learner side: group assignments, the pathology
gallery, and the Sage AI tutor frame.

## Pathology gallery — port it, but not its taxonomy

569 UI lines over 4 components, 154 API lines, **3 read-only endpoints, no writes, no
permissions**, 27 i18n keys. A category bar, a sub-category rail, a 20-per-page card
grid, and a dialog with the clip.

The taxonomy is the problem. `category` and `subCategory` are nullable **free-text
strings** with no reference to ScanType; the server guesses which scan type each means
by lowercasing names and returns `id: null` when it guesses wrong; and the client then
**throws away anything outside a hardcoded 13-name array** in `scan-type-list.tsx`.

- Content people cannot publish a new category. The server returns it, the UI drops it
  silently.
- A typo or a casing change orphans a whole category from its icon.
- Corrections ship as one-off scripts — `scripts/db/update-pathology-gallery.ts` is
  **775 lines** of re-filing.

**Give the pathology document a real `scanTypeId` reference, serve the category bar
from that relation, and delete the client whitelist.** Porting the gallery first and
fixing the taxonomy later means porting the whitelist into Sector, where it will be just
as invisible.

**The backfill is far smaller than this phase assumed** (measured against the production
mirror, 13 Sep 2026). Of 1,305 live gallery items, all published:

| | |
| --- | --- |
| Map to a scan type by exact name, case-insensitive | **1,288** |
| Do not map | **17** — `FAST/EFAST` ×2, `Rapid Reviews` ×15 |

And the client whitelist drops exactly those same 17 rows, so it is currently hiding
nothing the server could have resolved. Two decisions, not a migration project:
`FAST/EFAST` is either `FAST` or the separate `eFAST` scan type, which a clinician
should say; `Rapid Reviews` is the third-party product this plan retires, so its 15
items have no scan type by design and want their own answer (drop, or a category that
is not a scan type). Budget the backfill as an afternoon with one clinical question
attached, not as the bulk of the phase.

**The gallery needs no object storage.** All 1,305 items carry a Vimeo `videoUrl` and a
`i.vimeocdn.com` thumbnail; **zero** carry an `imageUrl`. Only the category bar's icons
come from S3, through the scan type's `imagePath`. So the grid, the dialog and the
playback are all verifiable against the mirror with nothing seeded.

Three more defects, cheap to not repeat: the default category comes from a *different
endpoint* than the category bar, so a first visit can land on a category with no button
highlighted and an empty grid; the categories endpoint issues **~13 serial S3 presigns
plus a full collection scan on every page load**, uncached, gating the whole screen;
and an unfiltered list fetch fires before any category exists and is thrown away.

## Assignments and Sage

Assignments: the surface plus its 40 missing i18n keys. Sage is an **iframe** — 6 lines
in the dashboard. Port the frame and its entitlement check; do not rebuild the tutor.

## Related code files

- Create (API): a migration adding `scanTypeId` to `pathologygalleries`, plus the
  category endpoint reading the relation; cache the presigned set
- Create: `apps/web/src/features/gallery/**`
- Create: `apps/web/src/features/assignments/**`
- Create: `apps/web/src/features/sage/sage-frame.tsx`
- Create: `packages/api-client/src/endpoints/pathology.ts`, `assignment.ts`

## Not ported, with the evidence

- **Rapid Review ×2** — 251 lines of iframe onto a third-party Reflex app, both flags
  false, identity asserted by unsigned URL query string. Not GUSI code.
- **Resources** — a `ComingSoon` stub, no nav entry, no inbound link. Delete.
- **Fellowship V1** — 2,347 lines, frozen since 2025-07-02, superseded by 57 v2
  endpoints no React calls, and `/api/schedule-slots` (which the V1 UI calls) **is not
  mounted**, so scheduling 404s today.
- **Referrals** — 0 documents against 3,152 users, plus an enumerable PII leak.
- **DICOM upload as a separate page** — fold into create-scan (1–2d) or drop.

## Tests / validation

- Migration is verified on the Phase 2 mirror before it is proposed for staging, and
  reports how many documents it could not map.
- Browser: a category created after the client shipped appears without a deploy.

## Success criteria

- [ ] Gallery categories come from a relation; the 13-name whitelist is deleted
- [ ] A new category is publishable by content staff without engineering
- [ ] First visit lands on a highlighted category with a populated grid
- [ ] Category endpoint is cached and does not gate the screen on serial presigns
- [ ] Assignments fully translated; Sage frame entitled

## Risk / rollback

The backfill is the risk, not the UI. It runs against the mirror first and must report
its unmappable rows rather than guessing — the guessing is what produced the 775-line
repair script. Nothing here goes near production data without that report.
