---
phase: 4
title: Review that reviews
status: completed
effort: S
---

# Phase 4: Review that reviews

## Overview

The submit surface shows scan type, a file count, a group count and whether expert review was
requested. It does not show the findings, the note, the identifiers or the files. Submission
is the one irreversible act in this flow, and it is the one screen that does not show the
learner what they are committing.

## What is missing, precisely

`step-review-routing.tsx` renders a four-row `dl`:

| Shown | Not shown |
|---|---|
| Scan type name | Every finding answered |
| Files in storage, `n of m` | The clinical note |
| Group count, as a number | External patient ID / scan identifier |
| Expert review label | The files themselves |
| | Which groups, by name |

A count of groups is not a list of groups. `groupIds.length` renders `3`, and the learner
cannot tell which three until after the study exists — at which point group routing can no
longer be changed, because the API has no route that adds a group to an existing scan.

## Requirements

- Functional: everything that will be sent is shown read-only, grouped as the learner entered
  it — the study, then who sees it.
- Functional: each block links back to the surface that owns it.
- Functional: unanswered required findings appear as "not assessed", not as absent rows.
- Non-functional: assembly over new UI. The detail page already renders every one of these
  read-only.

## Architecture

**This is assembly, not design.** `scan-detail-page.tsx` reads back findings, the note thread
and the scan context from a saved scan. The same values exist in draft state before saving.
The work is passing draft state to read-only renderers, plus the media strip from Phase 3's
`StageSource`.

**Why "not assessed" rather than omission.** A blank row and a missing row look identical on a
summary and mean opposite things to a reviewer: one says normal-and-unstated, the other says
never-looked-at. The interpretation surface already computes `missingRequiredFindings`; the
summary should say so in the same words.

**Groups by name.** `useScanUserGroups` already supplies names, and `isWiderThanCohort` already
knows which groups are broader than the default cohort. The summary is where "3 groups" becomes
"Kenya POCUS Program, Emergency Medicine — and one group wider than your cohort".

**Kept from today.** The `stillMoving` warning, the `stored === 0` block and the submit-error
notice are the good part of this screen and stay exactly as they are.

## Related Code Files

- Modify: `apps/web/src/features/create-scan/steps/step-review-routing.tsx`
- Create: `apps/web/src/features/create-scan/components/study-summary.tsx`
- Read: `apps/web/src/features/scan-detail/components/scan-context-panel.tsx` — read-only patterns
- Read: `apps/web/src/features/create-scan/model/finding-controls.ts` — answered vs required
- Read: `apps/web/src/features/create-scan/model/group-cohort.ts` — `isWiderThanCohort`

## Implementation Steps

1. `study-summary.tsx`: exam, files (thumbnail strip + `n of m` + total size), findings as
   label/value rows with "not assessed" for required-and-blank, the note verbatim, and the
   identifiers when the org collects them.
2. Sharing block: groups by name, with the wider-than-cohort ones marked; expert review with
   the credit balance already loaded by `ExpertReviewPanel`.
3. Each block gets an "Edit" affordance returning to the working surface — with Phase 2, that
   is one surface; without it, the relevant step.
4. Leave the existing warnings and the submit button untouched.

### Added: the missing exam type is now named here

Phase 2 made the submit surface reachable at any time on purpose — Review explains what is
missing rather than being disabled without saying why. The browser check walked straight
through to Submit with no exam type chosen and nothing on the screen said so, while the Submit
button stayed live over a study the server would reject and a reviewer could not read.

So the exam type joins files as a submit blocker, named in the same voice as the other two:
it decides which findings a reviewer is asked, and it cannot be changed once the study exists.

The back button also stopped saying "Interpretation", which is a step that no longer exists.

## Tests / Validation

- Browser: submit a study with 3 findings answered of 7 required and confirm the four blank
  required rows read "not assessed".
- Browser: confirm group names match what the group panel showed.
- Browser: a study with no note and no identifiers renders those blocks as empty rather than
  omitting them silently.

## Success Criteria

- [x] Every value sent by `submitDraft` appears on the submit surface first
- [x] Groups are named, not counted — with the wider-than-cohort ones marked
- [x] Required-but-blank findings read "not assessed"
- [x] Existing incomplete-upload and zero-files warnings still fire, and a third joined them — see below

## Risk Assessment

| Risk | Mitigation |
|---|---|
| The summary becomes a long scroll on a 12-finding study | Findings are a two-column label/value list, not cards; the media strip is a strip, not a grid |
| Duplicating detail-page renderers | Read those components first; extract only where the shape genuinely matches |
| Learners skip the screen | It is the screen with the Submit button; it cannot be skipped, only scrolled |
