---
phase: 4
title: "The study bar stops promising a menu"
status: completed
priority: P2
dependencies: [3]
---

# Phase 4: The study bar stops promising a menu

## The report

> "choose exam type and select group awkwardly open drop down beneath"

They do not open a dropdown. They never did.

`StudyChip` drew a `ChevronDown` and accepted an `expanded` prop for
`aria-expanded`; `StudySurface` passed neither and wired `onClick` to
`scrollToPanel(...)`. The chevron promised a menu and the click delivered a
page jump. The reported "dropdown beneath" is what that jump feels like.

Worse on a fresh study — visible in the reported screenshot — where the jump
target is **already on screen**. The scroll moves nothing and the click reads
as dead.

## The cause was one panel below

`ScanTypePicker` was rendered unconditionally. All 22 tiles and the search box
stayed open **forever**, including long after a type was chosen. That is what
made the page long enough to want a jump link at all, and what made the exam
chip a shortcut to a decision the learner had already finished with.

`FilesPanel` had solved this in the same feature: fold to a summary row once
nothing needs attention.

## What changed

1. **The scan-type card folds** to `🩺 AAA … Change ⌄` once a type is chosen.
   The state is keyed on the scan-type id, not set once, so switching types
   folds again and a restored draft renders folded rather than flashing the
   grid. Expanding is always manual.
2. **The trailing mark is an arrow**, and `aria-expanded` is gone. The control
   scrolls; the affordance now says so.
3. **The jumped-to panel is marked** for 1.2s (`sv-jump-target`). Without it a
   jump to a panel already on screen is indistinguishable from a dead click.
   Under `prefers-reduced-motion` the ring is held still rather than removed —
   dropping it would restore exactly the dead click this fixes.
4. **`SwitchScanTypeDialog` moved out of the card.** A dialog a fold can
   unmount is a dialog that can vanish mid-decision.
5. **Findings go full width when there is no playable file.** The two-column
   media/form grid applied unconditionally, so a study with no viewable media
   left the findings at half width beside an empty half-screen. Pre-existing;
   folding the grid made it the most visible thing on the page.

The collapsed row reads **"Change"** rather than a bare chevron. Scan type is
fixed for good once the study is submitted, so the row names what opening it is
for.

## Not done, deliberately

**The chips did not become real dropdowns**, which is what the chevron implied
and what was offered. Scan type is unrecoverable after submit, has 22 options
plus a search box, and changing it after findings are answered opens a confirm
dialog about which answers survive. A popover is the wrong surface for that
decision. The grid was never the mistake — the grid never leaving was.

## Classic flow untouched

`collapsibleScanType` defaults to `false` and only `StudySurface` passes it. In
the ordered wizard the picker **is** step 2, and a step that folds itself to one
row is a step showing nothing. Same guard `FilesPanel` uses for its Files step.

## Verified in the browser

Study flow:

- fresh: grid open, chip reads "Choose exam type", `aria-expanded` **null**
- clicking the chip marks `#study-exam`, and the mark clears after the flash
- picking `AAA` → grid closed, row reads "Scan type: AAA Change"
- "Change" → grid open again
- switching to `DVT` → folds again
- reload → opens folded, no grid flash

Classic flow:

- step 2 offers all 22 tiles
- picking a type leaves the grid open
- no fold affordance offered at all

## Risk / rollback

No model or persistence change — nothing new is stored, and the fold is render
state only. Reverting means deleting the `collapsibleScanType` branch and the
`sv-jump-target` rule; the grid returns to staying open, which is what shipped
before.
