# Phase 10 — home screen, four role dashboards, chart primitives, eight dashboard endpoints

Adversarial review of the `feat/sector-phase-10` commits merged into `feat/sector` (merge `ce4f26c`,
docs `e32efa0`). Implementer report:
`plans/reports/fullstack-developer-260914-0126-phase-10-home-screen-report.md`.

Report only. No code changed.

## Scope

- Files: 47 changed in the merge, ~2,030 lines of new product source
  (`apps/web/src/features/home/**`, `packages/ui/src/charts/**`,
  `packages/api-client/src/{schemas/dashboard.ts,endpoints/dashboard-*.ts,react/use-dashboard.ts}`),
  plus 7 locale files, `app/router.tsx`, `shell/nav-config.ts`, `fidelity/manifest.ts`,
  `scripts/check/sweep-routes.json`.
- Verification used: API source in `gusi_nodejs_api` (read), legacy `gusi_web_dashboard` (read),
  the live mirror API on :5002 (minted sessions, read-only), the local mirror DB
  (`gusi_prod_mirror`, reads only), the shipped fidelity replay (re-run), a production build into a
  scratch dir, and Playwright cold loads of `/` on the shared :3101 dev server for five accounts,
  two themes, two widths. Nothing was written to any database and no repo file was modified.

## Overall assessment

The four things the phase existed to fix are three-and-a-half fixed. Status codes really do drive
colour and copy (proved in the browser, not just in a unit test), nothing logs in a render path, and
the member table was not rebuilt. The role fallthrough is fixed for the four seeded roles and broken
for the fifth role that exists in production. Underneath that, two of the three group-scoped cards
on the leader/reviewer/admin dashboards cannot show correct data at all: one is structurally empty,
the other shows instance-wide totals for any group with no learners. Both survived every green gate
because every gate asserts that the page rendered, not that it rendered the truth.

Three blockers. The bundle claim in the report is wrong by two orders of magnitude, and several
"verified" claims in the report are stale or overclaimed.

## Critical (blockers)

### B1. The Superadmin lands on the learner dashboard — the legacy permission branch was dropped

`resolve-home-dashboard.ts` keys on four slugs and sends everything else to `LearnerHome`. The mirror's
`roles` collection has **five** slugs:

```
administrator | subscriber | scan_reviewer | group_leader | superadmin  (154 perms)
```

`superadmin` holds `full-access` **and** `admin:full-access`. The legacy router this phase replaced
checked exactly that, *before* its slug switch
(`gusi_web_dashboard/src/pages/dashboard/role-dashboards/role-dashboard.tsx`):

```tsx
if (user.role.permissions?.includes(permissions.ADMIN_FULL_ACCESS)) {
  return <AdminDashboard />;
}
```

Browser-verified: a cold load of `/` as `gusi-khoi@local.dev` (the mirror's only superadmin) renders
"Welcome back, Khoi Local" with six empty personal-learning cards — no group picker, no
Group Administration link, no group snapshot. The sidebar still shows the administration section, so
the nav and the home screen disagree about who this user is.

This is not the "unknown future role → least privilege" case the resolver's doc comment defends. It
is a role that exists today, and the same repo already exports the primitive the legacy app used:
`GROUP_ADMIN_BYPASS_PERMISSIONS = ['full-access', 'admin:full-access']` (`schemas/group.ts`), which
`useGroups` consumes. The legacy codebase also documents why slug lists are the wrong shape
(`review-generator-access.ts`, CTP-307: "a slug list would have refused `super_administrator`"). The
port reintroduced the pattern that fix removed.

Fix: resolve on permission first (`hasAnyPermission(user, GROUP_ADMIN_BYPASS_PERMISSIONS) → AdminHome`),
then the slug table, then the learner fallback. Add `superadmin` to the resolver test.

### B2. The group "Course progress" donut can never draw — the client never sends a `courseId`

`GroupLearningSnapshot` calls `useDashboardGroupCharts({ groupId })` with no `courseId`.
`getChartsData` (`dashboard.controller.ts:2859-2927`) initialises `courseProgressChart` to three
zero segments and only fills it inside `if (courseId) { … }`. Live, against the mirror:

```
GET /api/dashboard/charts?groupId=6a6ae3d759ab84398c7cee4f
→ courseProgressChart.data = [0,0,0], totalLearners = 0   (group has 195 learners)
```

The adapter drops zero-count buckets, so the card renders its empty state forever. Browser-verified
on the leader home and the reviewer home: "Course progress — No course progress yet for this group."
The same call *with* a `courseId` returns real counts, so the data exists; the client just never asks
for it.

Consequence: the phase's headline group surface ships one dead card of three on three of the four
dashboards, and the empty state actively lies ("no course progress yet for this group" when 195
learners have progress).

Fix: give the snapshot a course selector (the group's courses, or the admin/leader's current course)
and pass `courseId`; or drop the card until it can be fed. Note the server cost before wiring it:
filling that chart is an N+1 — `getUserProgressByCourseId` once per group member, 195 sequential
awaits for this group.

### B3. A group with no learners shows the whole platform's scan counts as its own

Same route, `dashboard.controller.ts:2963-2977`: the scan query is only narrowed
`if (groupUserIds.length > 0)`, and `groupUserIds` defaults to role `learners`. Live, against two
real mirror groups:

```
groupId=6aa720ad3468fbe5b5e17fa1  (1 leader, 0 learners) → data [453,662,1965,2,3,11576,15499]
groupId=681a57b1c5a226f3463ca7a6  (0 members)            → data [453,662,1965,2,3,11576,15499]
                                          instance totals: 11,576 submitted, 15,499 reviewed
```

The home screen renders those numbers under the group's own name. A group leader of a new or
leader-only group therefore sees platform-wide scan volume attributed to their group — wrong data on
a revenue-facing surface, and an aggregate disclosure to a non-admin role.

The bug is server-side and pre-existing, but this phase is what puts it on a screen, and the phase
explicitly claims to have found and fixed the `charts` bugs. Note the irony: the snapshot *already
fetches* `scan-progress-by-user?groupId=`, which is correctly scoped (returns all-zero summaries for
both groups above) — and then throws the result away (see S4).

Fix (client-side, available now): render the bars from `scan-progress-by-user`, which is group-scoped
server-side and already status-coded, instead of `charts.scanProgressChart`. File the server bug
separately.

## High priority

### S1. Ten queries, zero error states — every failure renders as "no data"

`GroupLearningSnapshot` and `MyLearningPanel` read only `isLoading` and `data`. No `isError` anywhere
in `features/home/**` (grepped). `client.ts` throws `ApiError{kind:'parse'}` on a schema miss and
`{kind:'http'}` on a 4xx/5xx; both land as `data === undefined`, `isLoading === false`, which the
components render as "No course progress yet for this group" / "No scans yet" / "No question bank
attempts". A 500, a 403, an expired token mid-session and a schema drift are all indistinguishable
from an empty group.

This diverges from the established local convention — `features/gallery/category-bar.tsx` renders
`<EmptyState tone="crit" icon={<TriangleAlert/>}>` on `query.isError`, and the courses/scan lists have
"This list could not be loaded" copy already in `en.json`.

It also decides the answer to "is the client correct for the fixed server response":

- Server fix (a) — extend `labels` to 7: client unaffected. `labels` is not in the schema and is
  stripped. Correct.
- Server fix (b) — trim `data` to 5 to match `labels`: `groupScanProgressChartSchema` pins
  `.length(7)`, the whole `/api/dashboard/charts` response fails to parse, and **both** group cards
  silently become "no data for this group". No error is shown, nothing is logged.

The strict `.length(7)` is defensible (it turns a reordering into a loud failure) *only* if something
actually reads the failure. Today nothing does.

### S2. recharts is eager in the entry chunk: +566 kB raw / +160 kB gzip, not "~5 kB"

Measured by building `apps/web` twice into a scratch dir, once with `recharts|d3-*|victory-vendor`
forced into their own chunk:

| chunk | raw | gzip |
|---|---|---|
| entry, everything eager (as shipped) | 1,162,173 B | 337,460 B |
| `charts-vendor` when split out | 565,944 B | 160,190 B |

recharts + its d3 dependencies are **49% of the entry chunk by raw size, 47% gzipped**. `index.html`
lists the chart chunk as a static import of the entry, so it is fetched and parsed before first paint
for every user — including the learner home, which renders one donut, and the administrator home,
which in the mirror renders no chart at all. `git show ce4f26c^1:packages/ui/package.json` has no
recharts: all of it is new in this phase.

The report's "entry chunk grew ~5kB from recharts+charts" is wrong by ~100×, and the reasoning
attached to it ("Home replaces the always-eager Scan Vault redirect") does not survive the number:
the redirect it replaced pulled in nothing.

Options, cheapest first: `React.lazy` the four dashboards (Home is behind `RequireAuth`, so a
suspense boundary is already normal in this tree); or lazy-import the chart primitives inside the
cards; or a `manualChunks` split so at least the charts load in parallel with, not ahead of, the
shell. Worth deciding deliberately given this is now the first screen of every session.

### S3. "Proved live" in the manifest is thinner than it reads, and three report claims are stale

The fidelity replay is real — I re-ran `dashboard-routes.fidelity.test.ts` against :5002 and it
passes 8/8, including `course-progress-chart` and `course-completion-timeline` for all four accounts.
But `record()` parses the envelope, and an empty array satisfies any item schema. Live row counts:

| account | topCourses | qbank | topics | quizzes |
|---|---|---|---|---|
| learner | 9 | 1 | 17 | 10 |
| leader / reviewer / admin | 0 | 0 | 0 | 0 |

So six item schemas are proved by **one** account, and `courseCompletionTimelineEventSchema` is proved
by **zero rows** — I walked all nine of the learner's courses and every day's `events` array is empty.
Its `NOT_REPLAYED` reason says "proved live"; it is not. (`topicProgressItemSchema`'s five
`courseId`-conditional fields are likewise only exercised on the no-`courseId` shape by the replay; I
confirmed separately that they do appear when `courseId` is passed, which the panel does.)

Three further claims in the report no longer hold:

- "Root `pnpm fidelity` doesn't forward `SECTOR_MIRROR_JWT_SECRET` through turbo" — `turbo.json`
  now declares it in `passThroughEnv`, and `vitest.fidelity.config.ts` loads `.env.local` itself.
  Stale concern; do not file it.
- "`getLearnerCourses` fails to parse for the seeded learner" — fixed by the course-shape work
  merged just after (`89ac37f`/`aae8820`). The replay now finds a `courseId` for all four accounts,
  which is *why* two of the eight endpoints are exercised at all. The `.catch(() => undefined)` in
  the fidelity test is now a silent skip waiting to happen: if that route breaks again, two dashboard
  endpoints stop being replayed and the file still reports green.
- "Files created … `packages/ui/src/charts/{chart-colors,donut,bars,line,sparkline}.tsx(+.test.ts)`"
  — only `chart-colors.test.ts` exists. `Donut`, `Bars`, `LineTrend` and `Sparkline` have no tests.

### S4. The correct, scoped query is fetched and discarded

`group-learning-snapshot.tsx:41` fetches `useDashboardScanProgress({ groupId })` and uses it for
exactly one thing: `scans.isLoading` in the skeleton gate on line 80. Its data is never rendered —
the bars come from `charts.data.scanProgressChart` instead. Browser network log confirms the request
fires on every group-snapshot render. That is a wasted round trip per home load, and (per B3) it is
the request whose answer is actually correct.

### S5. API-side: any authenticated user can read any group's dashboard aggregates

`checkUserAccess` returns `true` on `requestUserId === targetUserId` *before* it reaches the group
check, and every dashboard handler computes `const userId = query.userId || req.user.id`. Omit
`userId` and the group check never runs. Live, as `learner@sector.test` (a subscriber who leads
nothing) against a group they do not lead:

```
GET /api/dashboard/charts?groupId=6a6ae3d759ab84398c7cee4f              → 200, full scan counts
GET /api/dashboard/scan-progress-by-user?groupId=…                      → 200, totalScans 6,918
GET /api/dashboard/quiz-progress-by-user?groupId=…                      → 200
GET /api/dashboard/scan-progress-by-user?userId=<admin id>              → 403
```

Pre-existing server bug, same class as the unscoped `group-assignment/learners` route the phase-08b
review filed. Two actions: (1) API ticket, high priority — move the group check ahead of the
self-check, or require it whenever `groupId` is present; (2) correct the doc comment in
`endpoints/dashboard-course-charts.ts:17-19`, which currently asserts "the server enforces the same
leadership scoping `checkUserAccess` applies everywhere else in this domain". It does not, and a
false safety claim in a new file is worse than no claim.

## Medium priority

- **M1. The two statuses the fix rescued are untranslated in six locales.**
  `status.failedUpload` and `status.partiallyUploaded` exist only in `en.json`; de/es/fr/it/pt/fil
  lack both. `fallbackLng: 'en'` means they render in English rather than as raw keys, so this is
  cosmetic — but they are precisely positions 4 and 5 of the array whose mislabelling this phase
  exists to fix, and `home-locale-parity.test.ts` scopes itself to the new `home.*` keys, so nothing
  guards them.
- **M2. Dead prop.** `MyLearningPanelProps.groupId` is never passed by any of the four dashboards
  (grepped: all four render `<MyLearningPanel />`). Speculative generality plus a doc comment
  describing behaviour no caller uses.
- **M3. The "most recently accessed course" pre-selection is a no-op.**
  `useCourses({ query: { sortBy: 'lastAccessedAt:desc' } })` — the learners controller sorts with
  `a?.[sortBy]`, and `lastAccessedAt` lives under `item.progress`, not on the item. Verified live:
  the returned order is not by last access (row 2 is the most recent). The panel silently
  pre-selects an arbitrary course.
- **M4. No loading state on the topics/quizzes cards.** Both branch on
  `(data?.progressList.length ?? 0) === 0` with no `isLoading` check, so they show "No topics yet" /
  "No quizzes yet" for the whole first fetch, then flip. The other four cards use `Skeleton`.
- **M5. The admin picker auto-selects an arbitrary group.** `groupOptions[0]` of the first 100
  groups the API happens to return. In the mirror this picks "Sector Course Fixtures", so the
  administrator home renders three empty cards and zero charts on a cold load. Consider no selection
  until the admin picks, or ordering by size/recency.
- **M6. The cold-load sweep cannot catch any of the above.** The four `/` entries added to
  `sweep-routes.json` carry no `needs` pattern, so the gate asserts ">40 characters and a quiet
  console" — which an all-empty-state dashboard satisfies. Separately, the sweep waits 5.5s; in my
  runs against the shared mirror the charts needed >6s to paint under concurrent load (a 6s wait
  rendered 1 chart, a 15s wait rendered 4). The sweep can pass with nothing drawn.

## Low priority / nits

- `home.group.averageScore` is keyed "average" but is passed `item.highestScore`. The English copy
  ("{{score}}% best score") and all six translations are correct, so this is a key-name nit, not a
  data bug.
- `qbank.data!.chartData` non-null assertions in both panels. Safe today because the `?? 0` length
  check guards them; brittle if the branch is edited.
- `AdminHome` and `GroupLeaderHome` bodies are near-identical (picker + snapshot + panel); the real
  difference is the Manage-groups link, the limit and the empty-state copy. Not a fallthrough, but
  worth knowing before either grows.
- The plan's success criteria say "screenshots in the phase report"; the report describes screenshots
  but none are committed and the script that produced them was not kept. The 16/16 theme × breakpoint
  claim is currently unreproducible.

## What I verified as genuinely fixed

Recording these because they are the phase's stated purpose and they hold up:

- **No fallthrough for the four seeded roles**, and the unknown/missing/empty cases resolve to
  `LearnerHome` (unit test + source). The four dashboards are genuinely different surfaces, not one
  body with a changed title — confirmed by cold loads: learner (greeting + personal panel), leader
  (group snapshot + picker), reviewer (four queue cards + credits + optional snapshot), admin
  (any-group picker + Manage groups). See B1 for the fifth role.
- **Colour and copy come from status codes.** The `7 vs 5` array mismatch is real: controller
  `scanStatuses` is 7 entries (`dashboard.controller.ts:2961`), `labels` is 5 (`:2981`), and the live
  mirror returns `data: [8,68,0,1,0,3776,3065]` against 5 labels. The positional read works
  end-to-end — the reviewer home renders "Pending / Processing / Upload failed / Submitted /
  Reviewed" with the 3,776 and 3,065 intact, where a label-zip would have shown Submitted = 1 and
  Reviewed = 0. Renaming a label in a response changes nothing (adapter + schema tests do exactly
  this, and the labels field is not even in the schema).
- **Nothing logs in a render path.** No `console.*` in `features/home/**`, `packages/ui/src/charts/**`
  or the new api-client files; browser console stayed quiet on all five accounts.
- **No second member table.** The snapshot links to Phase 8's surface via `groupMembersPathFor`;
  "View members" renders and there is no table element on any of the four dashboards.
- **Chart colours are tokens and legible in both themes.** `chart-colors.ts` maps tones to
  `var(--token)` and never `--accent`; every token it uses (`--ink-dim`, `--accent-ink`, `--ok`,
  `--warn`, `--crit`, `--line`) is asserted AA-for-normal-text on `--surface`/`--bg` in all three
  theme blocks by the pre-existing `token-contrast.test.ts`. Measured in the browser: legend and
  axis text resolve to `rgb(94,87,76)` on `#fdfaf4` (light) and `rgb(179,169,150)` on `#211e17`
  (dark); no horizontal overflow at 400px.
- **The empty shapes parse.** Using the shipped schemas against the live mirror: a user with no
  enrolments and no group membership (`learner@scanvault.test`), an administrator on an empty group,
  and a leader-only group all parse clean on all applicable endpoints — including the `null`
  `topPerforming*` / `lowestPerforming*` and the absent conditional topic fields the phase fixed.
  Those two schema corrections are correct and independently confirmed.
- The duplicated dashboard requests visible in the network log are React StrictMode in dev
  (`/api/v2/learners/courses` doubles on `/learn/courses` too), not a phase-10 defect.

## Recommended actions

1. **B1** — resolve the admin dashboard on `full-access`/`admin:full-access` before the slug table;
   add `superadmin` to `resolve-home-dashboard.test.ts`.
2. **B2** — feed the group course donut a `courseId` or remove the card; mind the server-side N+1.
3. **B3** — render the group scan bars from `scan-progress-by-user` (already fetched); file the
   server bug that returns instance-wide counts for a learner-less group.
4. **S1** — add `isError` branches to both panels using the `category-bar.tsx` pattern.
5. **S2** — decide lazy-loading for recharts with the real number (+160 kB gzip, ~47% of the entry
   chunk) in front of you; correct the report.
6. **S3** — fix the `courseCompletionTimelineEventSchema` manifest reason (it is not proved live),
   drop the two stale concerns from the report, and either test the four chart primitives or stop
   listing them as tested.
7. **S5** — API ticket for the dashboard group-scope hole; correct the false scoping claim in the
   endpoint doc comment.
8. Medium items M1–M6 as follow-ups; M6 (sweep entries with no `needs`) is the cheapest way to stop
   the next empty dashboard from passing a green gate.

## Metrics

- Type coverage: no `any`, no `@ts-expect-error`, no lint suppressions in the new files.
- Tests: `resolve-home-dashboard`, `chart-adapters`, `schemas/dashboard`, `chart-colors`,
  `home-locale-parity` are real behaviour tests, not phantoms. Four chart primitives have none.
- Fidelity: 8/8 endpoints × 4 roles re-run clean against :5002 — but rows only exist for one account
  (see S3).
- Bundle: entry chunk 1,162,173 B raw / 337,460 B gzip, of which 565,944 B / 160,190 B is new.
- Browser: 5 accounts cold-loaded on `/`; console clean on all; 2 themes × 2 widths checked on the
  learner home.

## Unresolved questions

1. Is the group course-progress donut meant to be per-course (needing a course picker in the group
   snapshot), or should it be a course-agnostic "learners by overall progress" chart — which the API
   does not currently compute at all? B2's fix depends on the answer.
2. Does GUSI use `superadmin` for staff day-to-day, or only for break-glass? It changes whether B1 is
   "the CTO's home screen is wrong" or "an edge case".
3. Should the home screen block on a scoped-data fix before it goes in front of leaders, given B3
   shows platform-wide scan volume to any leader of a learner-less group?
4. Who owns the API ticket for S5 and B3 — is there a CTP epic for the CTP-307 group-scoping work
   these belong to?
5. The phase cut 14 endpoints to 8 and 242 i18n keys to ~50 by dropping the member table, the
   per-member drill and assignment progress. That accounting looks honest, but it is a product-scope
   decision: has it been confirmed with Liesl that group leaders do not need the per-member view on
   the home screen?
