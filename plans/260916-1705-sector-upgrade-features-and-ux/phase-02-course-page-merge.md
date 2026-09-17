---
phase: 2
title: Course page merge
status: completed
priority: P1
effort: 3d
dependencies:
  - 1
---

# Phase 2: Course page merge

## Overview

`/learn/courses/:courseId` becomes one page: the landing (description, counts,
progress, one action) with module rows that expand in place to their topics and
quizzes. `/about` redirects to it and the separate outline page is deleted.

## Requirements

**Functional**

- `/learn/courses/:courseId` renders `CourseLandingPage`, not `CourseOutlinePage`.
- Module rows expand/collapse inline showing child topics and quizzes with
  `OutlineStatusGlyph`, duration and blocked reason — the same data
  `OutlineSidebar` shows in the player.
- Description leads when the course has one. 96 of 102 live published courses
  do (re-measured 16 Sep on `gusi_prod_mirror.v2courses`).
- `/learn/courses/:courseId/about` redirects (`replace`) to the course page.
- `course-card.tsx` links BOTH `not_started` and started states to the course
  page; `courseAboutPathFor` has no remaining caller.
- `Start`/`Continue` resolves to the same item id as it does today.

**Non-functional**

- `app/legacy-route-map.test.ts` keeps pinning
  `/dashboard/my-courses/:courseId/list` → `/learn/courses/:courseId`; that
  path is unchanged, only its element changes.
- No API change. Both queries (`useLearnerCourseDetails`, `useCourseOutline`)
  already exist and already run on this route pair today.
- No new api-client schema → `fidelity/manifest.ts` untouched.

## Architecture

```
today
  learn/courses/:courseId          CourseShell ─┬─ index      CourseOutlinePage
                                                └─ :itemId    CourseItemRoute
  learn/courses/:courseId/about    CourseLandingPage          (sibling route)

after
  learn/courses/:courseId          CourseShell ─┬─ index      CourseLandingPage
                                                └─ :itemId    CourseItemRoute
  learn/courses/:courseId/about    <Navigate to=".." replace/>
```

`CourseShell` already owns the outline query and hides its contents pane on the
index route (`course-shell.tsx:116`), so mounting the landing as the index child
costs one query, not two: the landing drops its own `useCourseOutline` call and
reads `useCourseShell()` instead. It keeps `useLearnerCourseDetails` — that is
the only source of `course.content`, `progress` and `assignmentType`.

**Redirect as a route element, not a `legacy-route-map.ts` entry.** The map is
the inventory of *legacy dashboard* URLs (`app/legacy-route-map.ts:5-20`);
`/about` is a Sector URL that Sector itself is retiring, so adding it would make
the generated `docs/decommission-dashboard.md` claim the old dashboard served a
page it never served. A `<Navigate replace>` route keeps the map honest. Because
the map does not change, `pnpm docs:legacy-routes` produces no diff — run it and
confirm that, do not skip it.

Module row data flow:

```
useCourseShell() → outline.items
   → groupOutlineItemsForDisplay()  → [{ header, children }]
        header  → row: glyph, title, "N topics · M quizzes · 12m", done/total
        children→ (expanded) OutlineStatusGlyph + title + duration + link
```

## Related Code Files

Create:

- `apps/web/src/features/courses/landing/module-row-state.ts` +
  `module-row-state.test.ts` — which module opens on first render (the one
  holding the resume target), and the open/close reducer. Pure; mirrors
  `runner/sidebar-groups.ts`, which solves the same problem for the player.

Modify:

- `apps/web/src/features/courses/courses-routes.tsx:50-68` — index child becomes
  `CourseLandingPage`; `COURSE_ABOUT_ROUTE_PATH` becomes a `<Navigate>`
- `apps/web/src/features/courses/courses-links.ts:51-65` — mark
  `COURSE_ABOUT_ROUTE_PATH` as redirect-only; delete `courseAboutPathFor` once
  its two callers are gone
- `apps/web/src/features/courses/landing/course-landing-page.tsx` — read the
  outline from `useCourseShell()`; `ModuleRow` (line 307) becomes expandable;
  drop `BackLink` (the shell renders one at `course-shell.tsx:102`)
- `apps/web/src/features/courses/landing/course-landing-model.ts:11-22` — the
  doc comment states "158 of the library's 175 courses carry no description";
  that is `gusi_dev`, not production. Correct it to the measured 96/102 while
  keeping the absent-vs-empty rule the file exists for
- `apps/web/src/features/courses/my-courses/course-card.tsx:60-79` — one
  destination, `coursePathFor`, for every status
- `apps/web/src/features/courses/shell/course-shell.tsx` — no structural
  change; confirm the `currentItemId ? pane : null` branch still reads right
  with the landing as the index child
- `apps/web/src/routes/feature-routes.test.ts` — no edit expected; it must stay
  green (duplicate-path guard)
- `plans/260914-1456-sector-course-experience-roadmap/phase-07-course-landing-page-and-content-fields.md`
  — APPEND a short correction note to its Overview (see step 9). Do not rewrite
  the file; its 158/175 figure appears at lines 32, 62, 239, 336, 355 and the
  note explains all of them at once.

Delete:

- `apps/web/src/features/courses/outline/course-outline-page.tsx`
- `apps/web/src/features/courses/outline/course-outline-item-row.tsx` — verify
  with `grep -rn "CourseOutlineItemRow" apps/web/src` first; if the player or
  the admin view uses it, keep it and say so in the commit body

`outline/course-outline-model.ts`, `outline-summary.ts` and
`outline-status-glyph.tsx` all STAY — the landing page and the player both
import them.

## Tests Before

Node environment, `*.test.ts` only (`apps/web/vitest.config.ts`). No rendering.

1. Extend `apps/web/src/features/courses/outline/course-outline-model.test.ts`:
   pin `resolveResumeTarget` for (a) a fresh course, (b) a course with a server
   resume pointer, (c) a finished course, (d) a course whose only remaining
   item is blocked. This is the "Start/Continue resolves to the same item"
   guarantee, and it must be written before the page moves.
2. Extend `apps/web/src/features/courses/landing/course-landing-model.test.ts`:
   `landingBlocks` with content present / `<p></p>` / `&nbsp;` / absent, and
   `outlineKindCounts` with a blocked quiz.
3. `apps/web/src/routes/feature-routes.test.ts` — run it and record the current
   leaf-path list in the commit body; after the merge the list must be
   unchanged except `learn/courses/:courseId/about` still present (now a
   redirect element).
4. `apps/web/src/app/legacy-route-map.test.ts` — run and record green.
5. Sweep (from phase 1) the three course routes in `sweep-routes.json`
   (`.../681a4b63…`, `681a4b82…`, `681a4b67…`) at all three widths — the
   "before" record.

## Refactor

1. Route table swap + `<Navigate>` for `/about`.
2. Landing reads the outline from `useCourseShell()` instead of its own
   `useCourseOutline`.
3. `ModuleRow` gains expand/collapse; child rows link to
   `courseItemPathFor(courseId, child.id)` with `state={{ title }}` exactly as
   the old outline rows did.
4. `course-card.tsx` single destination.
5. Delete the outline page (and its row, if unused).
6. Correct the stale premise in `course-landing-model.ts`'s doc comment.

## Tests After

- `module-row-state.test.ts`: the module containing the resume target starts
  open; every other module starts closed; toggling one does not close another;
  a course with no resume target opens the first module.
- `feature-routes.test.ts` still reports zero duplicate paths.
- `legacy-route-map.test.ts` green, unchanged.
- `sweep-routes.json`: add `/learn/courses/681a4b63779a0d9e6c9cc55b/about`
  with `needs` matching the landing text, so the redirect is proven to land.

## Implementation Steps

1. In `courses-routes.tsx`, change the index child to `<CourseLandingPage />`
   and replace the `COURSE_ABOUT_ROUTE_PATH` entry with
   `{ path: COURSE_ABOUT_ROUTE_PATH, element: <Navigate to=".." replace /> }`.
   Keep it declared before the shell — the comment at lines 64-66 explains why
   `about` outranks `:itemId`, and that reasoning still holds.
2. In `course-landing-page.tsx`, delete the `useCourseOutline` call and the
   pending/error branches that only existed for it; take `courseId`,
   `courseTitle` and `outline` from `useCourseShell()`. Keep the
   `useLearnerCourseDetails` pending/error branches — the shell does not fetch
   details.
3. Remove the local `BackLink` and its two call sites: `CourseShell` already
   renders one above the outlet.
4. Rewrite `ModuleRow` as a button + panel:

   ```tsx
   <button aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
     <OutlineStatusGlyph … /> {group.header.title}
     {topics} · {quizzes} · {minutes}   {done}/{children.length}
     <ChevronDown className={open ? 'rotate-180' : ''} />
   </button>
   {open ? <ol id={panelId}>{children.map(child => <ChildRow …/>)}</ol> : null}
   ```

   The header row is no longer a `<Link>`. Keep a way into the module: the
   first child row is the same target the old row used
   (`children.find(c => c.status !== 'completed') ?? children[0]`).
5. `ChildRow`: `OutlineStatusGlyph`, title, `formatDurationShort`, and the
   `blockedReasonLabelKey` text for a blocked item — same three pieces
   `OutlineSidebar` renders, so a learner sees one vocabulary in both places.
6. New i18n keys go in all seven `apps/web/src/i18n/locales/*.json` under
   `courses.landing.*` (e.g. `courses.landing.expandModule`,
   `courses.landing.collapseModule`). Zero additions to
   `locale-completeness-baseline.json` — the gate
   (`i18n/locale-completeness-gate.test.ts`) fails otherwise.
7. `course-card.tsx`: delete the `not_started` branch and the
   `courseAboutPathFor` import; the link is `coursePathFor(item.course.id)`.
8. Delete `course-outline-page.tsx`; `grep -rn "CourseOutlinePage\|courseAboutPathFor\|CourseOutlineItemRow" apps/web/src`
   must come back empty except the `COURSE_ABOUT_ROUTE_PATH` constant.
9. Append to the Overview of
   `plans/260914-1456-sector-course-experience-roadmap/phase-07-course-landing-page-and-content-fields.md`:

   > **Correction (16 Sep 2026).** The "158 of 175 courses carry no
   > description" figure throughout this file was measured against `gusi_dev`.
   > Re-measured on `gusi_prod_mirror.v2courses`: **96 of 102 live published
   > courses have `content`**, 100 of them over 200 characters. The sparse
   > state this page was optimised for is the rare case, not the common one —
   > which is why the landing page and the outline are merged and the
   > description leads.

   Append only; the rest of that file stays as written.
10. Reference for what the entry page must show:
    `/Users/lap16299/Documents/code/gusi-lms/gusi_web_dashboard/src/pages/dashboard/my-courses/list/list-content-v3.tsx`
    — back link, course label, title, counts, progress ring + status, expiry,
    2-line description, lesson cards. Everything except expiry is already in
    `CourseLandingPage`; expiry belongs to phase 3's card work, not here.

## Regression Gate

```bash
pnpm --filter @sector/web test
pnpm -w typecheck
pnpm -w lint
pnpm -w build
pnpm docs:legacy-routes   # must produce NO diff
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

Manual: open `/learn/courses/:id` for a course with a long description, one
with none, and a finished one; expand two modules; follow Continue; use
`/about` to confirm the redirect.

## Success Criteria

- [ ] `/learn/courses/:courseId` shows the description for every course that
      has one, above the module list.
- [ ] Module rows expand in place; expanding does not navigate.
- [ ] `/learn/courses/:courseId/about` lands on the course page with `replace`
      (browser Back does not bounce).
- [ ] `resolveResumeTarget` tests prove Start/Continue targets the same item as
      before the merge.
- [ ] `legacy-route-map.test.ts` and `feature-routes.test.ts` green;
      `pnpm docs:legacy-routes` produces no diff.
- [ ] `course-outline-page.tsx` deleted; no dangling import.
- [ ] Zero additions to `locale-completeness-baseline.json`; new keys in all
      seven locale files.
- [ ] No horizontal document scroll at 390px on `/learn/courses/:id` and
      `/learn/courses/:id/about`.
- [ ] 3-width browser sweep (390 / 1440 / 2200) green.

## Risk Assessment

| Risk | L×I | Mitigation |
| --- | --- | --- |
| Resume target changes silently, learners re-enter at the wrong item | M×H | `resolveResumeTarget` pinned in Tests Before; the page keeps calling the same function with the same arguments |
| Deleting the outline page loses a behaviour only it had (completed banner, `isOutlineComplete`) | M×M | Carry `isOutlineComplete` into the landing's progress aside before deleting; grep the file's exports for anything unreferenced afterwards |
| The landing's own `useCourseOutline` removal breaks the `/about` redirect target while the shell is still loading | L×M | The shell renders a skeleton until the outline resolves; the landing mounts only after |
| A 185-item course makes the expanded page enormous | M×M | Only the resume module opens by default (`module-row-state.ts`); everything else is one row |
| Someone's bookmark of `/about` is in a notification email | L×L | Redirect, not 404; sweep covers it |

**Rollback:** revert the `courses-routes.tsx` commit — the outline page and
`courseAboutPathFor` come back with it, since deletion is a later commit in the
same phase. Keep the `course-landing-model.ts` comment correction; it is true
either way.
