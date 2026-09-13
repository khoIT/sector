# Phase 10 — the home screen — implementation report

Branch `feat/sector-phase-10`, worktree `<scratchpad>/wt/phase-10`, merged onto `feat/sector`
twice (commits `88e3dc3` and `3766a3a`, both clean/mostly-clean — one real conflict resolved,
in nav-config.ts, both sides adding an icon import). Interrupted mid-task by a session rate
limit; resumed per coordinator instruction with the worktree/commits intact.

## What shipped

Four real dashboards, no fallthrough:

- `features/home/learner-home.tsx` — subscriber, wraps `MyLearningPanel`
- `features/home/group-leader-home.tsx` — led group(s) via existing `useGroups`, +
  `GroupLearningSnapshot` + own `MyLearningPanel`
- `features/home/scan-reviewer-home.tsx` — queue links (reuses `useNavBadges`), expert
  credits (reuses `useScanReviewCredits`), group snapshot if leading one, + `MyLearningPanel`
- `features/home/admin-home.tsx` — any-group picker (full-access `useGroups`), link to
  Group Administration, + `MyLearningPanel`
- `features/home/resolve-home-dashboard.ts` — role slug → component, unit-tested for an
  unknown role and a missing role, both resolving to the learner home, never admin
- `features/home/home-route.tsx` — mounted at `/` (`app/router.tsx`'s `index` route),
  replacing `VaultIndexRedirect` (deleted — its only caller). Home added as the first
  `NAV_GROUPS` entry (`shell/nav-config.ts`).
- Shared, DRY panels: `my-learning-panel.tsx` (self-scoped, used by all four) and
  `group-learning-snapshot.tsx` (group-scoped, used by leader/reviewer/admin; links to
  Phase 8's members surface via `groupMembersPathFor` — no second member table)

Chart primitives, `packages/ui/src/charts/*`: `Donut`, `Bars`, `LineTrend`, `Sparkline`,
wrapping `recharts` (added to `@sector/ui`'s deps, v2.15 — React 18 line). All colour comes
from `chart-colors.ts`, which maps a domain-free `ChartTone` (`neutral|accent|ok|warn|crit`,
same union as `BadgeTone`) to a `var(--token)` string — never `var(--accent)` (tested). SVG
`fill="var(--token)"` resolves live against whichever theme is on `<html>`, so no runtime
theme branch is needed and both themes get proven by the pre-existing token-contrast suite.

`packages/api-client`: 8 new dashboard endpoints (`endpoints/dashboard-*.ts`), schemas in
`schemas/dashboard.ts` keyed on status **codes**, `react/use-dashboard.ts` hooks,
`dashboardKeys` in `query-keys.ts`, full barrel exports.

## The 14 → 8 endpoint decision

Door-read count was 14. Excluded, all backing the legacy member table the phase explicitly
says not to port: `GET/POST /api/dashboard/group-users` (list + Excel export),
`POST /api/dashboard/course-progress-by-group-user` (export), `GET
/api/dashboard/learner-course-detail` (per-member drill), `PATCH /api/v2/quizzes/reset-attempts`
+ `GET /api/v2/quizzes/user-quizzes` (per-member quiz reset). That's 6 of the 14. Also
excluded `GET /api/dashboard/user-courses` — confirmed unused anywhere in the legacy
dashboards (grepped). `GET /api/groups/manage/user/:userId` (the leader's "my groups" lookup)
is replaced by the already-existing `getLedGroups`/`useGroups` (Phase 8), not rebuilt.
Net: 8 real, fidelity-proven endpoints — `charts`, `course-progress-chart`,
`top-course-progress`, `scan-progress-by-user`, `course-completion-timeline`, `qbank-stats`,
`topic-progress-by-user`, `quiz-progress-by-user`. Each used by every dashboard that needs it
(no per-role duplication).

## Bugs found and fixed, not carried over

1. **`GET /api/dashboard/charts`'s scan chart**: `data` is 7 entries (fixed `scanStatuses`
   order in `dashboard.controller.ts`), `labels` only 5 — zipping them (every legacy
   dashboard did) pairs "Submitted" with the `failed_upload` count and "Reviewed" with
   `partially_uploaded`, and drops the real submitted/reviewed counts. Fixed by
   `GROUP_SCAN_PROGRESS_STATUS_ORDER` — read `data` by fixed position against the verified
   server order, ignore `labels` entirely (schema doesn't declare it, so it's stripped).
2. Course-progress segments carry a `key` (`in_progress|completed|not_started`) the legacy
   dashboards never read, comparing `label === 'Completed'` instead. Every chart here derives
   colour/i18n from the code (`courseProgressStatusLabelKey`/`Tone`,
   `scanProgressStatusLabelKey`/`scanStatusTone`), proven by a regression test that renames a
   label mid-test and asserts nothing downstream changes.
3. The admin dashboard's `console.log`-in-`useMemo` group-selection logic (and the whole
   parent/child-group combo-box cascade it supported) is not ported — the four dashboards
   here have no equivalent code path.
4. Three real schema bugs the fidelity route replay caught against the live mirror API
   (not guessed): `topPerformingTopic`/`lowestPerformingTopic` and
   `topPerformingQuiz`/`lowestPerformingQuiz` are `null`, not absent, when a topic/quiz list
   is empty (`processed[...] || null` in the controller) — fixed to `.nullable()`.
   `topic-progress-by-user` rows only carry `completedItems`/`totalItems`/`inProgressItems`/
   `notStartedItems`/`totalTimeSpent` when the REQUEST itself passed a `courseId` — fixed to
   `.optional()`. All three verified by re-running the route replay clean afterward.

## Fidelity

`packages/api-client/src/fidelity/dashboard-routes.fidelity.test.ts` (new): live route
replay against the mirror API (`:5002`) for all four seeded accounts, all 8 endpoints.
Run directly (`pnpm vitest run -c vitest.fidelity.config.ts src/fidelity/dashboard-routes.fidelity.test.ts`
with `SECTOR_MIRROR_JWT_SECRET` exported): **8/8 passed**. Root `pnpm fidelity` (via
`turbo run fidelity`) does not forward the exported env var to the child process — this
predates my changes (same skip message on the very first run, before any edit) and affects
the pre-existing `routes.fidelity.test.ts` identically; flagging for whoever owns
`turbo.json`/the fidelity task config, not fixed here (outside this phase's file
ownership). `pnpm fidelity` proper (collections replay, 27 entries) still ran clean:
100% on every entry.

`manifest.ts`: every new schema excused in `NOT_REPLAYED` with the specific route/reason
(all are computed aggregates, no single source collection — same pattern as
`learnerCourseListItemSchema`), cross-referencing the live route-replay file as the actual
proof. `manifest.test.ts` (the "every schema has a decision" guard) passes.

One schema collision found and fixed: `dashboard.ts` originally redeclared
`courseProgressStatusSchema`/`COURSE_PROGRESS_STATUSES`/`CourseProgressStatus` — Phase 6/7's
`schemas/course.ts` already owns the identical three-value enum. Now imported from there
instead of duplicated (`tsc` caught this immediately as a duplicate-export error).

## Known gap, out of scope, flagged for the courses team

`getLearnerCourses` (`/api/v2/learners/courses`, `schemas/course.ts`) fails to parse for the
seeded learner account: `items[0].expiresAt` required-but-absent, and `expired[0].expirationType`
sees a live value (`'course_assignment'`) the enum doesn't list. Confirmed independently by
both the cold-load sweep (`/learn/courses` renders "This list could not be loaded") and my own
fidelity test (which now tolerates the failure with a `.catch()`, since it only uses that
route to find a real `courseId` — not something phase 10 owns or should fix mid-worktree, per
the `apps/web/src/features/courses/**` exclusion).

## i18n

242 was the legacy door-read; the real count for what actually shipped (no member table, no
per-member drill, no assignment progress — see scope cuts above) is ~50 leaf keys under a new
`home` namespace + `nav.home`, real (non-machine-copy) translations in all 7 locales, plus
reuse of the existing `status.*` namespace for scan-status labels (DRY — `partiallyUploaded`
already existed there). New parity test `i18n/home-locale-parity.test.ts`, same scoped-parity
pattern as the existing `locale-key-parity.test.ts` (asserts only the NEW keys, not
full-resource parity — a large pre-existing gap unrelated to this phase).

## Gates — all green, final run post-merge

`pnpm -w typecheck` / `lint` / `test` / `build`: clean. Root `test`: **792 passed** (apps/web,
including 4 new resolve/chart-adapter test files + the updated `nav-config.test.ts`/
`demo-account-access.test.ts` — both had to change: Home's now the landing surface, so
"lands on a scan surface" assertions became "lands on `/`", explicitly required by "Home
becomes the first nav destination") + **194 passed / 11 skipped** (api-client) + **127
passed** (ui, incl. `chart-colors.test.ts`). Build succeeds; pre-existing
>500kB-chunk warning persists (entry chunk grew ~5kB from recharts+charts — not
lazy-loaded, since Home is now the first thing every session opens, same as the Scan Vault
lists it replaces; flagged, not fixed, given the size of everything else already in the
programme's shared warning).

## Browser verification

Own Vite on `:3110` (`--strictPart`, `SECTOR_API_ORIGIN=:5002`), killed by PID when done
(`kill 36896 36824`) — port confirmed free after. Used the existing mirror API (`:5002`,
already running) and mirror db accounts (real ids read from `gusi_prod_mirror.users`).

- Shipped `scripts/check/cold-load-sweep.mjs` + 4 new `/` entries in `sweep-routes.json`
  (learner/leader/reviewer/admin, joining the pre-existing `reviewer` one): **30/30 routes
  healthy**, quiet console, real distinct per-role text ("Welcome back, Sector Learner…",
  "Group leader dashboard WCUCOM OMS II…", "Scan reviewer dashboard Expert scans —
  unreviewed 7…", "Administrator dashboard Manage groups…").
- One-off script (not committed — scratchpad tooling, mirrors the shipped sweep's
  session-minting) for the phase's explicit bar: all 4 roles × light/dark × 400px/1440px =
  **16/16 healthy**, `data-theme` correctly reflecting the toggle, quiet console.
  Spot-checked two screenshots visually (admin/dark/1440, reviewer/light/400): dark theme
  legible throughout, badges/tones correct, narrow layout collapses the sidebar and stacks
  cards cleanly with no overflow.

## Files

Created: `apps/web/src/features/home/{admin,group-leader,learner,scan-reviewer}-home.tsx`,
`home-route.tsx`, `resolve-home-dashboard.ts(+.test.ts)`, `my-learning-panel.tsx`,
`group-learning-snapshot.tsx`, `chart-adapters.ts(+.test.ts)`; `apps/web/src/i18n/
home-locale-parity.test.ts`; `packages/ui/src/charts/{chart-colors,donut,bars,line,
sparkline}.tsx(+.test.ts)`; `packages/api-client/src/schemas/dashboard.ts(+.test.ts)`,
`endpoints/dashboard-{course-charts,group-charts,learning-progress,scan-progress}.ts`,
`react/use-dashboard.ts`, `fidelity/dashboard-routes.fidelity.test.ts`.

Modified: `apps/web/src/app/router.tsx` (index → `HomeRoute`), `shell/nav-config.ts`(+.test.ts)
(Home first), `auth/demo-account-access.test.ts` (landing assertion), 7 i18n locale files,
`packages/api-client/src/{index.ts,query-keys.ts,fidelity/manifest.ts}`, `packages/ui/
{package.json,src/index.ts}`, `scripts/check/sweep-routes.json`.

Deleted: `apps/web/src/app/vault-index-redirect.tsx` (its only caller was the `index` route
I replaced; grepped for other references — none).

## Status

Status: DONE
Summary: Four real dashboards ship with no admin fallthrough, 8 fidelity-proven dashboard
endpoints keyed on status codes (not labels, with the mismatched-array bug fixed rather than
reproduced), recharts wrapped in token-driven chart primitives, and all four roles verified
in-browser at both themes and both breakpoints. Reduced 14→8 endpoints and 242→~50 i18n keys
from the door-read count, both by the same, disclosed cut: no member table, no per-member
drill, no assignment progress.
Concerns/Blockers:
- `getLearnerCourses` (schemas/course.ts, another phase's file) fails to parse for the
  seeded learner account — pre-existing, confirmed independently twice, not mine to fix.
- Root `pnpm fidelity` doesn't forward `SECTOR_MIRROR_JWT_SECRET` through turbo; ran the
  package directly instead (same result, all green) — a turbo.json config gap that predates
  this phase.
- Entry chunk is unlazy-loaded and now includes recharts; flagged rather than fixed, given
  Home replaces the always-eager Scan Vault redirect as the first screen every session
  opens.
