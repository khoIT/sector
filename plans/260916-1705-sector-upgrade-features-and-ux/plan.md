---
title: 'Sector upgrade: features and UX'
description: >-
  Upgrade Sector after cutover: fluid, mobile-safe layout system; one course
  page that leads with the description; scan-surface parity behind server
  guards; transcripts, notes and certificates behind explicit gates.
status: pending
priority: P1
branch: main
tags:
  - ux
  - layout
  - mobile
  - courses
  - scan-vault
  - parity
  - i18n
  - transcript
  - tdd
blockedBy:
  - 260913-1451-sector-replaces-scanhub
blocks:
  - 260914-1456-sector-course-experience-roadmap
created: '2026-09-16T10:52:30.272Z'
createdBy: 'ck:plan'
source: skill
---

# Sector upgrade: features and UX

## Overview

Source: [brainstorm report](../reports/brainstorm-260916-1705-sector-upgrade-features-and-ux-report.md) (16 Sep 2026), evidence screenshots beside it. Planned with `--tdd`: every phase pins current behaviour with tests before it refactors.

**Why.** Sector reached route parity with the dashboard it replaced, but three things are wrong with the experience: every page is capped at 1400px and centred (28% of the panel is empty at 2200px, `2xl:` is used nowhere); the course entry page is a 46-row list with the description hidden behind `/about`, built on a premise ("158 of 175 courses have no description") that came from `gusi_dev` — production has descriptions on 96 of 102 published courses; and ~50 interaction-level parity gaps remain inside the scan surfaces. On a phone the expert queue scrolls the document sideways and the player puts the contents list above the video.

**Decisions taken (16 Sep, user).** Fluid shell with a per-surface measure **and mobile as a gate**; one course page (landing + expandable modules); full scope across three releases; the scan-surface i18n sweep in Release 1; transcripts generated ourselves where Vimeo has none, gated on media access.

**Principles.** Web first, API second (Release 1 is `apps/web` + `packages/ui` only and ships to Netlify against staging). One layout system: a `PageFrame` primitive with `reading | working | full` measures; the shell stops owning width. Mobile is a gate: no horizontal document scroll at 390px on any route, verified by a 390 / 1440 / 2200 browser sweep that phase 1 builds and every later phase runs.

### Releases

| Release | Phases | Needs | Effort |
| --- | --- | --- | --- |
| 1 — layout and courses | 1–8 | nothing outside this repo | ~21 d |
| 2 — scan parity behind server guards | 9–13 | the API branch (`feat/sector-*`) on staging; each server guard lands before its UI | ~9 d web + API |

**Correction found while planning (17 Sep).** The reviewer UI for mark complete/incomplete and for requesting an expert review on an existing scan already shipped on 14 Sep (`60a4fd2`, `61b4347`), one day after the parity audit listed them open. Phases 9 and 10 are therefore server-guard-first phases with feature-detection, i18n and mobile work around existing UI, not new surfaces. The brainstorm report's §3.1 predates this and is left as the historical record.
| 3 — new capability | 14–17 | phase 14 ungated (83% caption coverage); 15 media access; 16 a named observable; 17 the certificate flag owner | ~14 d |

Phases 1 and 2 alone fix what the user's screenshot and URL showed; ~7 days to a demo that reads right. Phases 3–7 depend only on 1 and can run in parallel by two engineers; 8 waits for 5 and 7 so strings settle first.

### Acceptance

- Every built route renders without horizontal document scroll at 390px; the 3-width sweep is green.
- At 2200px no `working` surface shows dead gutter beyond its declared measure; `reading` surfaces hold ~80ch.
- `/learn/courses/:courseId` leads with the description for every course that has one, and Start/Continue resolves to the same item as before.
- The open scan-surface parity items are built or listed with a reason; no Sector UI exposes a server write that lacks an ownership check.
- create-scan, scan-detail and account carry zero hard-coded English; no additions to `locale-completeness-baseline.json`.
- Every new api-client schema has a fidelity decision; `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w lint` green after every phase.
- The Netlify demo (staging API) keeps working through Release 1: new controls feature-detect and hide on 403/404.

### Run

```
/ck:cook /Users/lap16299/Documents/code/gusi-lms/scanvault/plans/260916-1705-sector-upgrade-features-and-ux/plan.md --tdd
```

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Layout system and width measures](./phase-01-layout-system-and-width-measures.md) | Completed |
| 2 | [Course page merge](./phase-02-course-page-merge.md) | Completed |
| 3 | [My Courses density and list view](./phase-03-my-courses-density-and-list-view.md) | Completed |
| 4 | [Player wide layout and mobile drawer](./phase-04-player-wide-layout-and-mobile-drawer.md) | Completed |
| 5 | [Create-scan three-column layout](./phase-05-create-scan-three-column-layout.md) | Completed |
| 6 | [Command menu](./phase-06-command-menu.md) | Completed |
| 7 | [Queue navigation](./phase-07-queue-navigation.md) | Completed |
| 8 | [Scan surfaces i18n sweep](./phase-08-scan-surfaces-i18n-sweep.md) | Completed |
| 9 | [Mark complete or incomplete](./phase-09-mark-complete-or-incomplete.md) | Pending |
| 10 | [Request expert review on existing scan](./phase-10-request-expert-review-on-existing-scan.md) | Pending |
| 11 | [Add and delete files after submit](./phase-11-add-and-delete-files-after-submit.md) | Pending |
| 12 | [Reset-upload recovery](./phase-12-reset-upload-recovery.md) | Pending |
| 13 | [AI review panel](./phase-13-ai-review-panel.md) | Pending |
| 14 | [Transcript from Vimeo tracks](./phase-14-transcript-from-vimeo-tracks.md) | Pending |
| 15 | [Generated transcripts](./phase-15-generated-transcripts.md) | Pending |
| 16 | [Learner notes](./phase-16-learner-notes.md) | Pending |
| 17 | [Certificates](./phase-17-certificates.md) | Pending |

## Dependencies

| Relationship | Plan / owner | Note |
| --- | --- | --- |
| Blocked by | `260913-1451-sector-replaces-scanhub` (phase 11, cutover) | Releases 2–3 need the unpushed `feat/sector-*` API branches deployed to staging. Release 1 does not. |
| Blocks | `260914-1456-sector-course-experience-roadmap` | This plan takes over its phase 6 (transcript, notes) and reworks its phase 5 player and phase 7 landing surfaces. Marked there. |
| External | Vimeo account owner | Phase 15: enable download / `video_files`, share the 35 unshared videos, or supply source files. Phase 14 needs nothing new — the seat already reads 387 of 465 videos' tracks. |
| External | Content team | Fix or remove the 43 videos that 404; author the captions backlog. |
| External | `CERTIFICATE_DOWNLOAD_MAINTENANCE` owner (CTP-399) | Phase 17 cannot ship a download until the flag flips and generation is verified on staging. |
| External | Plan owner | Phase 16 needs a named observable before it starts. |
| Internal | Analytics | Success metrics in the brainstorm report need page/event logging, which dropped to zero at cutover. |

## Planning log

### Whole-Plan Consistency Sweep — 2026-09-17
- Files reread: plan.md, phase-01 … phase-17 (eight written by planner agents before a rate-limit stop, nine by the controller).
- Decision deltas checked: 4 — the sweep command is `scripts/check/cold-load-sweep.mjs` (phase 1), not a package script; phases 9/10 UI already exists (see correction above); notes routes nest under `/courses/:courseId` like phase 14's transcript route; `pnpm --filter @sector/web` naming.
- Reconciled stale references: 12 lines across phases 6, 7, 8, 11, 12, 13, 14, 15, 16, 17.
- Unresolved contradictions: 0.
- Gates not yet run: red team and validation were not auto-run (the planner agents hit the session rate limit; the controller finished the files). Both are offered at handoff.

### Open questions

1. Which media-access route will GUSI grant for generated transcripts, and who asks?
2. What observable would tell us Notes was worth building?
3. Which field holds the AI review data on 388 scans, and who is it for?
4. Extended profile tab: port or retire with a note?
5. Which locales have real users?
6. Who owns the certificate flag, and does generation still work?
