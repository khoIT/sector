# Brainstorm — Sector course experience: what to build after cutover

**Date:** 2026-09-14 · **Scope decided:** learner experience in Sector, post-cutover, full feature set ("do all"), sequenced by evidence · **Out of scope:** authoring console, certificates/CME (tracked as dependency), assessment redesign (follow-on)

## 1. Problem, restated

User asked for "state-of-the-art LMS features" with LinkedIn Learning's clarity as benchmark. Problem-first inversion: the presenting solution (richer in-course UI) implies an unstated problem — learners lose track of where they are and what is left. Production data reframed it: **learners stop in the first quarter of a course and do not come back.** In-course polish serves people already watching; the loss is people who left.

## 2. Evidence

### Content model (mirror = production content dump, 14 Sep 2026)
- 175 courses (146 published) · 626 modules · 1,480 topics · 507 quizzes · 2,341 questions. Every doc carries `wpId` — migrated WordPress/LearnDash, authored 2019–2020.
- Course metadata thin: title, HTML description, status; CME code/credits on 93; cover image on **2/175**; duration on **0** (console has the field). No level, objectives, prerequisites, tags.
- Module page = hand-authored HTML `<table>` of `<a><img>` linking to `/dashboard/...` URLs (155 modules; 166 empty). Breaks at cutover regardless of this work.
- Topics: 891 embed Vimeo (465 distinct videos), 287 text-only, 22 PDFs. No duration/transcript/caption reference anywhere.
- Quizzes: no passing score / time limit / attempt cap as data; pass = server constant 60%. 147/507 have zero questions. Questions: 1,701 with explanations, 827 with image/clip stems.
- Progress: per-item binary; resume pointer; no playback position. Dashboard completed a topic at 80% watched; **Sector's port completes on `ended` (100%)** — a regression.
- Certificate: PDF + CME wording, generated server-side, **disabled** (`CERTIFICATE_DOWNLOAD_MAINTENANCE`, CTP-834/399), not ported.
- Authoring: `gusi_scanhub_console` (:3002) has a DnD course builder, question editor (answerType, explanations), version approval workflow, preview. Lacks author analytics.

### Production usage (read-only counts, Atlas secondary, DB `gusi`, 14 Sep 2026)
| Metric | Value |
|---|---|
| Users / groups / memberships | 48,558 / 1,519 / 29,166 |
| Learners with any progress | 14,172 (29% of users) |
| Progress rows: 0% · 1–24% · 25–74% · 75–99% · 100% | 4,152 · **9,586** · 5,127 · **731** · 3,970 |
| Started courses stalled <25% | **58%** |
| Completion | 18.5% |
| Progress rows active last 30d / 90d | 1,743 / 4,425 |
| Certificate rows / with file | 2,969 / **109** |
| Assignments / dated / **overdue & open** | 8,734 / 4,595 / **2,440** |
| Quiz attempts recorded | 265,812 complete events |

Reading: almost nobody who reaches 75% fails to finish. Drop-off is early; return rate is low; the cohort loop is open (53% of dated assignments overdue, no reminder job).

### External research (4 lenses, 45 findings, skeptic kept 29)
Retained mechanisms with evidence: tri-state item status + watch-threshold auto-complete (LinkedIn 70%); durations and time-remaining at every level (Coursera/Udemy); cross-course "Continue at mm:ss" (LinkedIn/Udemy/MasterClass); landing page answering what/how-long/what-I-get with CME statement; assign→due date→auto-reminder→completion report (LinkedIn admin); interactive transcript + timestamped notes (+13 pts comprehension, USFSP 2019); chapters (segmenting effect meta-analysis); single persistent player shell.
Dropped for this audience: gamification/streaks; Sage "explain my answer" (27% of questions have no explanation to ground on); clip-drill (gains decay by 6 months without spacing); certification-pathway object (product definition first); authoring MVP (console exists).

## 3. Approaches evaluated
| | A — Foundation first | B — Cohort loop first | C — Player shell headline |
|---|---|---|---|
| R1 | Vimeo backfill, tri-state, Continue row, module pages | Reminders, overdue views, due-this-week | Shell: outline+player+transcript+notes+chapters |
| Pro | Everything stands on real data | Fastest buyer impact | Most faithful to benchmark |
| Con | Leaders wait one release | In-course unchanged for a release | Largest bet; captions unverifiable (no Vimeo token in any repo) |

User first chose C; after production numbers surfaced, chose **"do all"** → full scope, sequencing delegated to engineering.

## 4. Decision — full scope, evidence-sequenced

**Release 1 — Re-entry and rhythm** (targets the 58% stall and the 2,440 overdue)
1. Vimeo backfill job: duration + thumbnail per topic (needs Vimeo API token; 465 videos). Store on topic; roll up to module/course.
2. Playback position per learner per topic (new field on progress item), written throttled (every ~10–15 s) from Vimeo `timeupdate`.
3. Tri-state item status (not started / started / done); completion rule restored to **80% watched** (dashboard parity; LinkedIn uses 70%).
4. Outline header: `n/6 modules · n/35 topics · n/24 quizzes` + progress ring; per-item duration; "X min left" per module.
5. Home "Continue where you left off" row across courses: `%`, `min left`, `resume at mm:ss of <topic>`.
6. Generated module page from course structure (topic cards from Vimeo thumbnails; delete dependence on WP HTML tables).
7. Assignment reminder job (T-3 days + overdue digest) via existing SMTP path; leader view: not-started / in-progress / overdue per assignment.

**Release 2 — Player shell** (gate: caption coverage measured in R1 week 1)
8. Single persistent course route: Contents pane (tri-state), player, tabs Overview / Transcript / Notes; quiz renders in place; no full navigation between topic, quiz, module.
9. Transcript tab from Vimeo text tracks, clickable to seek — ships only if coverage ≥ agreed threshold; otherwise Notes-only and a content-team captions backlog.
10. Timestamped notes (click to seek), per learner per topic.
11. Chapters from Vimeo chapter markers (authored in Vimeo, no console change).

**Release 3 — Landing and cohort report** (paced by content team)
12. Course landing page: objectives, level, total hours, module list with counts/minutes, quiz count, CME credits + accreditation statement, Start/Continue CTA → exact next item. Fields authored in console; backfill objectives from existing HTML where present.
13. Leader completion report per group: per-learner course %, assignments status, last active; CSV export. "Due this week" on learner home.

**Tracked, not built:** certificate re-enable (2,860 completers without a file — owner CTP-834/399); assessment quality (per-CME pass mark, checkpoints, spaced re-quiz) → separate brainstorm; author analytics → console roadmap.

## 5. Implementation considerations
- **API side** lands on `feat/sector-*` branches (positions field, durations on outline, reminder cron, leader report route). Same upstream-merge dependency as the port; list in phase reports as "API changes required".
- **Write volume:** 925k activities already; position writes must be throttled and idempotent (upsert per learner×topic), not appended.
- **Completion-rule change** applies forward; items completed under `ended` stay completed. Certificates disabled → no gating side effect today.
- **Thumbnails:** WP images live on `legacywp-content` S3; prefer Vimeo pictures to avoid re-hosting.
- **Reminder copy** needs sign-off; per-group opt-out reuses group notification settings (Phase 3).
- **Leader report permissions** intersect the open authorization finding (plain `administrator` cannot read a group it does not lead) — reuse `assertLeadsGroup`; do not widen.
- **i18n:** every new string through `t()`; the gate checks keys only, so review usage explicitly (61/82 ScanVault-era components hard-code English — do not repeat).

## 6. Risks
| Risk | Mitigation |
|---|---|
| No Vimeo token / low caption coverage | Obtain token week 1; measure coverage on 465 videos; R2 transcript gated |
| Content team throughput (objectives, levels) | R3 paced to them; R1/R2 need none |
| Module-page visual change vs hand-authored cards | Preview with content team before replacing; keep WP image if present, Vimeo thumb fallback |
| API branches unpushed | Cutover dependency already tracked in leftovers audit |
| Position write load | Throttle + upsert; index learner×topic |

## 7. Success metrics (re-count from production; snapshot 14 Sep 2026)
- Started courses stalled <25%: 58% → ≤45% within two quarters
- Progress rows active in 30 days: 1,743 → +30%
- Overdue & open assignments: 2,440 → <1,000
- Completion: 18.5% → 25%
- Vimeo topics showing duration: 0% → 100%; resume-at-timestamp used on ≥40% of return visits

## 8. Next steps
1. `/ck:plan` from this report → phases per release above.
2. Week 0 prerequisites (not engineering): Vimeo API token for GUSI account; content-team owner for objectives/levels; certificate flag owner named.
3. Re-run production counts at each release to measure.

## Unresolved questions
1. Who holds Vimeo account access; can a read-only API token be issued?
2. Caption coverage on the 465 videos — unknown until (1).
3. Is 80% the accepted completion threshold (dashboard) or 70% (LinkedIn)? Clinical/CME view?
4. Who signs reminder email copy; is per-group opt-out required by any contract?
5. May WP-hosted thumbnails be reused, or must images be re-hosted before the dashboard bucket is decommissioned?
6. Leader report: does `administrator` (non-leader) get access — same question as the open API authorization finding.
7. Certificate re-enable owner and timeline (out of scope here, blocks "completion has a payoff").
