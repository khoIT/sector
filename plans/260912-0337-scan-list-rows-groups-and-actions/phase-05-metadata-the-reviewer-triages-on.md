---
phase: 5
title: Metadata the reviewer triages on
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 5: Metadata the reviewer triages on

## Overview

Carry the row-metadata design into the two surfaces it was drawn for: four additions to the
group queue, and one column on My Scans that stops saying "Reviewed" to a learner who wants to
know whether they passed.

**Gated.** The design is drafted and awaiting review. Nothing here starts until it is accepted.

## Requirements

- Functional: every field added is non-empty on enough rows to justify its space; nothing that
  is empty on 98% of rows is added; no row gains a column.
- Non-functional: row height grows by at most one line; the contrast gate stays green; all
  four additions read from data already on the list response — no new request.

## Architecture

### What goes in, and how often it says anything

Share of the 12,393 queue scans where the field is non-empty:

| Field | Coverage | Where | Why it earns the space |
|---|---|---|---|
| Learner asked a question | **41%** (5,113) | Details, accent chip | A scan with a note is someone waiting on an answer. Nothing distinguishes it until the scan is open |
| Findings the learner declared | **44%** (5,415; 659 with a gap) | Details, plain count + warn chip on the 5% with a gap | Confirming or contradicting the learner's own call *is* the review |
| Clips versus stills | **35%** contain video (4,379; 2.8 files avg) | Details, second line | Eight clips is a fifteen-minute review, two stills is ninety seconds. The row renders both as the same `n/n` |
| Rubric version | ~100%, v1–v6 | Scan type, dim, **on every row** — see the correction below | A 338-day-old queue item was submitted under an older protocol than the reviewer is about to judge it by |

Rejected on the same test, recorded so they are not re-proposed: AI quality score (1.2%),
external patient identifier (1.7%), and two fields under 0.2%. A column empty 98% of the time
teaches people to stop reading that part of the row.

### Added after the design: how long the review took

Measured across all 15,563 reviewed scans, not the queue subset:

| Submitted → reviewed | Scans |
|---|---|
| under a day | 1,913 (12%) |
| 1–3 days | 1,869 |
| 3–7 days | 2,697 |
| 7–30 days | 4,916 |
| 30–90 days | 2,336 |
| over 90 days | 1,832 |

**4,168 reviewed scans — 27% — took more than a month.** The reviewed lists show the review
date and the submission date in two separate columns and leave the subtraction to the reader.
Print the elapsed time next to the outcome, using the `formatWaiting` helper the queue already
uses, so the two surfaces express duration the same way.

This is worth having for the learner ("mine came back in two days"), for the reviewer, and for
whoever has to answer how the service is performing — and it is arithmetic on two fields that
are already on the row.

Also measured and **rejected**, so they are not proposed again:

- `fileZip` (18.9%) — looked like a server-built archive that would make Phase 3's client-side
  zip unnecessary. It is not: the values are legacy migration paths (`adminGUSI-29/DVT-16MAY-…`)
  present on 5,946 old scans only. Client-side zipping stands.
- `refId` (21.3%) — a legacy numeric import id, superseded by `scanIdentifier` and the title
- `logs` (14.3%) — the legacy Logs dialog; a recovery tool, not row metadata

### My Scans: Status becomes Outcome

**3,294 of 15,579 reviews came back `not_achieved` — 21%.** Every one renders today as the
word "Reviewed". A learner with forty reviewed scans opens forty pages to find the ones they
failed, and the answer is already on the row in `review.competencyMeasure`.

The column keeps its position and its width and changes what it answers:

- reviewed → `Achieved` / `Not achieved`, with the review date dim beneath
- submitted → keeps the status pill, gains the group it is queued in
- failed → keeps the pill, gains `processingError` when the ingest worker recorded one; it has
  never been shown to the person whose upload failed. Null on all 2,220 historical failures —
  see correction 3 below

`competencyMeasure` is the field with the boolean drift fixed on 12 Sep — read it through
`storedCompetencyMeasureSchema`, which already tolerates the legacy values, and treat anything
non-conforming as "no outcome recorded" rather than as a failure.

### Three corrections made at build time, from measurement

The design was drafted from counts that turned out to be wrong in three places.
Each was re-measured against local `gusi_dev` before any code was written.

**1. The rubric version is not a rare exception — it is 41% of the queue.**

The design asked for the version to print only on a scan behind the current rubric,
on the understanding that would be rare. Comparing each scan's `scanType.version`
against its organisation's `scanTypeVersion` — both already on the list response:

| | behind current | at current |
|---|---|---|
| queued (12,393) | **5,127 — 41%** | 7,266 |
| reviewed (15,566) | **9,544 — 61%** | 6,022 |

The queue mixes six generations at once: v1 2,314, v2 1,513, v3 1,300, v4 2,682,
v5 630, v6 3,954. A warning that fires on two rows in five is not a warning, it is
a second permanent line people learn to skip — the same failure the "empty on 98%
of rows" test was written to prevent, from the other direction.

The framing was also wrong. A v2 scan is reviewed against the v2 rubric, because
its findings are keyed to it; being on an older version is not an error state, it
is which protocol applies. **Shipped as a plain dim `v5` beside the type name on
every row, no tone, no extra line.**

**2. The gap test cannot be a prefix match on "not".**

The design named `Not Examined` / `Not assessed` as the gap values. The stored
vocabulary contains two families that both begin with "not" and mean opposite
things:

- gaps — `Not Examined` 4,640, `Not assessed` 772, `Not Assessed` 126,
  `Not Measured` 80, `NotMeasured` 33, `not measured ` 18, `not done` 16, `N/A` 15,
  plus a tail where a measurement was typed through the middle of the word
  (`Not Exa270.6mined`, `Not Examined31.78cm35w5d`)
- **real findings** — `Not Widened` 136, `Not Distended` 106, `Not thick` 1

A prefix match flags those 243 real findings as "the learner skipped this", which
accuses someone of omitting an examination they performed and recorded as normal.
Shipped as an allow-list over a letters-only normalisation, with the three real
findings denied explicitly; anything unrecognised reads as a finding, never a gap.
Re-measured under that rule: **731 queued scans carry a gap, 6%** — which does
work as an exception marker.

**3. `processingError` is null on every historical failure.**

The design said it was "on the wire for all 2,220 failed scans". It is not: the
field does not exist on a single scan document in `gusi_dev`. It is written by
`process-deidentification.ts:305`, which shipped upstream in
`fix/idempotent-deid-ingest`, so it populates for failures **from that day
forward** and is null for all 2,220 that predate it. Shipped as render-when-
present: a pre-existing failure keeps the bare pill rather than gaining an empty
line.

Also re-measured and confirmed unchanged: notes on 41% of the queue (5,113),
`not_achieved` on 3,294 of 15,579 reviews, and the two reviews storing a boolean
`true` that `storedCompetencyMeasureSchema` already tolerates. Findings coverage
came out at 35% of the queue rather than 44%, still well clear of the bar.

### One conflict with the drafted design, resolved

The design put clips-versus-stills on a **second line under the Files column ratio**, and paid
for it by dropping the duplicated `n/n files` from the Details cell. Phase 1 resolves the same
duplication the other way — the column goes, the sub-line stays — because that is the
direction asked for.

So the media line moves into the Details cell beneath the count:
`6/6 files · 4 clips · 2 stills`. The Details cell then runs three lines on its busiest rows:
title, count + media, chips.

**Check this at build time, not now.** If three lines reads crowded against a queue of real
rows, the fallback is not to restore the Files column but to add a narrow **Media** column
carrying `4 clips · 2 stills` alone — a different fact from the count, with its own header,
rather than the duplicate that was removed.

**Built as two lines, not three.** The Details cell keeps its single wrapping meta row and the
new facts join it rather than stacking under it: counts first as one group
(`6/6 files · 4 clips · 2 stills · 3 findings`), then the identifier, then the chips. At table
width that is one line; below it the row already wraps, and the table is scrolling anyway. The
Media-column fallback was not needed and is not built.

The one row that does grow is Outcome on My Scans, which gains a dim date + turnaround line
under its pill — the one line the phase budgeted for.

## Related Code Files

- Modify: `apps/web/src/features/scan-list/rows/list-cells.tsx` — `TitleCell` chips and media
  line; a new `OutcomeCell`
- Modify: `apps/web/src/features/scan-list/rows/scan-columns.tsx` — the `status` column on
  `my` becomes `outcome`; scan-type cell gains the rubric line
- Create: `apps/web/src/features/scan-list/rows/scan-media-summary.ts` — counts clips and
  stills from `scan.files` via `mediaKindFor`
- Create: `apps/web/src/features/scan-list/rows/rubric-version.ts` — parses the version prefix
  off finding keys and compares against the scan type's current version
- Create: tests for both helpers and for `OutcomeCell`

## Implementation Steps

1. `scan-media-summary.ts` — reuse `mediaKindFor` from `@scanvault/api-client` rather than
   re-deriving from `filetype`; 18.7% of file rows store a bare extension there and the naive
   check was the cause of the "cannot preview" defect fixed on 12 Sep.
2. `rubric-version.ts` — finding keys carry the version (`v2_fast_…`, `v5_aaa_…`). Render the
   line **only** when the scan's version is behind the scan type's current one; on the ~100%
   that match, print nothing.
3. `TitleCell`: media line under the count; `Asked` chip when the scan has notes; findings
   count; warn chip when a required item is `Not Examined` / `Not assessed`.
4. `OutcomeCell` for `view === 'my'`, with the three branches above, plus the elapsed
   submitted → reviewed time on reviewed rows via `formatWaiting`.
5. Tests: media summary over mixed filetypes including bare extensions; rubric behind/at
   current; outcome for each of achieved / not achieved / null / submitted / failed.

## Tests / Validation

- `pnpm --filter @scanvault/web test`, `-w typecheck`, `lint`
- `pnpm --filter @scanvault/ui test` — contrast gate, since the Asked chip uses an accent fill
- Against staging: a queue page of real rows, checked for the three-line question above

## Risk Assessment

- **Row height.** The single largest risk and the reason the design was drawn before any code.
  Measure on a full page, not on one row.
- ~~**`Asked` needs to know a scan has notes.**~~ **Resolved.** `notes` is on the list row
  schema (`schemas/scan.ts:282`, `embeddedScanNoteSchema`), as are `processingError:273`,
  `reviewedAt:286` and `review.competencyMeasure:206`. Every field this phase adds is already
  on the wire; none of them costs a request.
- **Rubric parsing is string work on user-influenced keys.** Unknown shape → render nothing.
- Rollback: each addition is independent; any one can be dropped without the others.
