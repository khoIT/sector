---
phase: 7
title: "Taking a course"
status: pending
priority: P1
effort: "12 days"
dependencies: [5, 6]
---

# Phase 7: Taking a course

## Overview

The learner-facing course runner: layout and sidebar, lesson, video topic, and the
course-quiz adapter mounted on the Phase 5 engine. Plus a read-only admin view and the
i18n pass.

15,223 lines live under `my-courses` in the dashboard, of which **6,087 across 33
components are reachable**. The v1/v2 variants are not flag-gated alternatives —
`page.tsx`, `list/page.tsx` and `content/layout.tsx` all hardcode the V3 import, and
the `COURSE_NEW_UI_V2_ALL` / `COURSE_NEW_UI_V3_ALL` flags are declared and read by
nothing. Read the reachable 40%; ignore the rest.

## Related code files

- Create: `apps/web/src/features/courses/runner/course-layout.tsx`
- Create: `apps/web/src/features/courses/runner/outline-sidebar.tsx` — reads the Phase 6
  array; the dashboard's equivalent is 1,005 lines because it re-derives the tree
- Create: `apps/web/src/features/courses/runner/lesson-view.tsx`
- Create: `apps/web/src/features/courses/runner/topic-view.tsx` — Vimeo
- Create: `apps/web/src/features/quiz/engine/adapters/course.ts` — per-question submit,
  resume from the outline pointer
- Create: `apps/web/src/features/courses/admin/course-read-only.tsx`
- Modify: `apps/web/src/i18n/locales/*.json`

## Implementation steps

1. Layout + sidebar off the resolved outline. Four route wrappers collapse to one route.
2. Lesson view through the Phase 5 rich-text renderer.
3. Topic view: Vimeo, with watch position written back so the outline knows where the
   learner stopped.
4. Course-quiz adapter. It is a file, not a component — if it is not, the Phase 5
   adapter contract was wrong and should be fixed there.
5. Admin read-only view of a learner's course state.
6. i18n, last, once strings have settled.

## Things not to port

- **A feature gated on four hardcoded user emails committed to the repo**, beside the
  GrowthBook flag that exists to do exactly that. Drop it or flag it properly.
- **Certificates.** `CERTIFICATE_DOWNLOAD_MAINTENANCE = true`; every row action returns
  null. Build the hook, ship nothing behind it, and note that completion has no payoff
  until CTP-399 lifts.
- **Sequential access control** — written and then disabled in place: a prop that reads
  as access control and enforces nothing. Either enforce it or delete the prop.
- **The expired-course renewal notice**, which links to a checkout that takes a card
  number and does nothing.

## Tests / validation

- Unit: adapter contract; watch-position write-back; prev/next at both ends.
- Browser, against the mirror: complete a real production course end to end, including
  one of the 9 topic-nested quizzes, and confirm it reaches 100%.

## Success criteria

- [ ] One route serves every nesting shape
- [ ] The course quiz is the Phase 5 engine plus one adapter file
- [ ] A real production course can be completed to 100%
- [ ] Sidebar, breadcrumb and resume agree, by construction
- [ ] Zero hard-coded English

## Risk / rollback

The estimate carries **+30% if the `z.any()` progress shapes cannot be pinned against
the mirror** in Phase 6. Resolve that before committing to a date. Everything else here
is UI over a settled contract.
