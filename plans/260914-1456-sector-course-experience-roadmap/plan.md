---
title: "Sector course experience: re-entry, cohort loop, player shell, landing"
description: "Post-cutover roadmap for Sector's course experience: re-entry and progress clarity, the cohort assignment loop, a persistent player shell with transcript and notes, and a course landing page — sequenced by production drop-off evidence."
status: in-progress
priority: P1
branch: "feat/sector"
tags: [lms, courses, progress, cohorts, vimeo, post-cutover]
blockedBy: [260913-1451-sector-replaces-scanhub, 260916-1705-sector-upgrade-features-and-ux]
blocks: []
created: "2026-09-14T08:03:20.442Z"
createdBy: "ck:plan"
source: skill
---

# Sector course experience: re-entry, cohort loop, player shell, landing

## Overview

Sector's course surfaces shipped at parity with the dashboard they replace. This plan is what
comes next for learners, sequenced by what production says rather than by preference.

**The evidence (Atlas, read-only, 14 Sep 2026):** 14,172 learners have ever started a course;
**58% of started courses stall under 25%** (9,586 at 1–24%, 4,152 at 0%), only 731 stall between
75–99%, and 3,970 reach 100%. 1,743 progress rows were touched in the last 30 days. **2,440 of
4,595 dated group assignments are overdue and still open**; no reminder exists. The loss is
early, and learners do not return — so the first release acts on re-entry and rhythm, not on
late-course polish.

> **One figure to re-measure before Phase 4 starts.** This overdue count is 2,440 (production
> Atlas); Phase 4 measured **2,435 across 843 distinct learners** against `gusi_prod_mirror`
> with the filter written out (`dueDate < now`, `status ∈ {active, in_progress}`,
> `deletedAt: null`). Same 4,595 denominator, so the five-row gap is more likely a filter or
> snapshot difference than mirror drift. Nothing in the plan turns on which is right — Phase 4
> drains from a cursor and never hard-codes a population — but whoever starts Phase 4 should
> re-run the Phase 4 filter against production and pin one number. The Atlas IP whitelist had
> lapsed again at the time of the consistency sweep, so this could not be settled then.

**Decisions taken 14 Sep 2026** (brainstorm report linked below): scope is the learner
experience in Sector, post-cutover, **full feature set** — re-entry layer, cohort loop, player
shell, landing page — with the shell second so caption coverage is *measured* before transcript
work is committed. A content-structuring pass is on the table (engineering backfills what Vimeo
can supply; the content team owns objectives and levels). **Certificates stay out of scope** and
are tracked as a dependency: 2,860 completers hold a certificate record with no file because the
download flag is on. Assessment redesign is a separate brainstorm.

**Releases and effort** (post-red-team, 47 days total):

| Release | Phases | Effort | Notes |
|---|---|---|---|
| 1 — re-entry and rhythm | 1–4 | **26 d** | 5 + 8 + 6 + 7 |
| 2 — player shell | 5–6 | **12 d** | 3 + 9. **Phase 5 is ungated** — it is a pure `apps/web` route restructure with no Vimeo dependency. Only **Phase 6's Transcript tab** is gated, on Phase 1's caption-coverage number *and* on Phase 6's corrected cost. Chapters are ungated; Notes has its own separate go/no-go. |
| 3 — landing and cohort report | 7–8 | **9 d** | 5 + 4, paced by the content team |

Sources: [brainstorm report](../reports/brainstorm-260914-1456-sector-course-experience-roadmap-report.md) ·
[port leftovers audit](../reports/port-leftovers-audit-260914-1403-sector-cutover-remaining-work-report.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Vimeo access and media backfill](./phase-01-vimeo-access-and-media-backfill.md) | Completed |
| 2 | [Progress model with position and watch threshold](./phase-02-progress-model-with-position-and-watch-threshold.md) | Completed |
| 3 | [Outline and home re-entry surfaces](./phase-03-outline-and-home-re-entry-surfaces.md) | Completed |
| 4 | [Cohort loop with reminders and leader status](./phase-04-cohort-loop-with-reminders-and-leader-status.md) | Completed |
| 5 | [Persistent course player shell](./phase-05-persistent-course-player-shell.md) | Completed — tab strip and the collapsing contents pane landed 15 Sep |
| 6 | [Transcript plus notes and chapters](./phase-06-transcript-plus-notes-and-chapters.md) | Blocked — chapters dropped (no source data), transcript gated on the Vimeo seat, Notes on its go/no-go |
| 7 | [Course landing page and content fields](./phase-07-course-landing-page-and-content-fields.md) | Completed bar the console form controls |
| 8 | [Leader completion report and due-this-week](./phase-08-leader-completion-report-and-due-this-week.md) | Completed — no 719-member perf run, no browser sweep |

## Course and player brought to the design — 2026-09-15

The two screens in `design/learner-course-experience.html` that were furthest from what shipped are
now close to it. All changes are in `apps/web`:

- **Course landing** is two columns: the course stated in learner units (modules / topics / quizzes /
  video runtime) with a CME pill, a "What you'll learn" card, and module rows carrying a status mark,
  per-module counts, minutes and `done/total`. The sticky rail holds the cover, the percentage, time
  left, the three fractions and the Resume button. The percentage is the SERVER's, not a recount.
- **Player** gained the design's contents pane — a header with `completed/total`, time left and a
  bar, modules that collapse and can be opened by hand, per-item durations, a question count on a
  quiz, and the footer stating the 80% rule. The video now leads the column at 16:9 (the embed used
  to sit at its authored 640px inside the prose), with the title, the watched line and an
  Overview / Transcript / Notes strip beneath it. An item route shows a breadcrumb instead of the
  progress header, which the pane now carries.
- Phase 5's two carried-forward requirements — the tab strip and collapsing the pane to the current
  module — are done. **Phase 6 still owns what goes INSIDE** Transcript and Notes; both tabs say
  plainly that they are not built rather than showing an empty panel.

Supporting changes: a shared `OutlineStatusGlyph`, `splitTopicMedia()` (lifts the player out of the
authored HTML so the prose can live under a tab), `formatPlayheadTimestamp` moved to `lib/format.ts`
so home and the player share it, and 22 new keys across all seven locales.

Verified: typecheck clean on all three packages, 978 web tests pass, and a browser pass over My
Courses, the landing page, the outline and an item route with no console errors.

**The data behind the demo is faked** — `level`, `objectives` and `cmeCredits` on three courses, and
a deliberately mid-course progress state. See `docs/local-setup-lms.md` section 8. No course in
production carries objectives or a level; Phase 7's console work is still what makes them real.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|---|---|---|
| Blocked by | `260913-1451-sector-replaces-scanhub` (cutover, phase 11) | in-progress |
| Superseded in part by | `260916-1705-sector-upgrade-features-and-ux` — takes over phase 6 (transcript, notes) and reworks the phase 5 player and phase 7 landing surfaces | pending |

This plan ships as Sector releases *after* cutover. It also inherits that plan's unmerged
API-side branches (`feat/sector-*` in `gusi_nodejs_api`): every API change here lands on the
same stack and shares the same upstream-merge dependency.

## Dependencies

- **Vimeo API token** for the GUSI account (read scope: text tracks **and private video
  metadata**). Public oEmbed covers **90.5%** of durations and thumbnails with no credential —
  measured 15 Sep 2026 by running the real backfill over all 1,472 non-deleted topics, 421 of
  465 videos resolved — so Phases 2, 3, 5 and 7 are **not blocked** on it. The token closes the
  remaining gap: **43 private videos** whose metadata oEmbed will not return at any URL (they
  still *play*, so this is 43 topics missing a duration, not 43 broken videos), plus all
  caption data for Phase 6. Not engineering.
  <!-- Corrected 15 Sep 2026: an earlier version said the token was needed only for captions. -->

  > Scope the request as: read access to the GUSI account's videos, covering `texttracks`
  > and private-video metadata. Without it, 43 of 887 video topics show no runtime — which is
  > a visible gap on the outline, not a failure.

  **Token obtained and measured, 15 Sep 2026.** A personal access token (scope
  `private public`) minted from the GUSI Vimeo app on a **Contributor** seat was run against
  all 465 distinct video ids in the mirror:

  | | videos | share |
  |---|---|---|
  | readable (metadata + duration) | 295 | 63% |
  | carry text tracks (all include English) | 278 | 59% |
  | unreadable, but alive on public oEmbed | 128 | 28% |
  | genuinely gone (404 both ways) | 42 | 9% |

  Track languages: `en` 211, `en-x-autogen` 202, then ar/de/es/fr/hi/pt/sw/uk/ur/zh at 181
  each — GUSI already subtitles into the languages Sector ships locales for.

  Three consequences for Phase 6:

  1. **Transcript coverage is 59%, not the ~90% the oEmbed figure suggested.** The gap is a
     *seat permission* problem, not a scope problem: 128 readable-in-public videos are simply
     not shared with this seat. An owner-generated token, or granting the seat those folders,
     should close most of it. **Re-measure before committing to a coverage promise.**
  2. **Do not switch durations onto the API.** Public oEmbed reaches 421/465 with no
     credential; the token reaches 295. oEmbed stays the better source for Phase 2/3/5/7.
  3. **App client id/secret are useless here.** A client-credentials token carries no user
     context and 401s (error 8003) on every `/videos/*` read, including public ones. Only a
     personal access token works.
- **Content-team owner** for learning objectives and course level (Phase 7). Not engineering.
  **Named 15 Sep 2026: Liesl Annandale.** This clears Phase 7's gate — the landing page and
  both content fields are now in scope, and step 11's console form controls are unblocked as a
  follow-on item in `gusi_scanhub_console`. The fields ship nullable and the page renders
  without them, so authoring can follow the release rather than block it.
- **Completion threshold decision** — 80% (dashboard) vs 70% (LinkedIn Learning). Phase 2 assumes
  80% for parity unless a clinical/CME view says otherwise.
- **Position vs watched-time** (Phase 2, raised by the red team and left open). The server's
  high-water mark is a *playhead position*, not watched time, so dragging the scrubber to 81%
  completes a topic — dashboard parity, but Phase 6 adds three first-class seek controls that
  make it easier. Watched-segment accumulation is a costed follow-on, not assumed. Decide with
  the same clinical/CME owner as the threshold.
- **Notes go/no-go** (Phase 6, Gate B). Notes is the only item in this roadmap that creates a
  new user-content store with clinical/PII implications, and nothing in the production evidence
  measures note usage. The plan owner must answer *what observable would tell us this was worth
  building* before Phase 6 starts. It is explicitly **not** a fallback if the transcript gate
  fails. Not engineering.
- **Certificate flag owner** (`CERTIFICATE_DOWNLOAD_MAINTENANCE`, CTP-834/399). Out of scope
  here; without it, completion has no payoff. Tracked, not built.
- **API upstream merge** of `feat/sector-api` — see the port leftovers audit.
- **Leader authorization** reuses `assertLeadsGroup`, which is a no-op when
  `GROUP_LEADER_SCOPED_VISIBILITY` is off (flag is on today). Applying it to the currently
  unscoped assignment routes moves plain `administrator` from 200 to 403 on those routes;
  whether administrators should read groups they do not lead is an open product question.

## Red Team Review

### Session — 2026-09-14
**Reviewers:** Security Adversary (Fact Checker) · Failure Mode Analyst (Flow Tracer) · Assumption Destroyer (Scope Auditor) · Scope & Complexity Critic (Contract Verifier). Reports in `reports/`.
**Findings:** 15 after deduplication (14 accepted, 1 rejected). Raw: 9 + 8 + 10 + 11 = 38, ~128 plan claims fact-checked (118 verified, 6 failed, 4 unverified).
**Severity breakdown:** 4 Critical, 7 High, 4 Medium.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Completion is client-asserted (`hasVideo`/`videoCompleted`); plan preserves it while stacking leader report, CME and reminders on it. Position write races the `/track` transaction. | Critical | Accept — server-decided completion via high-water mark | Phase 2 (+4, 7, 8) |
| 2 | Reminder job: ceiling 500 < 843 overdue learners → sends nothing; send-then-stamp under inherited 28 s timeout → duplicates; no age cutoff. | Critical | Accept — per-stage ceilings, drain-N, claim-then-send, explicit Lambda block, 90-day horizon | Phase 4 |
| 3 | Transcript rests on a non-existent SDK field; VTT needs REST + token server-side. | Critical | Accept — proxy/cache route, re-estimate, re-decide gate | Phase 6 |
| 4 | Phase 8 rebuilds `GET /groups/manage/report/:groupId`, which exists, is guarded and is on the Exports tab; "shared row builder" is an N+1. Also duplicates the fixed dashboard assignments route. | Critical | Accept — extend existing report, batch N+1, fix CSV | Phase 8 |
| 5 | IDOR remediation names 2 of ≥7 unscoped handlers in `group-assignment.controller.ts`. | High | Accept — sweep all read handlers | Phase 4 |
| 6 | `GROUP_LEADER_SCOPED_VISIBILITY` off makes every `assertLeadsGroup` a no-op; never named. | High | Accept | Phases 4, 8 |
| 7 | "administrator unchanged" is false; fix moves administrator 200→403. | High | Accept as correction; open product question | Phases 4, 8 |
| 8 | `PlayerFrame` hoist not implementable (iframe inside sanitised HTML); header built in P3 then relocated in P5. | High | Accept — cut hoist; header built once | Phases 3, 5 |
| 9 | "WP table links still resolve" false for 1,051 of 1,468 hrefs (absolute, `target=_blank`). | High | Accept — generated module page replaces table at P3 | Phase 3 |
| 10 | Opt-out as a new collection + domain + client trio, per-group, which a cross-group digest cannot honour. | High | Accept — per-user flag on account profile | Phase 4 |
| 11 | Assignments tab moved onto dashboard route for totals rows already carry; second link builder. | High | Accept | Phase 4 |
| 12 | Duration under two field names; client duration persisted then trusted; no rate limit on position route. | Medium | Accept | Phases 2, 3 |
| 13 | Regression gates read a mirror with 10 progress docs; 75–99% stalled learners not retroactively flipped; `cleanseUserProgress` and recompute Lambda can wipe positions. | Medium | Accept — gates against production read-only; files added | Phase 2 |
| 14 | Phase 1: durations/thumbnails need NO token (public oEmbed verified on all 35 topics); backfill precedent has no non-localhost path; `?h=` embeds (272) and YouTube (7) unhandled; counts 868/464; cited test file missing. | Medium | Accept — oEmbed first, token only for captions | Phase 1 |
| 15 | Tests-first in Phase 2 wasted on unchanged server functions. | Medium | **Reject** — with #1 accepted, those functions change | — |

**Folded corrections:** `sendBeacon` on tab close; Continue row via server `status=in_progress` + `lastItemAccessed`, not four outline calls; Notes gets its own go/no-go; Phase 7 console PR gated on a named content owner; "≥40% resume" metric needs an event or is dropped; email provider defaults to SendGrid; Phases 4→5 merge order for `sweep-routes.json` and locales.

**Verified as claimed (not findings):** authorisation holes at `:673` and `:768`; `assertLeadsGroup` reusable (15 callers); all 4,595 `dueDate`s at 00:00 UTC; `lastItemAccessed` on the model; `wasCompleted` forward-only short-circuit holds in code.

### Whole-Plan Consistency Sweep

**Run 2026-09-14, after the fourteen accepted findings landed.** All eight phase files plus
`plan.md` re-read end to end in a single pass — deliberately not fanned out, because the point
is to catch contradictions *between* files, which a per-file reviewer cannot see. Marker
coverage was verified first: every accepted finding F1–F14 appears in at least one phase file,
and the rejected finding is annotated as rejected with tests-first retained.

| # | Stale claim left by the red-team edits | Where | Resolution |
|---|---|---|---|
| S1 | `dependencies: [1]`, but the phase consumes `summariseOutline`, `groupTotalSeconds`, `groupOutlineItemsForDisplay` and `formatDurationShort` — all created in Phase 3 | phase-07 frontmatter | → `[1, 3]` |
| S2 | Create list said `groupRemainingSeconds`; step 7 says total, not remaining | phase-07 | → `groupTotalSeconds`, cross-referenced to step 7 |
| S3 | Risk row still promised "length and count caps for objectives, enforced server-side with tests" — step 3 and the test list had just removed exactly those caps | phase-07 | Row rewritten to agree with step 3 |
| S4 | "158 **published** courses describe themselves with nothing" — only 146 of the 175 are published, so 158 published is impossible | phase-07 | → "158 of the 175" |
| S5 | Success criterion "every one of the 146 published courses, including the 158 with no description" — same arithmetic | phase-07 | Reworded |
| S6 | Quoted Phase 1's "the token has one job" — a sentence the F14 edit had already removed from Phase 1 | phase-06 (×2) | Both rewritten to describe the two call sites without quoting a line that no longer exists |
| S7 | Phase 1's security section never said that Phase 6 puts the same token in a learner-facing request path | phase-01 | Bullet added, with the constraint it imposes on `vimeo-rest-client.ts` |
| S8 | "Phases 5–6 = Release 2, gated on the caption-coverage number" — after F8, Phase 5 is a pure `apps/web` route restructure with no Vimeo dependency at all | plan.md | Release table rewritten; the gate is scoped to Phase 6's Transcript tab |
| S9 | No revised effort anywhere in plan.md, after seven of the eight phases changed cost | plan.md | Release table now carries 26 / 12 / 9 = **47 d** |
| S10 | Two open questions the red team created lived only inside phase files | plan.md | Position-vs-watched-time and the Notes go/no-go added to Dependencies |
| S11 | Overdue assignments: 2,440 (plan.md, production Atlas) vs 2,435 across 843 learners (phase-04, mirror) — same 4,595 denominator | plan.md ↔ phase-04 | **Unresolved.** Atlas IP whitelist had lapsed, so it could not be re-measured. Flagged in the Overview as a re-measure before Phase 4 starts; no plan decision depends on the value |

**Checked and found already consistent** — no edit needed: the effort in every phase's
red-team delta comment matches its own frontmatter (8 of 8); the Phase 4 → Phase 5 merge order
for `sweep-routes.json` and the seven locale files is stated identically in both risk tables;
Phase 5 and Phase 7 state the same `courses-routes.tsx` / `courses-links.ts` ownership rule
from both sides; the locale baseline is 432 keys in phases 3, 6 and 7 alike; Phase 6's gate is
"≥70% of 464 distinct ids" and Phase 1 reports over exactly that denominator; Phase 2's sole
ownership of the outline wire holds in phases 1, 3, 5 and 7, and the name
`videoDurationSeconds` appears nowhere in the plan; `use-vimeo-watch-tracking.ts` is edited by
phases 2, 5 and 6 in an order their `dependencies` already enforce; and the "no playback
positions, no notes in any leader surface" boundary is asserted from all three of phases 2, 6
and 8.

**One judgement call left standing.** Phase 4 declares `dependencies: [3]` although it shares
no code with Phase 3 — it is a release-sequencing dependency, not a technical one. Left as
written, because it is what makes the Phase 4 → Phase 5 locale and sweep-route merge order
enforceable.
