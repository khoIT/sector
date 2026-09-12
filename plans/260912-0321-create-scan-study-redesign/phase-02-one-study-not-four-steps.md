---
phase: 2
title: One study not four steps
status: completed
effort: M
---

# Phase 2: One study not four steps

## Overview

Replace the four-step wizard with one working surface carrying persistent study chrome, plus
a submit surface reached when the learner is ready. The learner's real loop — add a file,
change the exam type, answer a finding, add another file — costs Back, Back, click, Next,
Next today. In the study bar it is one click, in place.

## Why this app collapses to two surfaces and not to zero

The source plan collapses the legacy wizard to a single document because nothing in it
commits: `createScan()` appears once, inside `onSubmit()`. That argument does not fully
transfer. **Here, files commit on selection** — `uploadScanObject` starts the transfer the
moment validation passes, and the bytes are in S3 minutes before Submit.

So one real boundary survives: everything before Submit is reversible in the app, and Submit
is not. That is one boundary, which is two surfaces, not four steps. Naming it honestly also
kills the residual justification for the stepper: the current `canSelectStep` gates
`interpretation` on having a file and `routing` on having a type — but neither gate protects
anything, because neither step writes.

## Requirements

- Functional: exam type, groups, file count/size and readiness are visible and actionable from
  the working surface at all times.
- Functional: the files area is expanded while empty and collapses to a single row once files
  are in, and **never auto-collapses** while any file is validating, uploading, retrying or
  failed.
- Functional: "Review & submit" is always reachable; it explains what is missing rather than
  being disabled without explanation.
- Non-functional: drafts written by the current four-step app still load.

## Architecture

**The study bar.** One row of chips above the working surface:

```
[♥ Cardiac ▾] [Kenya POCUS Program ▾] [12 files · 148 MB ▾]   Files ✓  Exam ✓  Findings 4 of 7  Note —   [Review & submit →]
```

Each chip opens the control it names in a popover — the scan-type picker, the group panel,
the file drawer. The readiness group is derived from state that already exists:
`countStored`/`countTracked` for files, `state.scanTypeId` for exam,
`missingRequiredFindings` for findings, `state.note` for the note.

**Readiness beats position.** "Where am I" is the wrong question for a document. "What is
still missing" is the one a learner asks before submitting, and the counters answer it from
validation state that is already computed for the inline warnings.

**The step union.** `WizardStep` becomes `'study' | 'submit' | 'submitted'`. Drafts in
`localStorage` carry the old `'files' | 'interpretation' | 'routing'` values for as long as a
draft survives, so `draft-storage.ts` maps any unknown or retired value to `'study'` on read.
The migration is three lines; the failure if it is missed is a blank page on someone's saved
draft, which is silent. It gets a test.

**What is deliberately kept.** The submit surface stays a distinct destination — see Phase 4
for what goes on it. Submitting is the irreversible act and it deserves a screen, not a chip.

## Related Code Files

- Modify: `apps/web/src/features/create-scan/create-scan-page.tsx` — shell and routing
- Modify: `apps/web/src/features/create-scan/model/draft-types.ts` — the `WizardStep` union
- Modify: `apps/web/src/features/create-scan/model/draft-storage.ts` — tolerant step read
- Modify: `apps/web/src/features/create-scan/steps/step-files.tsx` — becomes the drawer
- Delete: `apps/web/src/features/create-scan/components/wizard-stepper.tsx`
- Create: `apps/web/src/features/create-scan/components/study-bar.tsx`
- Create: `apps/web/src/features/create-scan/components/file-drawer.tsx`
- Create: `apps/web/src/features/create-scan/model/readiness.ts` + test
- Read: `apps/web/src/features/create-scan/model/file-counts.ts`, `finding-controls.ts`

## Implementation Steps

1. `readiness.ts`: one pure function from draft state to the four counters, each with a
   `done | partial | empty` state and a label. Unit-tested; the submit surface reuses it.
2. `draft-storage.ts`: map retired step values to `'study'` on read, with a test that feeds it
   a draft written by the current app.
3. `study-bar.tsx` over the existing `Card`/`Button`/`Badge` primitives. Chips are buttons
   with popovers; the readiness group is text, not controls.
4. `file-drawer.tsx`: collapsed summary row with thumbnail peek plus "Add files"; expanded is
   today's `StepFiles` body unchanged. Auto-collapse only when every file is `stored`.
5. Rebuild `create-scan-page.tsx` around `study` and `submit`; delete the stepper.
6. Keep the "Picked up where you left off" notice and the discard-draft control as they are.

### Built differently in three places

**Chips move the page, they do not open popovers.** The design had each chip open its control in
a popover. A popover holding a second copy of the scan-type grid is two grids to keep in step,
and on this surface the control it would duplicate is already a few hundred pixels below. The
chips scroll to the panel they name instead, so there is one control in one place.

**The group chip reads the EFFECTIVE cohort, not `groupIds.length`.** `groupIds === null` means
"no explicit choice yet", and the panel renders the default leaf cohort ticked in that case.
Reading the raw length put **"No groups" in the bar directly above a panel showing a group
selected** — caught in the browser, not in review. The chip now resolves through
`defaultGroupCohort` exactly as the panel does.

**An empty readiness counter is a hollow dot, not a dash.** Four dashes in a row read as four
things gone wrong, and one of them is the note, which is optional — an untouched note is not a
problem to be fixed.

**Group routing moved to the working surface** rather than staying on the submit screen. It is
the one thing on that screen that could still be changed, and the API has no route that adds a
group to an existing scan, so getting it wrong is unrecoverable. Phase 4 renders it read-only
on the submit surface.

## Tests / Validation

- `readiness.test.ts` and the draft-migration test.
- Browser: add files, change exam type from the bar without losing position, answer findings,
  watch the counters move, reach the submit surface and return.
- Browser: a failed upload keeps the drawer open and the failure visible.
- Browser: load a draft saved by the pre-migration build; it opens on the working surface.

## Success Criteria

- [x] Exam type is changeable from the working surface without navigating
- [x] The files area never auto-collapses over a file that is not yet stored
- [x] Readiness counters derive from one function — `readinessFor`, 15 tests
- [x] A draft written by the four-step build still opens — tested against a full pre-migration payload on all three retired step values
- [x] `wizard-stepper.tsx` is deleted

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Silent draft breakage on the step-union rename | Tolerant read plus a test using a real pre-migration payload. This is the phase's only silent failure mode |
| The bar becomes a second navigation, worse than the stepper | The bar holds controls and status, never position. If a chip needs a "current step" highlight, the design is wrong |
| Scope creeps into the submit surface | Phase 4 owns that screen. This phase only has to reach it |
| Phase gets cut | Acceptable: Phases 1, 3, 4 and 5 each stand alone on top of today's four steps |
