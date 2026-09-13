---
phase: 6
title: "The course read seam"
status: pending
priority: P1
effort: "11 days (2-3 of them API)"
dependencies: [1, 5]
---

# Phase 6: The course read seam

## Overview

Have the server return a **resolved outline** — an ordered flat item list with
per-item status, `next`/`prev`, and a resume pointer — instead of four parallel arrays
joined by `itemRef` with progress typed `z.any()`.

This is the phase everything else in the course track hangs off, and the only one that
makes the port *cheaper*: it deletes ~420 lines of client code and about 4 of the 30
course days.

## Why it must land before any course UI

The client today re-derives navigation **four times**: `generateCourseRoutesV3` (~90
lines), `generateBreadcrumbsV3` (~175), the Start/Resume walk in
`course-progress-button-v3`, and a fourth assembly inside a 1,005-line sidebar. Each
with its own edge cases, and the class of bug where Resume, the breadcrumb and the
sidebar highlight disagree.

Port against today's shape and Sector inherits all four permanently. **This is the
plan's one irreversible mistake.**

## Two live bugs it fixes by construction

- **A fourth nesting shape the frontend has no route for**: `course > topic > quiz`,
  9 live instances. Those quizzes have no URL, appear in no sidebar, are skipped by
  prev/next — and still count toward `totalItems`, so their courses can never reach
  100% or issue a certificate.
- **146 published quizzes with zero questions**, the same permanent incompletion.

If the server names the route, there is no fourth shape and no unreachable item.

## Scope boundary — what this is not

This is **not** the immutable-snapshot write fix (12–15 API days). Build the seam
against today's pointer structure; swap its data source to a real content snapshot
later with **no client change**. Doing the write fix first delays every user-visible
course phase by three weeks for zero user-visible gain.

## Related code files

- Create (API): `gusi_nodejs_api/src/app/learners/course-outline.*` — the traversal
  already exists in `learners.structure.helper.ts` (336 lines); this resolves and
  orders it
- Create: `packages/api-client/src/schemas/course-outline.ts`, `course.ts`, `enrolment.ts`
- Create: `packages/api-client/src/endpoints/course.ts`, `enrolment.ts`
- Create: `packages/api-client/src/react/use-course-outline.ts`
- Create: `apps/web/src/features/courses/my-courses/**`
- Create: `apps/web/src/features/courses/outline/**`

## Implementation steps

1. **API (2–3d).** `GET /learners/courses/:id` returns `{ items: [{ id, kind, title,
   order, status, duration, route, blockedReason? }], resume, totalItems }`. Ordering
   is explicit and integer. Every item carries its own route, including the fourth
   nesting shape. A quiz with no questions carries `blockedReason`.
2. Pin the progress shapes against the mirror. If they cannot be pinned, add 30% to
   Phase 7 and say so — that is the plan's largest estimate risk.
3. Course api-client + entitlement.
4. **My Courses** using the API's own keyword and status filters. Today the dashboard
   pulls 100 courses and filters in the browser, so a learner with more than 100
   enrolments silently cannot see them all.
5. **Course outline** — one list, resume names the item, blocked items say why.

## Tests / validation

- Unit: ordering, resume resolution, prev/next at both ends, blocked items.
- Fidelity: resolve every production course in the mirror; assert no item lacks a route
  and no course's `totalItems` exceeds its reachable items.
- Browser: a learner with >100 enrolments finds course 101.

## Success criteria

- [ ] One ordered list; Resume, breadcrumb and sidebar cannot disagree because they
      read the same array
- [ ] All 9 `course > topic > quiz` instances have a URL
- [ ] Zero-question quizzes are marked unavailable, not started and trapped
- [ ] No client-side tree traversal ships
- [ ] My Courses filters server-side

## Risk / rollback

Needs API capacity that is not committed — without an API engineer for the 2–3 day
seam, roughly 27 of the plan's days have no safe start. That is a scheduling risk to
raise now, not in week six. The `z.any()` progress blobs are the other: ScanVault's
contract is parse-not-cast and the source schema punts on exactly the two shapes the
quiz runner needs.
