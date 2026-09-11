---
title: "Create Scan Study, redrawn"
description: "Turn the four-step create-scan wizard into one working surface plus a submit surface, and stop the two ways it currently loses a learner's work."
status: pending
priority: P1
branch: "main"
tags: [scan-vault, create-scan, upload, ux]
blockedBy: [260912-0353-app-shell-account-and-language]
blocks: []
created: "2026-09-11T20:24:25.688Z"
createdBy: "ck:plan"
source: skill
---

# Create Scan Study, redrawn

## Overview

The ScanVault create-scan flow works and is already ahead of the legacy dashboard on the
things that flow got wrong. This plan closes the distance on what is left, and it is mostly
not upload mechanics — those shipped on 12 Sep. It is that **the learner is asked to
interpret a study without seeing it, through a wizard that sequences nothing, and can lose
twelve answers to one click with no warning.**

Source: the in-place improvement plan for the legacy dashboard
(`../../../plans/260911-2157-scan-upload-and-review-in-place-improvement`, presented as
*Upload and Review, Redrawn*, artifact `24cd15bf`). Its nine boards were written against
`gusi_web_dashboard`. Four of them describe problems this app already solved; five describe
problems this app still has, in a milder form. Only the five are planned here.

## What the source plan argued, checked against this codebase

| Board | Legacy problem | Here |
|---|---|---|
| 2 — parallel upload | one file at a time, one 5 MB chunk at a time | **Solved.** 3 files concurrent, 8 MiB parts, 3 parts in flight, verified against the staging bucket |
| 3 — finish screen lies | prints "creation is complete" over a red failure alert | **Solved.** `step-submitted.tsx` reports per part and lists every unattached file by name |
| 8 — group auto-select | pre-ticks every group at mount, invisibly | **Solved.** `group-cohort.ts` defaults to leaf cohorts and the panel renders the effective set |
| 5, 6 — reviewer surfaces | queue navigation, missing-file visibility | Out of scope: reviewer side, not create-scan |
| **9 — scan type wipes findings** | no dialog, no transfer | **Still true here**, minus the toggle-to-empty bug. Phase 1 |
| **1 — the wizard sequences nothing** | four CSS-hidden panels | **Milder but true.** Phase 2 |
| **7 — interpret has no images** | findings recorded blind | **True.** Phase 3 |
| **8 — review reviews nothing** | credits and groups only | **Partly true.** Four fields, no findings, no note, no files. Phase 4 |
| **4 — a refresh costs the study** | progress lost on reload | **True in a different shape.** Blobs die with `localStorage`. Phase 5 |

The one structural difference worth stating, because it changes the Phase 2 design: in the
legacy flow **nothing** commits until Submit, so its steps are pure navigation. Here, files
commit the moment they are chosen — `uploadScanObject` runs on selection and the bytes are in
S3 long before Submit. So this app does not collapse to *no* steps. It collapses to **two
surfaces**: one you work on, one you submit from.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Stop losing the learner's work](./phase-01-stop-losing-the-learner-s-work.md) | Pending |
| 2 | [One study not four steps](./phase-02-one-study-not-four-steps.md) | Pending |
| 3 | [Interpret with the images on screen](./phase-03-interpret-with-the-images-on-screen.md) | Pending |
| 4 | [Review that reviews](./phase-04-review-that-reviews.md) | Pending |
| 5 | [A reload costs seconds](./phase-05-a-reload-costs-seconds.md) | Pending |

**Phase 1 ships alone and first.** It is a defect, it is small, and Phase 2 makes the scan-type
picker reachable from every screen — which turns a rare mistake into a one-click one. Fixing
the loss before widening the door is not optional sequencing.

Phases 3, 4 and 5 are independent of each other and of Phase 2; each is worth shipping on its
own. Phase 2 is the one with a migration and the one that can be cut without losing the
others.

## Dependencies

- Phase 2 depends on Phase 1 (above).
- Phase 3 wants the local-blob media viewer it builds; Phase 4 reuses it for thumbnails.
  Doing 4 before 3 means writing that viewer inside the summary and moving it later.
- Phase 5 touches `draft-storage.ts` and `use-create-scan-draft.ts`, the same files Phase 2
  edits for the step union. Sequence them rather than running both at once.
- No new API endpoints in any phase. Every route used already exists and is already in
  `packages/api-client`.

## Acceptance criteria

- [ ] Switching scan type never clears an answer without saying which answers, by name
- [ ] A learner can see the images while recording findings, without leaving the page
- [ ] The submit surface shows everything that will be sent, read-only
- [ ] A mid-upload reload resumes the transfer rather than asking for the files again
- [ ] Draft manifests written by the current app still load after the step union changes
- [ ] `pnpm -w typecheck`, `lint`, `test`, `build` green; contrast gate green

## Source material

- `plans/260911-2157-scan-upload-and-review-in-place-improvement` — the legacy-side plan this
  one is derived from; 7 phases, red-teamed 11 Sep, 15 findings applied
- Artifact `24cd15bf-de73-497c-9b29-7254344dcc18` — *Upload and Review, Redrawn*, 9 boards
- `../../../plans/260911-1811-scanhub-alternative-monorepo/phase-04-upload-and-ingestion-pipeline.md` —
  the upload phase whose client half already shipped
