# Brainstorm: Sector upgrade — features and UX

**Date:** 2026-09-16 · **Mode:** interactive brainstorm, no HTML/wiki output requested · **Repo:** `scanvault` (public, `khoIT/sector`) · **Branch:** `main` at `0d8bca2`

**Ask (verbatim intent):** review the whole of Sector against the legacy dashboard on :3000; make the design use the available space; make the course page show what the course is about; produce a comprehensive plan covering features and UX.

**Decisions taken in session:** fluid shell with per-surface measure **and mobile-friendly**; one course page (landing + expandable modules); full scope across three releases; i18n sweep of the scan surfaces included in Release 1; transcripts to be generated ourselves where Vimeo has none.

Evidence screenshots (2200×1300 and iPhone 13, captured 16 Sep, zero console errors) are held locally and deliberately not committed: they were taken against a restored database and show real learner names, email addresses and customer group names, which this repository is public. Reproduce them with the sweep recipe in `README.md`.

---

## 1. Problem statement

Sector shipped at route parity with `gusi_web_dashboard` and is the demo target. Three things are wrong with the experience:

1. **Unknown feature gaps.** Parity was audited per route, not per interaction. Nobody has a current list of what a user could do on :3000 and cannot do in Sector.
2. **Wide screens are wasted.** Every page is capped at 1400px and centred; on the user's ~2200px viewport, 28% of the content panel is empty parchment on each side.
3. **The course entry page is a bare list.** `/learn/courses/:id` shows 46 rows and a percentage. The description, cover, counts and CTA live on a second page (`/about`) reached by a small link.

## 2. Requirements captured

| Item | Answer |
| --- | --- |
| Expected output | A phased implementation plan (`/ck:plan`) covering three releases; this report is its source. |
| Acceptance | Every route renders without horizontal document scroll at 390px; at 2200px no page shows dead gutter beyond its declared measure; the course entry page leads with the description for the 96 production courses that have one; the open parity items below are either built or listed with a reason; the Netlify demo (staging API) keeps working throughout Release 1. |
| Scope boundary | No API deploy in Release 1 (48 API commits are unpushed, deferred by the user). Retired legacy surfaces (commerce, fellowship v1, referrals, in-app notifications, self-registration) stay retired. Assessment/quiz redesign is a separate brainstorm. |
| Constraints | Public repo, no secrets; seven-locale i18n gate; fidelity manifest decision for every new schema; production Atlas read-only; conventional commits; no plan IDs in code. |
| Touchpoints | `apps/web/src/shell/app-shell.tsx` (the cap), `packages/ui` (new `PageFrame`), `features/courses/{outline,landing,shell,my-courses}`, `features/create-scan/steps/study-surface.tsx`, `features/scan-list/table`, `features/scan-detail`, `app/legacy-route-map.ts`, `i18n/locales/*`, API worktree `src/lib/vimeo/*`, `src/lib/queue/*`. |

## 3. Findings

### 3.1 Parity with :3000

- **Routes: complete.** `docs/decommission-dashboard.md` maps all 57 legacy URLs — 38 forward, 19 retired with evidence. Nothing route-level is missing.
- **Inside surfaces: ~50 open items** (`plans/reports/from-parity-audit-to-backlog-260913-0640-*.md`). Major and still open: prev/next through a queue (+ j/k), mark complete/incomplete, request expert review on an existing scan, add/delete files after submit, per-file delete, reset-upload recovery, group filter empty for leaders, required findings advisory only. `packages/api-client` already wraps tags, reset-upload, review credits and file writes; the UI does not surface most of them.
- **Shell:** legacy had a ⌘K command menu (`search-menu.tsx`). Sector has none.
- **Account:** legacy "extended profile" tab (profession, licensing, country of practice, emergency contact) not ported. Low value; listed, not planned.
- **i18n:** create-scan 4/27, scan-detail 4/22, account 4/10 components use `useTranslation`. 432 keys baselined as untranslated in six locales.
- **AI review:** `reviewMD`/`translatedReviewMD` render on scan detail today; the audit's "388 scans carry AI review data rendered nowhere" refers to a distinct field — verify which before planning phase 13.

### 3.2 Course entry page regression, and a wrong premise

Legacy `/my-courses/:id/list` (`list-content-v3.tsx`) showed on one page: back link, course label, title, counts, progress ring + status, expiry, **description (2-line clamp)**, certificate card when complete, lesson cards. Sector split this: outline at `/learn/courses/:id`, landing at `/about`.

Phase 7 justified the split with "158 of 175 courses carry no description, verified against the mirror". Re-measured 16 Sep on `gusi_prod_mirror.v2courses`: **96 of 102 live published courses have a description**, 100 over 200 characters. The 17/175 figure matches `gusi_dev` (8 with content), not production. The sparse state the page was optimised for is the rare case.

### 3.3 Width

`app-shell.tsx:96` — `max-w-[1400px] mx-auto` on every page. Breakpoint usage across features + shell: `sm:` 21 files, `md:` 5, `lg:` 15, `xl:` 5, `2xl:` 0, container queries 2. At 2200px:

| Surface | Today | Waste |
| --- | --- | --- |
| Course outline | 46 full-width rows, title left / pill right, ~1,200px empty per row; 2,384px tall | severe |
| My Courses | 3 cols, 415px cards, 230px cover placeholder (10 of 102 courses have a cover); 50 enrolments = 3,280px | severe |
| Player | pane 320 + column ~970; prose ~180 chars/line | moderate |
| Groups / queues | tables stop at 1400; 1,477 groups | moderate |
| Gallery / question banks | 4 / 3 cols fixed | moderate |
| Create-scan | 2 cols at `xl`, findings rows stretch label→buttons across ~1,000px | moderate |

### 3.4 Mobile (iPhone 13, 390px)

- **Expert queue scrolls the document sideways by 1,118px** — the six-column table has `overflow-x-auto` on its wrapper but the page still overflows; no card fallback exists for any table.
- **Player puts the 46-item contents pane above the video**; the learner scrolls past the whole outline to reach the lesson.
- My Courses: 50 cards stacked → 7,634px. Course outline → 3,405px.
- Shell (hamburger, icon tabs, topbar) works. No other horizontal overflow found on the 10 routes swept.

### 3.5 Transcript facts (re-measured 16 Sep)

- `v2topicmedia` after the 15 Sep token backfill: **387 of 465 videos (83%) carry text tracks**, all with English; 735 of 887 topic rows. The plan's 59.8% and the 70% gate are stale — the gate is met.
- Remaining 78 videos: 43 gone (404 both ways); 35 alive on public oEmbed (5.8 hours) but **404 to the token** — not shared with the Contributor seat.
- **Media is not downloadable with this seat.** Probe on a visible video: `privacy.download=false`, `download[]`/`files[]` absent, `play` carries only a status. Speech-to-text "ourselves" needs one of: owner enables download / grants `video_files`; the missing folders shared with the seat; source files from the content team. The queue worker container already has ffmpeg; the job itself is small.
- Total library runtime 71.8 hours (65.9 already captioned). Existing infra: Agenda queue (`src/lib/queue`), typed `JobDefinition` registry, `backfill-topic-media` worker, Vimeo REST client with `/texttracks` and `/chapters`.

## 4. Approaches evaluated

### Width

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **A. Fluid shell, per-surface measure** | Fixes gutters at any width; reading pages keep a proper measure; one primitive to reason about | Touches every page; needs a visual gate | **Chosen** (+ mobile as a gate) |
| B. Cap 1400→1680 + grid steps | One line + grid tweaks | Still gutters on 2560; prose pages get wider than they should | rejected |
| C. Density toggle | Cheap | Does not use the space | rejected |

### Course page

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **A. One page: landing + expandable modules** | Matches legacy behaviour and the design (`design/shots/2-landing.png`); description leads; player pane already is the outline | Retires a route pinned by legacy-route-map tests (deliberate) | **Chosen** |
| B. Hero above outline | Fast | Duplicates landing; keeps 2,400px list | rejected |
| C. Overview / Outline tabs | Middle ground | Two lists of the same items | rejected |

### Scope

Tier 1 (web-only) / +Tier 2 (API-dependent parity) / +Tier 3 (new capability). **All three chosen**, sequenced so Release 1 needs no API change and ships to Netlify against staging.

### Transcript source

| Option | Verdict |
| --- | --- |
| Proxy Vimeo tracks only | Base of the phase; 83% coverage clears the gate |
| Generate ourselves (ASR) for the rest | **Chosen as an add-on, gated on media access** (§3.5); 5.8 h of audio, worker has ffmpeg |
| Hold / drop | rejected |

## 5. Final design

### Principles

1. **Web first, API second.** Release 1 is `apps/web` + `packages/ui` only. Release 2+ UI hides itself when its route answers 403/404, so a build against staging never shows a dead button.
2. **One layout system.** `PageFrame` in `@sector/ui` with measures `reading` (~80ch), `working` (fluid to 1920), `full` (media). The shell stops owning width; each route declares its measure.
3. **Mobile is a gate.** Every phase's acceptance: no horizontal document scroll at 390px; Playwright sweep at 390 / 1440 / 2200 extends the existing route sweep. Tables gain a stacked-card row under `sm`.

### Release 1 — layout and courses (web-only, ~21 days)

| # | Phase | Scope | Acceptance | Days |
| --- | --- | --- | --- | --- |
| 1 | Layout system | Remove the cap; `PageFrame` + measures; `2xl` grid steps (courses 5, gallery 6, question banks 4, home 4-up); tables fluid; card-row fallback for scan and group tables; fix queue overflow; 3-width sweep | Sweep green at 3 widths on every built route; no route overflows at 390; token contrast suite unchanged | 4 |
| 2 | Course page | `/learn/courses/:id` renders the landing; module rows expand inline to topics/quizzes with status, duration, question count; description leads; `/about` → redirect; My Courses links both states here; outline page retired; route-map pins + generated doc updated; Phase 7 premise corrected in its plan | Description visible for every course that has one; Start/Continue resolves to the same item as before; legacy-route-map tests updated and green | 3 |
| 3 | My Courses density | Grid/list toggle in URL state (reuse `list-url-state`); compact card (slim header strip when no cover); description excerpt, counts from `courseMetaVersion` (already on the wire), expiry, last active; 5 cols at `2xl` | 50 enrolments fit in ≤2 screens at 1440 in list view; no placeholder taller than 96px | 2 |
| 4 | Player wide + mobile | At `xl`+, Overview/Transcript/Notes panel beside the video (contents \| video + title \| panel); prose at reading measure; on phones video leads, contents becomes a drawer from the breadcrumb ("Contents 3/46"), prev/next in a sticky bottom bar | Video visible without scrolling at 390; prose ≤ 90ch at any width | 3 |
| 5 | Create-scan three columns | `2xl`: files \| findings + note \| expert review + routing summary; rail sticky; mobile order setup → files → findings → note → review, sticky submit bar | Findings rows never exceed ~70ch label-to-control; draft persistence unchanged | 2 |
| 6 | ⌘K command menu | Routes, nav destinations, recent scans and courses from cached queries; client-only; build on `@radix-ui/react-dialog` or add `cmdk` | Opens with ⌘K/Ctrl-K on every authenticated route; keyboard-only operable | 1.5 |
| 7 | Queue navigation | Prev/next and j/k on scan detail within the current list; row-click opens; list position in URL | Reviewer can step the whole Expert queue without returning to the list | 1.5 |
| 8 | i18n sweep | create-scan, scan-detail, account: every string through `t()` in all seven locales; no new baseline entries | i18n gate green with zero additions to `locale-completeness-baseline.json` | 4 |

Phases 1 + 2 fix what the user's screenshot and URL showed; ~7 days to a demo that reads right.

### Release 2 — API-dependent parity (~9 web days; waits on the API branch reaching staging)

| # | Phase | Note |
| --- | --- | --- |
| 9 | Mark complete / incomplete | tags routes; api-client wrapped; **server ownership check first** (security finding 3) |
| 10 | Request expert review on an existing scan | request-expert route has no `withPermission` — guard first |
| 11 | Add / delete files after submit | add-files exists; delete has no ownership check — guard first |
| 12 | Reset-upload recovery UI | client wrap exists; verify end-to-end against the reset controller |
| 13 | AI review panel | identify the unrendered field (388 scans) before scoping |

Ordering rule: UI for 9–11 ships **after** the server guard lands. Sector must not be the first client to expose unguarded writes from learner screens.

### Release 3 — new capability (~14 days, each gated)

| # | Phase | Design | Gate |
| --- | --- | --- | --- |
| 14a | Transcript from Vimeo tracks | API: proxy + cache route over `GET /videos/{id}/texttracks` (signed, expiring links); one schema `{videoId, language, source: 'vimeo' \| 'generated', cues[]}` + fidelity decision. Web: VTT cue list, active-cue highlight, click-to-seek via `@vimeo/player` `setCurrentTime`, English first then locale fallback. Videos without any source show "No transcript for this video". | Met — 83% coverage |
| 14b | Generated transcripts | Agenda job on the queue worker: fetch media → ffmpeg audio → speech-to-text → cues stored with `source: 'generated'` and a visible "auto-generated" label; served by the same route | **Blocked on media access** (§3.5). Decision needed: owner enables download/`video_files`, shares folders, or content team supplies source files. 5.8 h of audio once unblocked. |
| 15 | Notes | New `coursetopicnotes` collection, four routes, soft delete, PII handling; web tab with timestamped notes | Plan owner names the observable. Proposed: notes per active learner per week; return-visit rate of note-takers vs others |
| 16 | Certificates | Card on the course page for completed courses; download through the existing certificate endpoint | `CERTIFICATE_DOWNLOAD_MAINTENANCE` owner (CTP-399); 2,860 completers hold a record with no file |

## 6. Implementation considerations and risks

- **Removing the cap changes every page.** The 3-width sweep is the gate and runs before phase 1 merges. Keep `PageFrame` measures explicit; no page may rely on the old cap.
- **Course-page merge changes pinned URLs.** `legacy-route-map.ts` `SECTOR_PATH` tests assert `/learn/courses/:courseId`; the path stays, the element changes; `/about` redirect must be in the map so old links and the My Courses cards keep working. Regenerate `docs/decommission-dashboard.md`.
- **Mobile tables.** One card-row component in `@sector/ui`, driven by the same column model as the table, so the scan list, groups and report tables share it.
- **Release 2 exposure.** Client gating is not a control; the server guards are. Phases 9–11 depend on the API team merging the guard commits already on `feat/sector-api`.
- **Transcript proxy** carries a cache with expiry and a CORS story; cache keys include language; never store the signed link.
- **Generated transcripts are clinical text.** Label them, allow "report an error", and keep them out of any search index until reviewed.
- **Netlify demo** builds against staging (10 Sep API). Every Release 1 phase must render correctly there: feature-detect, never assume the new routes.
- **Observability is zero at cutover** (audit); success metrics below need at least page-view + event logging before they can be read.

## 7. Success metrics

- Layout: 0 routes with horizontal overflow at 390px; 0 routes whose content is narrower than 85% of the panel at 2200px unless declared `reading`.
- Courses: % of course-page visits that click Start/Continue (baseline unknown; capture from phase 2); My Courses time-to-first-Resume on mobile.
- Parity: open items in the parity backlog drop from ~50 to the explicitly retired set.
- Transcript: share of topic views with a transcript available ≥ 83% at launch; ≥ 95% once media access lands.
- i18n: zero baselined gaps for create-scan / scan-detail / account.

## 8. Next steps and dependencies

1. Run `/ck:plan` from this report → `plans/260916-1705-sector-upgrade-features-and-ux/` with 16 phase files; Release 1 phases first.
2. Ask the Vimeo account owner (business, not engineering) for: folder sharing to the seat for the 35 unreadable videos; download or `video_files` for generated transcripts; a captions pass on the 35.
3. Ask the content team to fix or remove the 43 gone videos.
4. API team: merge the ownership guards before Release 2 UI starts.
5. Someone with analytics ownership: restore page/event logging so §7 can be measured.

## 9. Unresolved questions

1. **Media access for generated transcripts** — which of the three routes (owner setting, folder sharing, source files) will GUSI grant, and who asks?
2. **Notes observable** — what will tell us Notes was worth building? Without an answer, phase 15 stays deferred.
3. **AI review field** — which field holds the 388 scans' unrendered data, and is rendering it wanted for learners or only reviewers?
4. **Extended profile tab** — port, or retire with a note in the decommission doc?
5. **Which locales have real users** — decides whether the 432 baselined gaps are a content task now or later.
6. **Certificates owner** — who flips `CERTIFICATE_DOWNLOAD_MAINTENANCE`, and does the API's certificate generation still work?
