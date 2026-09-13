---
phase: 10
title: "The home screen"
status: pending
priority: P2
effort: "22 days"
dependencies: [6, 7, 8]
---

# Phase 10: The home screen

## Overview

Port the dashboard home properly: four role dashboards, the charts, and the 242 i18n
keys. This is a decision taken on 13 Sep 2026 against the alternative of a light
"Today" surface (~4 days) — it is the largest single line in the plan and the team
should know that going in.

It sits at position 10 because it reads from everything the earlier phases build:
course progress (6, 7), group membership (8), scan queues (4).

Today's home is ~8,570 lines, 23 components and 14 endpoints, and `router.tsx` in
Sector currently sends `/` to `VaultIndexRedirect`. That redirect goes away here.

## Port the information; rewrite the implementation

**Two of the four role dashboards are dead.** `group_leader` and `scan_reviewer` fall
through to `<AdminDashboard/>`, so two roles are served a surface built for a third —
including its group-wide member table and export — while 412 lines of purpose-built
dashboards sit unshipped. 21% of the module is unreachable.

Porting "properly" therefore means shipping four real dashboards, not reproducing the
fallthrough.

**Chart colours and translation keys are derived by comparing English label strings
returned by the API** — `label === 'Completed'`, `'Pending'`, `'Reviewed'`. Rename or
localise a status server-side and slices render grey with a raw missing-key string,
failing silently. Derive from status **codes**; the label is display only.

**`console.log` ships inside a `useMemo` in the admin hot path**, printing group names
and ids on every interaction. Do not carry it.

**Do not port the 1,189-line member table.** Phase 8 built one members surface; the
administrator dashboard links to it. A second table that builds an Excel file in the
browser is exactly the duplication this whole plan exists to remove.

## Charting

recharts is not a dependency of Sector. Use it — same data shapes, fastest route to
parity, React 18 compatible — but wrap every chart in `packages/ui/src/charts/*` so the
library is swappable and so chart text, grid and series colours come from the tokens
rather than from the library's defaults. Semantic colours (`--ok`, `--warn`, `--crit`)
are separate from `--accent`; the accent is not a series colour.

## Related code files

- Create: `apps/web/src/features/home/learner-home.tsx`
- Create: `apps/web/src/features/home/group-leader-home.tsx`
- Create: `apps/web/src/features/home/scan-reviewer-home.tsx`
- Create: `apps/web/src/features/home/admin-home.tsx`
- Create: `apps/web/src/features/home/home-route.tsx` — role → dashboard, no fallthrough
- Create: `packages/ui/src/charts/{donut,bars,line,sparkline}.tsx`
- Create: `packages/api-client/src/endpoints/dashboard-*.ts` (14 endpoints)
- Create: `packages/api-client/src/schemas/dashboard.ts` — status **codes**, not labels
- Modify: `apps/web/src/app/router.tsx` — `/` stops redirecting
- Modify: `apps/web/src/shell/nav-config.ts` — Home becomes the first destination
- Modify: `apps/web/src/i18n/locales/*.json` — 242 keys × 7 locales

## Implementation steps

1. Read the four role dashboards in the dashboard repo, including the two that never
   render, and write down what each role actually needs. The unshipped 412 lines are
   the best available statement of intent for two of them.
2. Chart primitives in `packages/ui`, token-driven, tested for label and axis colour in
   both themes.
3. Schemas keyed on status codes. A fidelity case per dashboard endpoint.
4. The four dashboards, each with its own route resolution — a role that matches none
   gets the learner home, never the admin one.
5. i18n. 242 keys is the bulk of the tail; budget for it.

## Tests / validation

- Unit: role → dashboard resolution, including an unknown role and a wildcard role.
- Unit: colour and key derivation from codes, with a renamed English label proving the
  old failure mode is gone.
- Fidelity: all 14 endpoints parse against the mirror.
- Browser: all four roles, both themes, 400px and 1440px.

## Success criteria

- [ ] Four dashboards, four roles, no fallthrough to admin
- [ ] Renaming or localising a server-side status label changes nothing on screen
- [ ] Charts read from tokens and are legible in both themes
- [ ] No `console.log` in a render path
- [ ] No second members table
- [ ] 242 keys × 7 locales, no missing-key strings

## Risk / rollback

Biggest line in the plan and the one most likely to overrun, because 14 endpoints and
242 keys are both long tails. It is also the most deferrable: if the programme is late,
shipping the learner home alone and landing the other three after cutover costs nothing
architecturally. Keep the four dashboards in four files so that stays possible.
