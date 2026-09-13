---
title: "Sector replaces the ScanHub dashboard"
description: "Turn ScanVault into Sector — the learner platform that replaces gusi_web_dashboard at :3000, proven against real production data."
status: pending
priority: P1
branch: "main"
tags: [port, rebrand, lms, scan-vault, data-fidelity]
blockedBy: []
blocks: []
created: "2026-09-13T08:30:32.895Z"
createdBy: "ck:plan"
source: skill
---

# Sector replaces the ScanHub dashboard

## Overview

ScanVault today is a scan client. This plan turns it into **Sector**, the single
learner-facing app that replaces `gusi_web_dashboard` (:3000) — scans, courses,
quizzes, question banks, pathology gallery, groups, and a home screen — and holds
up against the real production data rather than a local subset.

Three decisions taken 13 Sep 2026, before any of this was written:

| Decision | Chosen | Consequence |
| --- | --- | --- |
| Data layer | **One API + a fidelity harness.** `gusi_nodejs_api` stays the only thing that touches Mongo and S3. Sector gets a thin read seam there and a harness that replays real production shapes through every schema. | No second authorization model. Phase 2 exists because of this. |
| Home screen | **Port it properly**, four role dashboards including the two that are dead today. | Phase 10, 22 days. This is +18 over the light "Today" alternative and is the single largest line in the plan. |
| Name | **Sector** — the phased-array wedge. | Phase 1. Cheapest now, and it gets more expensive every week. |

Replacing :3000 also settles the parity audit's open question 3. Six items that
were arguable are now must-builds: mark complete/incomplete, edit a submitted
expert review, request expert review on an existing scan, AI Review Generator,
reset-upload recovery, and add/delete files after submit. They are in Phase 4.

**~126 engineer-days.** Two engineers with the parallelism the phases allow:
**13 calendar weeks.** One engineer: ~25. The first user-visible thing ships in
week two.

## Before anything — not a port question

`gusi_nodejs_api/src/app/course-meta-version/course-meta-version.route.ts` ships
**eight `withPermission` guards commented out** on `main`, introduced 2025-09-09:
`publish`, `archive`, `restore`, `addApproval`, `getVersionsForUserGroup`,
`assign/user-course`, `assign/users`, `migrate/:userCourseId`. All are `authUser`
only, so any authenticated account — a learner included — can publish or archive
a course version, approve one, or reassign learners between versions.

This is live today and Sector makes it worse by making course versions reachable
from a second client. **Triage before Phase 5 starts.** Two more from the same
sweep, unverified here but specific: any signed-in user can read another user's
referral list including email addresses, and an unauthenticated-tier write
endpoint ships in the production route table.

> **Triaged and fixed, 14 Sep 2026.** Demonstrated against a restored copy of
> production: a learner account holding no course permission published a draft
> version and made it active, HTTP 200. The guards were never live — they name
> permissions that are not in `config/permissions.ts`, so the file would not
> compile with them in place. Restored with permissions that exist on branch
> `feat/sector-course-version-guards`; the learner now gets 403 and an
> administrator is unaffected. See
> [the triage report](../reports/from-triage-to-fix-260914-0016-course-version-routes-unguarded-report.md).
> The other two findings in this paragraph are still unverified.

## Phases

| Phase | Name | Days | Depends on | Status |
|-------|------|------|------------|--------|
| 1 | [Name, mark and the nav model](./phase-01-name-mark-and-the-nav-model.md) | 3 | — | **Done** |
| 2 | [Real data, proven](./phase-02-real-data-proven.md) | 6 | — | **Done** |
| 3 | [Close the lockout](./phase-03-close-the-lockout.md) | 7 | 1 | **Done** |
| 4 | [Scan surfaces to parity](./phase-04-scan-surfaces-to-parity.md) | 16 | 2 | **Done** |
| 5 | [Foundations and question banks](./phase-05-foundations-and-question-banks.md) | 17 | 1, 2 | **Done** |
| 6 | [The course read seam](./phase-06-the-course-read-seam.md) | 11 | 1, 5 | **Done** |
| 7 | [Taking a course](./phase-07-taking-a-course.md) | 12 | 5, 6 | **In progress** |
| 8 | [Group administration](./phase-08-group-administration.md) | 15 | 1 | **Done** |
| 9 | [Assignments, gallery and Sage](./phase-09-assignments-gallery-and-sage.md) | 9 | 5, 8 | **Done** |
| 10 | [The home screen](./phase-10-the-home-screen.md) | 22 | 6, 7, 8 | **In progress** |
| 11 | [Cutover](./phase-11-cutover.md) | 8 | all | Pending |

Two-engineer shape: one runs 1 → 3 → 4 → 8 → 10, the other 2 → 5 → 6 → 7 → 9,
converging on 11. Phases 4 and 5 touch disjoint directories and can be parallel;
7 cannot start before 6 lands.

## The one irreversible mistake

**Starting course UI before the read seam lands (Phase 6).** Port against today's
four-parallel-arrays shape and Sector permanently inherits 553 lines of `util.ts`,
four client-side traversals of one graph, three React Router patterns for one quiz
component, and blindness to the fourth nesting shape. None of it is removable
later without a second port. It is a scheduling risk, not a technical one — which
makes it the easy one to lose to pressure.

## Programme acceptance

- Every route reachable in `gusi_web_dashboard` for a learner, group leader, scan
  reviewer or administrator either exists in Sector or appears in Phase 11's
  decommission list with a reason.
- `pnpm fidelity` parses 100% of the restored production collections, or each
  exception is listed with the shape that caused it.
- All four demo roles complete an end-to-end pass: sign in, take a course item,
  answer a bank, submit a scan, review one, open the gallery, read the home.
- No surface ships hard-coded English while the shell offers seven languages.

## Source material

- [Bringing the rest of ScanHub into the new app](../reports/from-module-study-to-port-plan-260913-0640-rest-of-scanhub-into-scanvault-report.md) — module-by-module verdicts and evidence
- [ScanVault vs ScanHub parity gaps](../reports/from-parity-audit-to-backlog-260913-0640-scan-surface-gaps-vs-dashboard-report.md) — the 54 open items
- [Naming and architecture brainstorm](../reports/from-brainstorm-to-plan-260913-1451-sector-replaces-the-dashboard-report.md) — why Sector, why one API
- [The Six Surfaces](../260913-1352-new-module-surfaces/design-demos/six-surfaces-prototype.html) — clickable UX for phases 5–9

## Dependencies

No cross-plan blockers. Supersedes nothing; the earlier design plans under
`plans/2609*` are completed feature work this builds on.

## Unresolved questions

1. Is the immutable-snapshot **write** fix funded, and is it CTP-1016? Not in this
   plan — the read seam works against today's pointer structure and swaps data
   source later with no client change. But learner progress keeps corrupting until
   someone does it.
2. What is the **production** GrowthBook state for the nine flags the drop
   decisions rest on? Ten minutes of dashboard access can falsify several.
3. Which of the seven locales have real users? Translating create-scan,
   scan-detail and the home screen is only worth it where there are learners.
4. Who owns `CERTIFICATE_DOWNLOAD_MAINTENANCE`/CTP-399? Until it lifts, course
   completion has no payoff, which is worth knowing before Phases 6–7 spend 23 days.
5. Where does `gusi_scanhub_console` live? Every authoring claim in the source
   reports is inferred from the API contract, never observed.
6. Is Sector the public name or the internal one? Trademark and domain search is
   not done and is not something this plan can do.
