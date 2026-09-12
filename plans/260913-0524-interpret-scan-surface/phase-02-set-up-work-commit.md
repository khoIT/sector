---
phase: 2
title: "Set up, work, commit"
status: completed
priority: P1
dependencies: [1]
---

# Phase 2: Set up, work, commit

## The shape, and why it is this shape

The job has **one** dependency: the findings form is fetched per scan type and
cannot be drawn before one is picked. Sharing and uploading hang off nothing.
Arranged by that, the page is three blocks:

| Block | Holds |
|---|---|
| Set up | scan type, groups |
| Work | media rail (sticky) · findings, blank-required notice, note, expert review |
| Commit | what is still missing · Review & submit → confirm |

**Groups are in the setup row for a different reason than scan type.** They gate
nothing — `UserGroup` is `{id, name, slug, parent}`, a tree of sharing cohorts
with no organization on it. They are there because routing is fixed at submit
and the basement of a scrolling page is the wrong home for an irreversible
choice.

**No organization control**, because `scans_org-with-forms_all` is off
everywhere. `organizationId` stays `null` and the generic
`/api/scan-type/:id/items` stays correct. That is the flag-off path, deliberately
shipped, not a gap.

## Eight blocks became three, and the repeats went with them

Five facts were being stated twelve times. Gone: the study bar (two chips, four
readiness counters), the standalone "Still needed" sentence, the folded
scan-type row, the 22-tile grid, the Share-with-groups card, the review screen
and its summary, and — caught in the browser, not in review — the draft-saved
line, which said "2 of 2 files in storage" directly above a setup control and a
files panel saying the same thing. It is the wizard's now, where the panel is
not always on screen.

## What was extracted rather than copied

The scan-type control exists in two places now, so its logic could not stay
inside one of them:

- `model/use-scan-type-switch.ts` — choosing a type, planning which answers
  survive, and the confirm dialog. **Shared.** A second copy of this is a second
  chance to lose someone's findings with no undo, which is the defect it exists
  to prevent.
- `model/use-draft-media-sources.ts` — object URLs, still a ref because creating
  them during render leaks one per frame.
- `components/clinical-note-panel.tsx` — so the surface can have the note
  without dragging the picker and the viewer along.

## Reuse over reimplementation

`StudyRail` renders `FilesPanel` **whole**. A slimmer strip would have had to
re-learn retry, reattach, rejected formats, and the refusal to fold while
anything needs attention — the last of which is how a broken study gets caught
before submit. Upload got a column, not a rewrite.

Expert review likewise stays its own card. It spends a credit and can open a
purchase dialog; a line in the commit bar would have meant nesting dialogs.

## The review screen is gone

Everything it restated was on the surface underneath it. What survives is the
pause before an irreversible act, as a confirm dialog — and unlike the summary
it replaced, **it names the groups**. `StudySummary` listed exam type, files,
scan identifier, patient ID and expert review, and never who the study was going
to, for a choice the API cannot undo.

`submit` is retired as a step. It stays in `WIZARD_STEPS` so a draft parked on
it still parses — losing a study because its step retired would be the worst
possible trade — and `stepForFlow` lands it on the surface in one flow and on
Review routing in the other.

## Wording fixed on the way

The commit bar first read "Everything this study needs is filled in" while an
amber notice above it said a required finding was blank. `submitBlockers` only
ever checks files and exam type — findings and the note are advisory by design —
so the bar now claims only what it verifies: "Ready to submit."

## Verified in the browser

- 22 scan types in the combobox; `ms` narrows to 6; picking AAA loads its findings
- groups multi-select keeps the popover open; unticking reads "No groups"
- Escape closes from anywhere in the popover (this was broken and is fixed)
- a **real submit**: study `AAA-SEP13-00006`, Submitted, 1 of 1 files
- the confirm flags a blank required finding in amber and names the group
- classic flow unchanged: stepper, draft-saved line, 22 tiles, "What will be
  sent", group routing, expert review, Submit
- no horizontal overflow at 1100, 760 or 400px

## Risk / rollback

The blast radius is the study flow's shell. `FindingsPanel`, `FilesPanel`,
`GroupRoutingPanel`, `ExpertReviewPanel`, `StudySummary`, `submitDraft` and the
readiness model are untouched, and the classic wizard does not import
`StudySurface`. Reverting means restoring `study-bar.tsx`, the `submit` branch
in the page, and the old `stepForFlow` arm.
