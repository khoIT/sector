---
phase: 3
title: "Two ways through create scan"
status: completed
priority: P1
dependencies: []
---

# Phase 3: Two ways through create scan

## Shells, not forks

The ordered wizard was deleted, not feature-flagged. Restoring it as a second
copy of the feature would have duplicated ~900 lines of file, findings and
routing UI that would start drifting on the first bug fix.

It did not have to be. Comparing every shared panel against its pre-deletion
version: **nine of eleven are byte-identical**, and the two that changed
(`findings-panel`, `finding-row`) changed CSS class names only, no props. So
the classic flow is a *shell* — a stepper and Back/Next footers over exactly
the panels the study surface uses.

Total divergence: one `steps/classic-steps.tsx` shell, optional
`collapsed`/`onToggle` on `FilesPanel`, and two optional props on
`StepReviewRouting`. `StepSubmitted` needed nothing at all.

Navigation lives in the shell, never inside a step component: a panel that
knows where Next goes cannot be reused by a flow with a different Next.

## Two deliberate departures from what was deleted

1. **Interpretation shows the media beside the findings.** Answering findings
   from memory was the four-step flow's real defect, and that viewer now lives
   inside the interpretation panel. Restoring the flow without it would be
   restoring the defect.
2. **One gate predicate.** The retired version had two that disagreed: the
   stepper allowed a jump on `files.length > 0` while Next required
   `countTracked(files) > 0`, so a study whose only file had been cancelled
   could move forward but could not be jumped back to; and the stepper demanded
   a stored file to reach routing where Next did not. `model/classic-steps.ts`
   is now the single answer, used by both, and is tested — including that a
   cancelled or rejected file does not count as a file.

The gates are deliberately weak. A study missing a stored file or an exam type
is stopped at Submit, where the reason can be explained, rather than by a Next
button that is simply grey.

## Group routing

The study flow puts routing on its working surface, because it is the one thing
there that cannot be repaired afterwards — the API has no route that adds a
group to an existing scan. The classic flow has no working surface, so
`StepReviewRouting` takes `showGroupRouting` and its last step carries it.

## Crossing between flows

Both flows share one draft, so the step it was parked on may belong to the other
shell. Three layers, each with one job:

- `draft-storage.ts` parses **any** real step value now, rather than rewriting
  the classic ones to `study`. A value it cannot place must never cost the
  learner the study.
- `stepForFlow` maps it, keeping the only distinction that matters — before
  Submit versus after: `study ⇄ files/interpretation`, `submit ⇄ routing`,
  `submitted` unchanged in both directions. A submitted study has a scan id;
  sending it back to a working surface would invite a second submission.
- `useCreateScanDraft(flow)` applies the mapping once, at restore, so nothing
  flickers.

Returning to classic lands on `files` rather than guessing how far along the
study was. It is the step that is always valid, and the stepper offers the rest
as their gates are met.

## Where the preference lives, and why it is not on the account

localStorage, per browser. It would be better on the account. The API cannot
hold it, verified:

- `updateProfileSchema` (`gusi_nodejs_api/src/app/account/account.schema.ts:11-74`)
  accepts `firstName`, `lastName` and six fixed enum-typed sections; unknown
  keys are dropped
- the user model has no settings/preferences/Mixed field
- `userprofiles` holds **zero documents against 3,151 users**

Storing it there means a schema, model and controller change in a repo this app
does not own, writing into a collection nothing has ever written to. So it sits
beside the theme and the language, which are per-browser for the same reason —
and the settings card says so on screen rather than letting someone discover it
on a second machine.

## Verified in the browser

- default flow → no stepper, the working surface
- the radio writes `classic`; the page then renders the four-step stepper
- Next disabled with no files, with the hint on screen; enabled after an upload
  reached storage (`1 of 1 in storage`)
- 22 scan types offered; picking `AAA v5` opens the routing gate
- step 3 carries group routing, expert review and Submit, with Back reading
  "Interpretation"
- a draft saved on the study flow's `submit` opened in classic on **routing**
  with its note intact, and returned to `submit` when switched back

## Risk / rollback

The step union widened, which touches persistence. The parse is tolerant in
both directions and `draft-storage.test.ts` asserts the classic values survive
it; `create-scan-flow.test.ts` asserts the mapping in both directions including
the receipt. Reverting means deleting the shell and narrowing the union — a
draft parked on a classic step would then read as `study`, which is what
shipped before.
