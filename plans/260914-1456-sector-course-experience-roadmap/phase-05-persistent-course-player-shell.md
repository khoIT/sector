---
phase: 5
title: "Persistent course player shell"
status: pending
priority: P1
effort: "3 days"
dependencies: [2, 3]
---

# Phase 5: Persistent course player shell

## Overview

<!-- Red team 2026-09-14: F8 — delta: `player-frame.tsx` and the player hoist are CUT. The
     Vimeo iframe lives inside sanitised topic HTML, so it cannot be lifted out of the body
     without a new content-splitting mechanism this phase never specified. Route nesting
     alone delivers the persistence this phase exists for; the header comes from Phase 3
     unchanged; and the shell must refresh the outline's position after a write or it
     resumes stale. Effort 5d → 3d. -->

Today every move between a topic, its quiz and the next module is a full route change:
`/learn/courses/:courseId/:itemId` mounts `CourseRunnerPage`, which refetches the outline,
re-renders the layout and re-renders the sidebar. LinkedIn Learning's clarity — the benchmark
the user named — is mostly one property: **the contents pane and the course header never go
away**.

**This is a route restructure, and nothing more.** The pieces already exist and already share
one resolved outline:

- `courses-routes.tsx:41-46` mounts four flat routes, three of them course-related.
- `course-runner-page.tsx:33` fetches the outline once and dispatches on `item.kind`
  (`:114-116`) — three views, one route, already.
- `outline-sidebar.tsx:35` and `course-outline-page.tsx:69` both call
  `groupOutlineItemsForDisplay(items)` on the same array.
- `course-shell-header.tsx` was written in Phase 3, in its final home. This phase mounts it.

What changes: the outline fetch and the chrome move **up** into a React Router layout route,
and the three views become `<Outlet/>` children. A navigation between two items then swaps
only the child.

**The player is not hoisted, and the earlier plan to hoist it was not implementable.**
<!-- Red team 2026-09-14: F8 -->
The Vimeo iframe is not an element this app renders. It is inside the authored topic HTML,
rendered through `RichText` and located afterwards by
`querySelector('iframe[src*="player.vimeo.com"]')` (`topic-view.tsx:31,76-78`;
`use-vimeo-watch-tracking.ts:27-31`). "Hoist the container but leave the body in `TopicView`"
is a contradiction — the container that holds the iframe **is** the body. Doing it properly
would mean splitting the iframe out of sanitised HTML and rendering the remainder separately:
a new content-parsing mechanism, untested and uncosted.

And it would buy nothing here. `PlayerFrame` was specified `key={item.id}`, so it rebuilt on
every topic change — the only navigation Phase 5 has. It would persist across nothing. The
LinkedIn property comes from the **layout route**, which needs no `PlayerFrame` at all.
Phase 6's "exactly one `Player` instance" is satisfied just as well by `TopicView` owning the
`Player` and publishing `seekTo` / current-time through a small context.

## Requirements

**Functional**

1. One layout route owns the outline query and the chrome. Item routes are its children.
2. Moving between two items in the same course does **not** remount the contents pane or the
   course header.
3. A tab strip under the content: `Overview` now, built so Phase 6 adds `Transcript` and
   `Notes` without touching route wiring again.
4. A quiz renders inside the shell, with the contents pane still visible.
5. Every URL in `courses-links.ts` is unchanged; `legacy-route-map.ts:220-267` still resolves.
6. The active tab is a URL search param, and the browser back button moves between tabs.
7. A topic's player resumes at the learner's stored position — reading a value that is
   **fresh**, not one the shell cached before the last write.

**Non-functional**

8. The outline is fetched once per course visit rather than once per item route.
9. `feature-routes.test.ts` asserts no duplicate route paths; nesting must not introduce one.
10. No new API endpoint, no new schema. This phase is entirely `apps/web`.

## Architecture

```
BEFORE  (courses-routes.tsx:41-46)          AFTER
learn/courses              MyCourses        learn/courses                MyCourses
learn/courses/:courseId    Outline          learn/courses/:courseId      CourseShell (layout)
learn/courses/:courseId/:itemId  Runner       ├─ index                   CourseOutlinePage
learn/course-progress/…    Admin               └─ :itemId                CourseItemRoute
                                            learn/course-progress/…      Admin (unchanged)

CourseShell
  useCourseOutline({ courseId })                 ← the ONE fetch, hoisted
  <CourseShellHeader …/>                         ← Phase 3's component, mounted as-is
  <OutlineSidebar …/>                            ← unchanged component
  <Outlet context={{ outline, courseId, courseTitle }} />
  <CourseItemNav …/>                             ← rendered once, here
       ├─ index  → CourseOutlinePage    (reads context, does not refetch)
       └─ :itemId → CourseItemRoute
             findOutlineItem(items, itemId)      ← course-outline-model.ts:44, unchanged
             dispatch on item.kind → LessonView | TopicView | QuizView
                                        │
                                   TopicView still owns RichText, the iframe,
                                   the Player, and the tracking hook
```

**Who owns what** — `apps/web` only. No `packages/api-client` change, no API change.

**Position freshness.** <!-- Red team 2026-09-14: F8 / FMA F6 -->
Three decisions combine badly if left alone: the outline is fetched once per course visit and
never remounts; Phase 2's position writes deliberately do **not** invalidate it; and the
player resumes from `item.positionSeconds`. `QueryClient` sets `staleTime: 30_000`
(`apps/web/src/app/query-client.ts:16`), so even a remount inside 30 s would not refetch. The
result is that an in-shell A → B → A round trip resumes A behind where the learner actually
left it. A reload hides this, which is why the manual pass must test in-shell navigation, not
just reload.

Fix it **without** a refetch: on each position write resolving, patch the cache in place —

```
queryClient.setQueryData(courseKeys.outline(courseId), patchItemPosition(itemId, seconds))
```

— so the shell reads a fresh value with no 185-item round trip. A blanket `invalidateQueries`
on every 12-second tick would undo Phase 2's write-volume work; `setQueryData` is the
resolution of that tension. Alternatively hold `positionByItemId` in shell context and prefer
it over the outline value. Either way, **do not leave the shell reading a 30-second-stale
position.**

## Related Code Files

**Create**

- `apps/web/src/features/courses/shell/course-shell.tsx` — the layout route.
- `apps/web/src/features/courses/shell/course-item-route.tsx` — the `:itemId` child; the
  `item.kind` dispatch moved out of `course-runner-page.tsx:114-116`.
- `apps/web/src/features/courses/shell/course-shell-context.ts` — `useCourseShell()`.
- `apps/web/src/features/courses/shell/item-tabs.ts` + `.test.ts` — pure tab resolution.
- `apps/web/src/features/courses/shell/patch-item-position.ts` + `.test.ts` — the pure cache
  patcher. <!-- Red team 2026-09-14: F8 / FMA F6 -->

**NOT created** — `player-frame.tsx`. Deliberately.
<!-- Red team 2026-09-14: F8 -->

**Modify**

- `apps/web/src/features/courses/courses-routes.tsx` (`:41-46`) — nest.
- `apps/web/src/features/courses/courses-links.ts` — add `COURSE_ITEM_TAB_PARAM = 'tab'` and
  an optional `tab` argument to `courseItemPathFor`. The three path shapes are pinned by
  `legacy-route-map.ts`'s `SECTOR_PATH` and a test (`courses-links.ts:6-11`); a search param
  is additive.
- `apps/web/src/features/courses/outline/course-outline-page.tsx` — read the outline from
  context instead of `useCourseOutline` (`:32`); its pending/error branches (`:34-65`) become
  dead and are deleted.
- `apps/web/src/features/courses/shell/course-shell-header.tsx` — **created in Phase 3**;
  this phase only mounts it. No relocation. <!-- Red team 2026-09-14: F8 -->
- `apps/web/src/features/courses/runner/topic-view.tsx` — renders the active tab's panel;
  keeps `RichText`, the iframe, and `useVimeoWatchTracking`. Gains the `ready`-time
  `setCurrentTime` for resume.
- `apps/web/src/features/courses/runner/use-vimeo-watch-tracking.ts` — unchanged from
  Phase 2 apart from calling the cache patch after a successful write.
- `apps/web/src/features/courses/runner/{lesson,quiz}-view.tsx` — drop their own
  `CourseItemNav`; `quiz-view.tsx` loses its `useNavigate` hop back to the outline
  (`:15`, `:22`, `:138`).
- `apps/web/src/features/courses/runner/course-layout.tsx` — absorbed into `course-shell.tsx`.
- `apps/web/src/features/courses/runner/course-runner-page.tsx` — **deleted**.
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json` — `courses.shell.tabs.*` only.
  The header's keys (`courses.outline.counts` / `.remaining`) were added in Phase 3 and are
  **not** duplicated under `courses.shell.*`. <!-- Red team 2026-09-14: F8 -->
- `apps/web/src/i18n/courses-namespace-parity.test.ts`
- `scripts/check/sweep-routes.json`

**Delete**

- `apps/web/src/features/courses/runner/course-runner-page.tsx` — its outline fetch and error
  branches move to the shell, its dispatch to `course-item-route.tsx`.

## Implementation Steps

1. **Pin today's behaviour first.** `course-runner-page.tsx` has three non-obvious branches:
   the 404-means-expired-enrolment message (`:47-87`, with its documented reason for offering
   "My Courses" rather than "Try again"), the item-not-found state (`:92-104`), and the
   `location.state.title` fallback (`:31`). Write them down before moving them.
2. **`course-shell-context.ts`.**
   `type CourseShellContext = { courseId: string; courseTitle: string | undefined; outline: CourseOutline }`
   plus `useCourseShell()` that throws outside the shell.
3. **`course-shell.tsx`.** Move `useCourseOutline` and all three error branches here verbatim
   from `course-runner-page.tsx:33-104`. Render `<CourseShellHeader/>` (Phase 3's file),
   `<OutlineSidebar/>`, `<Outlet context={…}/>`, and one `<CourseItemNav/>`. The active item
   is resolved by the child — the parent does not know `:itemId` on the index route, so
   `CourseItemNav` reads it from the outlet context the child publishes, or is rendered by the
   child. Pick one and keep it in one place.
4. **Nest the routes:**

   ```tsx
   { path: COURSES_INDEX_ROUTE_PATH, element: <MyCoursesPage /> },
   { path: COURSE_OUTLINE_ROUTE_PATH, element: <CourseShell />, children: [
       { index: true, element: <CourseOutlinePage /> },
       { path: ':itemId', element: <CourseItemRoute /> },
   ]},
   { path: COURSE_ADMIN_ROUTE_PATH, element: <CourseReadOnlyAdminPage /> },
   ```

   Keep `COURSE_ITEM_ROUTE_PATH` exported and used, so `feature-routes.test.ts` has one
   string to check. `COURSE_ADMIN_ROUTE_PATH` stays a **sibling**, not a child
   (`courses-links.ts:37-40`).
5. **`course-item-route.tsx`.** `useParams` for `:itemId`,
   `findOutlineItem(outline.items, itemId)`, the not-found branch, then the same three-way
   dispatch `course-runner-page.tsx:114-116` does today.
6. **`course-outline-page.tsx`** reads `useCourseShell()`. Delete its now-dead pending and
   error branches rather than leaving two error states for one query.
7. **Resume, in `TopicView`, on `ready`.** `player.setCurrentTime(position)` when the position
   is non-null and more than 5 s from the end — resuming someone into the closing credits is
   worse than restarting. The position is read from the **patched** cache (step 8), not from a
   stale outline snapshot.
8. **Patch the cache after each position write.** `patch-item-position.ts` is a pure
   `(outline, itemId, seconds) => CourseOutline` used with `queryClient.setQueryData`. No
   refetch, no invalidation. <!-- Red team 2026-09-14: F8 / FMA F6 -->
9. **Tabs** (`item-tabs.ts`). `tabsForItem(item)` returns `['overview']` this phase.
   `activeTab(param, available)` returns the param when it is in `available`, else
   `'overview'` — never a blank pane. Read/write with `nuqs` (`apps/web/package.json:24`),
   and set **`history: 'push'` explicitly**: the cited precedent
   (`scan-list/table/use-list-url-state.ts:54-56`) uses `{ replace: true }`, which would make
   Requirement 6 false. <!-- Red team 2026-09-14: F8 / FMA F6 -->
   Render with `Tabs` from `@sector/ui`.
10. **Quiz in place.** `quiz-view.tsx` already mounts the shared engine via
    `createCourseQuizAdapter`. Remove only its navigation away: the `useNavigate` import
    (`:15`) and the return-to-outline path (`:138`). Completion invalidates the outline and
    stays put.
11. **Check the sidebar does not remount.** `OutlineSidebar` takes `currentItemId`
    (`outline-sidebar.tsx:19`) and is rendered by the shell, so it re-renders on navigation
    but must not unmount. Confirm in React DevTools during the browser pass — a stray `key`
    tied to the item id would undo the phase while every test stayed green.

## Tests / validation

**Unit**

- `item-tabs.test.ts` — `tabsForItem` for each kind; `activeTab('transcript', ['overview'])`
  falls back; `activeTab(undefined, …)` returns `'overview'`.
- `patch-item-position.test.ts` — patches the named item and leaves every other item
  byte-identical; a missing item id returns the outline unchanged; the returned object is a
  new reference (React Query requires it to re-render).
- **Existing, must stay green untouched**: `course-outline-model.test.ts` (17 cases) —
  `findOutlineItem`, `groupOutlineItemsForDisplay` and `resolveResumeTarget` are reused, not
  modified. `feature-routes.test.ts` — the duplicate-path assertion is the gate that catches a
  nesting mistake. Phase 3's `outline-summary.test.ts` — the header consumes it unchanged.
- `locale-completeness-gate.test.ts` and `courses-namespace-parity.test.ts` green with the new
  `courses.shell.tabs.*` keys in all seven locales and **no** baseline addition.

**Fidelity** — **no new entry, and that is the decision**: this phase adds no schema, no field
and no endpoint, so `manifest.ts` is untouched and `manifest.test.ts` passes unchanged.
Re-run `pnpm fidelity` with `SECTOR_MIRROR_JWT_SECRET` set and `:5002` up as a regression
check that the hoisted outline query sends the same request; a run printing
`route replay skipped` (`routes.fidelity.test.ts:65-70`) proves nothing.

**Browser** — the load-bearing gate, because the suite renders nothing (`environment: 'node'`,
`include: ['src/**/*.test.ts']`).
`node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>`. Add or strengthen:

```json
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b", "role": "learner",
  "needs": "Course contents|Pediatric Residency" }
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b/681a4e2c82414b2fcc5af816",
  "role": "learner", "needs": "Physics and Probes|Course contents" }
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b/681a4f4d4bc509ae57597c1b?tab=overview",
  "role": "learner", "needs": "Start|Continue|Retake" }
{ "path": "/learn/courses/681a4b82779a0d9e6c9cc605", "role": "learner",
  "needs": "quiz has no questions|Course contents" }
{ "path": "/learn/courses/681a4b67779a0d9e6c9cc574", "role": "learner",
  "needs": "completed this course|Course contents" }
```

Rows 1, 2, 4 and 5 exist; adding `Course contents` proves the sidebar now renders on the
**outline** route too, which is the visible consequence of nesting. Row 3 is new and proves a
tab deep link survives.

Plus a **manual** pass, since this phase is about *not* reloading and every sweep route is a
cold load:

1. Open a video topic. Play 30 s.
2. Click the next topic. Confirm in React DevTools that **the contents pane and header do not
   unmount**. (The player iframe *will* rebuild — it belongs to the topic body, by design.)
3. Click a quiz. Confirm it renders with the contents pane still on screen.
4. **In-shell resume:** watch A to 12:00 → click B → click A. Confirm A resumes at ~12:00,
   not behind it. This is the case a reload hides.
   <!-- Red team 2026-09-14: F8 / FMA F6 -->
5. Reload on the topic. Confirm playback starts at the stored position.
6. Back button from the quiz returns to the topic; back from `?tab=` returns to the previous
   tab, not out of the course.
7. Console clean throughout — no unhandled Vimeo `destroy()` rejection, the failure mode
   `use-vimeo-watch-tracking.ts:37-42` names.

## Success Criteria

- [ ] `/learn/courses/:courseId` and `/learn/courses/:courseId/:itemId` resolve to the same
      URLs as before; `legacy-route-map.ts` needs no edit and its test stays green
- [ ] `feature-routes.test.ts` passes — no duplicate path from nesting
- [ ] Navigating between two items does not unmount the **contents pane or the header**
      (verified in React DevTools) <!-- Red team 2026-09-14: F8 — criterion rewritten; the
      player container is explicitly NOT part of this claim -->
- [ ] An in-shell A → B → A round trip resumes A at the position last written, not a stale one
- [ ] A quiz completes without leaving the shell
- [ ] `?tab=` round-trips through the URL, an unknown value renders Overview, and the back
      button moves between tabs
- [ ] `course-runner-page.tsx` is deleted, not orphaned
- [ ] No `player-frame.tsx` exists
- [ ] The Phase 3 header component is mounted unmodified — zero lines moved between phases
- [ ] Cold-load sweep 100% healthy across all five course rows
- [ ] Console clean through the seven manual steps

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Implementer tries to split the iframe out of `RichText` | **Was high** | High | The hoist is cut and the reason is recorded; `topic-view.tsx:31,76-78` cited |
| Stale in-shell resume | **Was certain** | Medium | `setQueryData` patch + manual step 4, which a reload-only test hides |
| `?tab=` uses `replace` and breaks the back button | Medium | Low | `history: 'push'` specified explicitly against the cited precedent |
| A lost error branch from `course-runner-page.tsx` | High if rushed | Medium | Step 1 writes the three branches down first; the expired-enrolment 404 (`:47-87`) is the one with real production meaning |
| Duplicate route path from nesting | Low | Medium | `feature-routes.test.ts`; one exported constant |
| No test in the repo can see any of this | **Certain** | High | Five sweep rows plus a seven-step manual pass, both named gate items |
| Merge conflict with Phase 4 | Medium | Low | **Phase 4 merges first.** Phase 4 appends locale keys under `groups.*`/`account.*`, Phase 5 under `courses.*`; both append to `sweep-routes.json`. <!-- Red team 2026-09-14: folded correction --> |
| Phase 7 also edits `courses-routes.tsx` | Medium | Low | **Phase 5 owns `courses-routes.tsx` and `courses-links.ts`.** If Phase 7 lands first, Phase 5 absorbs its route into the nest; otherwise Phase 7 adds `about` as a child of the shell |

## Security Considerations

- No new endpoint, no new permission, no change to who can open what. The outline route is
  `authUser`-scoped to the caller's own enrolment (`learners.route.ts:12`); the shell calls it
  one level higher in the tree.
- The expired-enrolment 404 branch moves but must not soften. `course-runner-page.tsx:56`
  distinguishes `isNotFound` from a transient failure and deliberately offers no "Try again",
  because the outline will never return for that learner and that course. Preserve both the
  branch and its reasoning.
- The tab name comes from the URL, so it is user input. `activeTab` allow-lists against the
  item's own tab set and falls back; it must never be interpolated into a translation key
  path, a class name or a selector without that check.
- The iframe stays inside `RichText` under the existing sandbox policy
  (`packages/ui/src/components/sanitize-rich-text.ts:34-55`). This phase touches neither the
  `sandbox` attribute nor the host allow-list — and cutting the hoist means there is now no
  pressure to.
- Playback position is rendered only on the learner's own shell. It does not reach the
  read-only admin view (`admin/course-read-only.tsx`), and must not be added there.

## Outcome — 2026-09-15

Landed under a one-hour cap, so this is a partial phase. What is done is done
properly; what is not done is named here rather than left to be discovered.

**Done**

- `shell/course-shell.tsx` is the layout route. It owns the outline query and
  the chrome; `CourseOutlinePage` is its index child and `CourseItemRoute` its
  `:itemId` child. Requirements 1, 4, 5, 8, 9, 10.
- Requirement 2 is **proven, not assumed**. A browser run stamped a DOM
  attribute on the contents pane, navigated to a different item, and found the
  same node still carrying it — the pane was never unmounted. `paneSurvived:
  true`, no console errors.
- The pane moved to the left, matching the design and the legacy dashboard.
  It renders on item routes only: on the index the outline page IS the contents
  list, and showing both put the same tree on screen twice.
- Requirement 7, position freshness: `patchItemPosition` writes each resolved
  playhead into the cached outline in place, so an A -> B -> A round trip inside
  the shell resumes where the learner stopped rather than 30 seconds behind.
  Returns the previous object unchanged when nothing moved, so a write that
  changes nothing notifies no subscriber. Four unit tests.
- `course-runner-page.tsx` and `course-layout.tsx` are deleted; their pending,
  error and dispatch logic moved into the shell and the item route intact.

**Not done — carried forward**

- Requirements 3 and 6: the tab strip and its URL search param. Nothing depends
  on it until Phase 6 adds Transcript and Notes, and adding the strip with a
  single Overview tab would have been scaffolding with no reader.
- The contents pane still lists every item in the course rather than collapsing
  to the current module, which on a 65-item course makes a very tall page.
  Phase 6 should decide whether the pane scrolls independently or collapses.

**Verified**: typecheck clean; 80/80 unit tests across the courses feature and
the route-registration test; a browser pass over the outline index, an item
route and an in-shell navigation with no console errors.
