# Sector — naming, architecture, and what it takes to replace the dashboard

**13 Sep 2026.** Brainstorm behind
[`plans/260913-1451-sector-replaces-scanhub/`](../260913-1451-sector-replaces-scanhub/plan.md).
Question asked: what does ScanVault need to become a true replacement for
`gusi_web_dashboard` at :3000, keeping the flows and information users rely on and
rewriting everything messy underneath — and what should it be called.

## Problem

ScanVault is a scan client with no backend. The dashboard is the whole learner
platform. Three prior studies had already mapped the delta (a module-by-module port
plan, a 90-claim parity audit, a clickable prototype of the missing surfaces). What
was missing was a decision on three things, and a name.

## Decisions taken

### 1. Data layer — one API, one authorization model, fidelity proven against real dumps

Rejected: a BFF in the scanvault monorepo reading Mongo directly; and owning the data
layer outright.

Evidence that settled it:

- **The client cannot reach S3 at all.** `gusi_nodejs_api/src/lib/s3.ts` signs media
  with a **CloudFront key pair** (24h TTL) and presigns S3 objects (10 min). The private
  key is a server secret. Direct-to-S3 means moving that key into a second service.
- **Authorization is granular strings plus wildcards** in `config/permissions.ts`, and
  the port already mishandles `full-access` / `admin:full-access`. A second reader means
  a second place for an authz bug. `course-meta-version.route.ts` ships eight
  `withPermission` guards commented out on `main` — a live demonstration of the cost.
- Transactions (`withTransaction`) and the notification side effects live in the API.
  The scan-notify defect proved that calling a different endpoint silently drops email,
  push and the activity log.

So "handle all real raw data" is answered as a **test, not an architecture**: restore
the production dumps into a local mirror and replay every real shape through every Zod
schema in CI. The material is already on disk:

| Dump | Size | Holds |
| --- | --- | --- |
| `dump-prod-content` | 12M | courses, the whole v2 LMS, pathology, scan types, forms, orgs, roles |
| `dump-prod-scans` | 158M | scans, files, findings, notes, reviews, groups, shares, purchases |
| `dump-prod-scan-owners` | 476K | users (scan owners) |
| `dump-staging-scans` | 54M | the scan domain from staging |

**Stated limit:** dumps carry file *records*, not S3 *objects*. Media bytes are not
reproducible from them. Metadata fidelity is testable now; real-object playback needs
staging S3 access, which is an ask.

Nothing in the plan connects to the production cluster. Restores are local; refreshing
a dump is a read.

### 2. Home screen — ported properly

Recommended a light "Today" surface (~4 days). **Overruled in favour of the full port
(~22 days).** Recorded because it is +18 days and the largest line in the plan.

The port is not a copy. Two of four role dashboards are dead today — `group_leader` and
`scan_reviewer` fall through to `<AdminDashboard/>`, so two roles get a surface built
for a third while 412 lines of purpose-built dashboards sit unshipped, and 21% of the
module is unreachable. Chart colours and translation keys are derived by comparing
**English label strings returned by the API** (`label === 'Completed'`), so a server-side
rename renders grey slices and raw missing-key strings, silently. `console.log` ships
inside a `useMemo` in the admin hot path. All three are rewritten, not carried.

### 3. Name — Sector

"ScanVault" was outgrowing itself: the app is about to hold courses, quizzes, a gallery
and group administration, and **Scan Vault is already a module name inside ScanHub** and
an unreachable tab in the old dashboard. Same word, three referents.

Four candidates, four naming strategies:

| | Strategy | Verdict |
| --- | --- | --- |
| **Sector** | Name the artefact — a sector scan is the phased-array wedge | **Chosen.** Best mark by a distance; the icon is the product. |
| Bedside | Name the practice; POCUS *is* bedside ultrasound | Warmest, weakest as a mark — Core Ultrasound and SonoSim already use "bedside" as descriptive copy. |
| Sono | Name the field; the `sono-` root survives all seven locales | Legible everywhere, but generic and thin on trademark. |
| Gain | Name the mission twice: the instrument control, and learning gain | Strongest meaning, worst icon, unsearchable. |

**Killed after a search: Caliper.** It was the favourite — the on-screen measurement
marks, instantly legible to anyone who has used an ultrasound machine. But
[1EdTech Caliper Analytics](https://www.imsglobal.org/activity/caliper) is a widely
adopted learning-analytics standard (Blackboard, D2L, Instructure, McGraw-Hill).
Naming an LMS after it is a collision you would live with forever.

No trademark or domain search has been done. That is a real step before the name goes
public, and not one this analysis can perform.

## The mark

`plans/260913-1451-sector-replaces-scanhub/design/` — `sector-mark.svg` (currentColor),
`sector-app-icon.svg` (512, rounded), `sector-lockup.svg` (rail).

The phased-array wedge: apex (16,3), half angle 27 degrees, footprint radius 3.5, depth
radius 27 — taller than wide, the way a real sector scan is. `--accent` #EE7625 on
`--scan-ground` #14120F, the only two colours in the token file that hold their meaning
in both themes. Verified legible at 16, 24, 48 and 96px on both grounds.

One trap worth recording: **XML forbids a double hyphen inside a comment**, so writing a
CSS custom property name such as the accent token into an SVG comment silently breaks
the whole file. It broke two of these three on first render.

## What replacing :3000 actually costs

**~126 engineer-days. Two engineers: 13 calendar weeks. One: ~25.** Eleven phases; the
first user-visible thing ships in week two.

Deciding to replace rather than sit beside the dashboard also settled the parity audit's
open question 3, converting six arguable items into must-builds: mark
complete/incomplete, edit a submitted expert review, request expert review on an
existing scan, AI Review Generator, reset-upload recovery, add and delete files after
submit.

What the 126 days buys is a **smaller** product: one quiz engine instead of four, one
members surface instead of two, one server-resolved outline instead of four client-side
traversals, one group schema across read and write. Three of those consolidations are
cost-negative inside the port.

## Dropped, with the evidence

- **Commerce** (~13,000 LOC, ~35 endpoints) — every flag false, storefront routes
  commented out, checkout submit handler commented out, 0 rows in orders, subscriptions
  and payment methods. Money flows through scan-review credits (3,111 purchases locally),
  which is already ported. **Separately urgent:** the broken checkout is live and linked
  from the expired-course banner — a learner enters a full card number, presses Pay, and
  gets no order, no error, no navigation. Fix or unlink it in the old app today.
- **Fellowship V1** (2,347 LOC) — frozen 2025-07-02, superseded by 57 v2 endpoints no
  React calls, and `/api/schedule-slots` is not mounted, so scheduling 404s today.
- **Rapid Review ×2** (251 LOC) — sandboxed iframes onto a third-party Reflex app, both
  flags false, identity asserted by unsigned URL query string. Not GUSI code.
- **Resources** (3 LOC) — a `ComingSoon` stub, no nav entry, no inbound link.
- **Referrals** — 0 documents against 3,152 users, plus an enumerable PII leak.
- **Push notification settings** — 4 documents against 3,152 users.
- **~9,250 LOC of unreachable v1/v2 forks** that would otherwise inflate every estimate
  by ~150%.

## Risks worth naming

1. **API capacity is not committed.** The 2–3 day read seam gates roughly 27 of the 126
   days. Without an API engineer, Phases 6, 7 and 9 have no safe start.
2. **The `z.any()` progress blobs** are the largest estimate risk: +30% on the
   course-quiz work if they cannot be pinned against the mirror.
3. **GrowthBook is the runtime authority and nobody in this study could read it.** Every
   flag-default drop above rests on code defaults. Ten minutes of dashboard access can
   falsify several. Do that before deleting anything.
4. **Starting course UI before the read seam** is the one irreversible mistake — a
   scheduling risk, which makes it the easy one to lose to pressure.
5. **Eight commented-out authorization guards are live on `main`.** Sector makes them
   worse by adding a second client that reaches course versions. Triage before Phase 5.

## Follow-up, not in the plan

`docs/system-architecture.md` and `docs/gusi-company-context.md` still describe
ScanVault. They get a line each once Phase 1 lands — not before, since they document
what is true rather than what is planned.

## Unresolved questions

1. Is the immutable-snapshot **write** fix funded, and is it CTP-1016? Learner progress
   keeps corrupting until someone does it; the read seam does not fix it.
2. Production GrowthBook state for the nine flags the drops rest on?
3. Which of the seven locales have real users? Three surfaces need translating and only
   locales with learners are worth it.
4. Who owns `CERTIFICATE_DOWNLOAD_MAINTENANCE` / CTP-399? Until it lifts, course
   completion has no payoff — worth knowing before Phases 6–7 spend 23 days.
5. Where does `gusi_scanhub_console` live? Every authoring claim is inferred from the
   API contract, never observed.
6. Is Sector the public name or the internal one? Trademark and domain search pending.
