# Home screen — blocker remediation

Branch `fix/sector-home-dashboards`, worktree
`<scratchpad>/wt/fix-home-dashboards`, branched from `feat/sector` at `092df53` and merged
up to `83971b5` at the end (clean, no conflicts). Five commits, 33 files, +850/−255 against
`feat/sector`. **Not merged into `feat/sector`** — that call is the coordinator's.

```
b701cd5 merge: bring the home-dashboard fixes up to the integration branch
415984d test(web): make the cold-load sweep assert each role's own dashboard
cdcf2ee fix(web): do not ask for a group's courses the viewer cannot read
b6341fb fix(web): scope the group snapshot to the group and to a course
a78b3a3 fix(web): send every full-access role to the administrator home
```

## Blockers

### B1 — the Superadmin landed on the learner dashboard

`resolveHomeDashboard` now takes the user, not a slug, and checks
`hasAnyPermission(user, GROUP_ADMIN_BYPASS_PERMISSIONS)` **before** the slug table, exactly
where the legacy `RoleDashboardRouter` checked `ADMIN_FULL_ACCESS`. No fifth slug was added:
the table is now the narrow case (jobs that differ without differing in privilege), and
privilege is read from the role. Unknown slugs without full access still land on the learner
home, never the administrator one.

Regression test (`resolve-home-dashboard.test.ts`, 7 cases): a role outside the table holding
`full-access`, one holding `admin:full-access`, and `superadmin` holding both all resolve to
`AdminHome`; full access outranks a narrower slug; `group:full-access` — a real permission the
seeded leader carries — does not.

Verified in a browser: `gusi-khoi@local.dev` (the mirror's only `superadmin`, 154 permissions)
cold-loads `/` to "Administrator dashboard / Manage groups / GROUP …". Before the fix the same
account got "Welcome back, Khoi Local" and six empty personal cards.

### B2 — the group course donut could never draw

`GET /api/dashboard/charts` fills `courseProgressChart` only inside `if (courseId)`. The
snapshot now reads the group's own courses (`useGroupCourses`, the route Phase 8 already
uses), shows a course picker in the card header and asks the chart about the selected course.
`groupCourseChartQuery()` returns `undefined` without a course, so the query stays disabled
rather than spending a request on an answer that is known to be `[0,0,0]`.

Regression test (`chart-adapters.test.ts`): the query is `undefined` for a missing or empty
`courseId`, and `{groupId, courseId}` only when both are present.

Verified in a browser and in the network log: the leader home now renders "Course progress —
COURSE GUSI POCUS Essentials — Not started 194" (194 is the group's real learner count), and
every `/api/dashboard/charts` request carries a `courseId`.

### B3 — a learner-less group showed the whole platform's scan counts

The bars now come from `scan-progress-by-user?groupId=`, which the server scopes to the
group's members and which the component was already fetching and discarding. The unscoped
array is gone from the parsed shape entirely: `dashboardGroupChartsSchema` no longer declares
`scanProgressChart`, and `groupScanProgressChartSchema` /
`GROUP_SCAN_PROGRESS_STATUS_ORDER` are deleted along with the adapter that read them. The
wrong numbers cannot reach a screen because they no longer have a type to arrive in.

Two regression tests:

- `dashboard.test.ts` parses a charts response carrying the real instance totals
  (`[453,662,1965,2,3,11576,15499]`) and asserts the parsed value has one key and does not
  contain `11576`.
- `chart-adapters.test.ts` — `groupScanBars` maps the scoped rows (including `failed_upload`
  and the submitted/reviewed buckets a label-zip dropped) and returns `[]` for undefined or
  all-zero input, so nothing is shown rather than something borrowed.

Verified in the network log: the administrator home no longer requests `/api/dashboard/charts`
at all, and group figures come only from the scoped routes. The label-zip bug this phase
originally fixed cannot return either — nothing reads `labels` or `data` now.

Dropping `.length(7)` also removes the failure mode where a server-side fix to that array
would have failed the whole response's parse and rendered as "no scans yet for this group".

## Should-fixes

**Error handling on all ten queries.** Every card in `group-learning-snapshot.tsx` and
`my-learning-panel.tsx` now distinguishes loading, failed and empty. Failures render
`CardError` — `EmptyState tone="crit"`, the server's own message, a retry button — copied in
shape from `features/gallery/category-bar.tsx` rather than invented. A 403 on the group course
list is treated as a refusal, not a breakage, and reads as a note.

**The bundle.** Charts moved to a `@sector/ui/charts` subpath entry, removed from the package
root barrel, and loaded through `lazy()` with the same skeleton each card already showed.
Measured with the repo's own vite config, same machine, both ends:

| | entry chunk (raw) | entry (gzip) | charts chunk |
|---|---|---|---|
| `feat/sector` at `092df53` | 1,169,356 B | 339,224 B | — (inside the entry) |
| fix branch, same base | 736,122 B | 222,313 B | 425,130 B / 114,294 B, on demand |
| fix branch after merging `83971b5` | 743,392 B | 224,163 B | 425,130 B / 114,295 B, on demand |

−433,234 B raw and −116,911 B gzip off the critical path, a 34.5% smaller first-paint
payload. `index.html` references only the entry chunk now; `grep recharts-surface` finds the
library in the lazy chunk and not in the entry. The implementer's report said the growth was
"~5kB"; it was 116 kB gzipped.

**The fidelity manifest.** `courseCompletionTimelineEventSchema` now says what is true: not
proved live, because every day the replay has returned carries an empty `events` array across
all nine of the seeded learner's courses, so the shape is modelled from the controller only.
The block header states the measured coverage — envelopes for four accounts, rows from
`learner@sector.test` alone, the other three contributing empty lists that satisfy an item
schema without exercising it. The replay itself now fails loudly if no account reaches the two
course-scoped routes, so a `getLearnerCourses` regression can no longer silently drop two of
the eight endpoints while the file reports green.

**The doc comment that claimed an authorization guarantee.** `dashboard-course-charts.ts` now
describes what `checkUserAccess` actually does — self-check first, so a request naming only a
`groupId` never reaches the group check — and says to treat group ids sent from the client as
unverified. The API fix itself is left to that team, as instructed.

## Also fixed, smaller

- The group course list is not requested when the viewer cannot read it. `assertLeadsGroup`
  guards it and a plain administrator holds `full-access` but not `admin:full-access`, so
  every administrator home load took a 403 and logged a console error. The caller now passes
  `viewerLeadsGroup`, and `GROUP_LEADERSHIP_BYPASS_PERMISSION` is exported next to the
  constant that already documents this distinction.
- `status.failedUpload` and `status.partiallyUploaded` translated in all six non-English
  locales — the two buckets this phase exists to show correctly were the two only English
  could read. The 12 stale entries are removed from `locale-completeness-baseline.json`, and
  the parity test now asserts all seven scan statuses per locale.
- `home.group.averageScore` renamed to `bestScore`, because the value passed is
  `highestScore`. Copy unchanged in all seven locales.
- Course pre-selection sorts on `progress.lastAccessedAt` in the client. The route's
  `sortBy=lastAccessedAt:desc` sorted on `item[sortBy]`, and that field lives on
  `item.progress`, so the sort was a no-op and the picker opened on an arbitrary course.
- A selection that outlives its list (an administrator switching group, a course list arriving
  after first render) falls back to the first option instead of sending a stale id to a
  group-scoped route. `selectedOptionValue`, unit-tested.
- `MyLearningPanel`'s `groupId` prop is gone — no caller ever passed it.
- Topics and quizzes cards have loading states; they used to show "no topics yet" for the
  whole first fetch.
- The cold-load sweep's four `/` rows now carry a `needs` pattern naming the heading that role
  and only that role should see. Before, an all-empty page, or one role's dashboard rendered
  for another, satisfied the gate.

## Gates

Run on the merged branch unless noted.

| gate | result |
|---|---|
| `pnpm -w typecheck` | 3/3 packages clean |
| `pnpm -w lint` (eslint + prettier) | 3/3 clean |
| `pnpm -w test` | **1,215 passed** — web 870, api-client 218 (+11 skipped), ui 127 |
| `vite build` | succeeds; entry 743,392 B / 224,163 B gzip, charts chunk on demand |
| `pnpm fidelity` (root, turbo) | 3 files, 64 tests passed, every collection entry 100% |
| dashboard route replay | 8/8 for all four seeded accounts, all entries 100% |
| cold-load sweep | 34/34 healthy, per-role assertions on `/` |
| roles × themes × breakpoints | 20/20 healthy (5 accounts × light/dark × 1440/400), no console errors, no horizontal overflow at 400 px |

Hand-checked in a browser, all five accounts including `superadmin`: each role gets its own
dashboard, the leader's group donut shows a real course and learner count, scan bars show the
scoped figures with the correct labels, the administrator home no longer 403s, and the console
stayed quiet. Chart axis and legend text resolve to `--ink-dim` in both themes
(`rgb(94,87,76)` on `#fdfaf4`, `rgb(179,169,150)` on `#211e17`); the "Completed" legend entry
takes `--ok`, which the token-contrast suite already asserts at AA for normal text.

## Notes for whoever merges

- The mirror API on :5002 degraded badly during the last hour of this work —
  `GET /api/groups/manage` measured at **34.7 s** — and two sweep runs in that window rendered
  data-less pages for unrelated routes (`/administer/groups`, `/learn/courses`,
  question banks). The same suite passed 34/34 before and after. Nothing in this branch
  touches those surfaces; if a gate looks flaky, time the API first.
- `packages/ui` root no longer exports the chart primitives. Anything new that draws a chart
  imports from `@sector/ui/charts`, and should do it dynamically.
- Running `pnpm fidelity` in a fresh worktree needs `.env.local` copied to the worktree root;
  the copy made for this run was deleted afterwards.
- Merge with `git merge fix/sector-home-dashboards` from `feat/sector`; the branch already
  contains `83971b5`.

## Unresolved questions

1. The administrator home shows no course card at all for a plain administrator, because the
   group's course list is leader-only server-side. Is that the intended product answer, or
   should the API let `full-access` read a group's courses — which is the same question as the
   authorization finding already with the API team?
2. The administrator's group picker still auto-selects the first of the first 100 groups, which
   in the mirror is an empty fixtures group. Should it open on nothing until a group is chosen,
   or order by size or recent activity?
3. `courseCompletionTimelineEventSchema` is modelled from the controller with no live instance.
   Seeding one day of real course activity in the mirror would close it — worth doing, or leave
   the manifest honest and move on?
4. The scan-status i18n keys now translated were baselined as a known gap. Six more locale gaps
   remain in that baseline for other surfaces; no owner named.
