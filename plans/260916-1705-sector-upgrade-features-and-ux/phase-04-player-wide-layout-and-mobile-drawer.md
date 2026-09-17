---
phase: 4
title: Player wide layout and mobile drawer
status: completed
priority: P1
effort: 3d
dependencies:
  - 1
---

# Phase 4: Player wide layout and mobile drawer

## Overview

Three columns at `xl`+ — contents | video + title | Overview/Transcript/Notes
panel — and on a phone the video leads while contents moves into a drawer
opened from the breadcrumb, with prev/next in a sticky bottom bar.

## Requirements

**Functional**

- `xl`+: `contents (20rem) | video + title (fluid) | panel (24rem)`.
- `lg`–`xl`: today's two columns (contents | video, tabs beneath).
- `< lg`: video first. Contents becomes a drawer triggered from the breadcrumb
  showing `Contents 3/46`. Prev/next pinned to the bottom of the viewport.
- The Overview / Transcript / Notes tab strip keeps its exact wording,
  including the `…Pending` placeholder sentences — phases 14–16 fill them.
- Prose clamped to a reading measure at every width.

**Non-functional**

- No API change; no new query. `useCourseOutline` stays in `CourseShell`, the
  pane is not remounted by opening the drawer.
- Watch tracking must keep working: `useVimeoWatchTracking(contentRef, …)`
  finds the iframe by walking `contentRef`
  (`runner/topic-view.tsx:52`, `:88`). Moving the tabs OUT of that subtree is
  safe; moving the media out is not.
- Every new string through `t()` in all seven locales, zero baseline additions.

## Architecture

```
< lg                     lg … xl                     xl +
┌───────────────┐   ┌────────┬──────────┐   ┌────────┬──────────┬────────┐
│ breadcrumb    │   │contents│ video    │   │contents│ video    │ panel  │
│  [Contents 3/46]  │        │ title    │   │        │ title    │ tabs   │
├───────────────┤   │        │ tabs     │   │ sticky │          │ sticky │
│ video         │   └────────┴──────────┘   └────────┴──────────┴────────┘
│ title         │
│ tabs          │   drawer (side="left") holds <OutlineSidebar/> below lg
├───────────────┤
│ sticky prev/next
└───────────────┘
```

`course-shell.tsx:115-133` owns the split today. It becomes a three-slot grid
whose third slot is filled by the item view through a context value rather than
by lifting the tabs into the shell — the shell must not know what a topic
renders (a quiz has no tab panel).

```
CourseShell
  ├─ context: { courseId, courseTitle, outline }        (exists)
  └─ <PlayerLayout contents={…} main={…} panel={…}/>    (new, dumb)
        ▲ panel supplied by TopicView via a portal target ref
```

Simplest workable wiring, and the one to take: `PlayerLayout` renders a
`<div ref>` for the panel slot and puts that ref on the shell context;
`TopicView` renders `<TopicTabs/>` into it with `createPortal` when the slot
exists, and inline when it does not (quiz view, narrow widths). React portals
keep the React tree intact, so the tab state, `t()` and the router all behave
normally. The alternative — hoisting `TopicTabs` into `CourseShell` — would
force the shell to fetch the topic detail it currently does not fetch.

Drawer: `@sector/ui` already exports `Drawer`, `DrawerContent`,
`DrawerTrigger`, `DrawerTitle` over the same Radix dialog root
(`packages/ui/src/components/drawer.tsx`), with `side="left"` and
`w-[min(24rem,100vw)]` (`drawer-position.ts:7-10`). No new primitive, no new
dependency.

## Related Code Files

Create:

- `apps/web/src/features/courses/shell/player-layout.tsx` — the three-slot grid
- `apps/web/src/features/courses/shell/contents-drawer.tsx` — trigger +
  `Drawer` wrapping `OutlineSidebar`, `< lg` only
- `apps/web/src/features/courses/runner/player-position.ts` +
  `player-position.test.ts` — `positionLabel(items, currentItemId)` → `{ index, total }`
  for the `Contents 3/46` trigger. Pure; counts the same non-blocked items
  `summariseOutline` counts (`outline/outline-summary.ts:38`)

Modify:

- `apps/web/src/features/courses/shell/course-shell.tsx:99-137` — render
  `PlayerLayout`; breadcrumb gains the drawer trigger below `lg`
- `apps/web/src/features/courses/shell/course-shell-context.ts` — add
  `panelSlot: RefObject<HTMLElement> | null`
- `apps/web/src/features/courses/runner/topic-view.tsx:82-110` — media stays
  inside `contentRef`; `<TopicTabs/>` portals to the panel slot when present;
  `RichText` body gains `max-w-[62ch]`; `<CourseItemNav/>` moves out of the
  flow into the sticky bar below `lg`
- `apps/web/src/features/courses/runner/course-item-nav.tsx` — add a
  `sticky` variant (`fixed inset-x-0 bottom-0 border-t bg-surface p-2 lg:static`)
- `apps/web/src/features/courses/runner/quiz-view.tsx` — no panel; confirm it
  renders full width in the two-slot form
- `apps/web/src/features/courses/runner/outline-sidebar.tsx` — accept an
  `onNavigate` callback so a click inside the drawer closes it
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json` —
  `courses.runner.contents.*`

Delete: none.

## Tests Before

Node environment, `*.test.ts` only. No rendering.

1. Extend `apps/web/src/features/courses/runner/sidebar-groups.test.ts` — pin
   `isGroupOpen` for the current item in a nested module, in a flat module and
   for an id that is not in the outline. The drawer reuses this.
2. Extend `apps/web/src/features/courses/runner/split-topic-media.test.ts` —
   pin `splitTopicMedia` and `hasReadableBody` for: iframe first, iframe
   mid-body, no iframe, empty content. The layout change must not alter what
   counts as "media" vs "body".
3. `apps/web/src/features/courses/outline/outline-summary.test.ts` — pin
   `summariseOutline().totalItems` on an outline containing a blocked quiz;
   `positionLabel` must agree with it.
4. Sweep the four course-item routes already in `scripts/check/sweep-routes.json`
   at 390 / 1440 / 2200 and record: does the video's bounding box start above
   the fold at 390? (Today it does not — `mobile-player-contents-first-390.png`.)

## Refactor

1. `PlayerLayout` extracted from `course-shell.tsx`'s current flex block, with
   the third slot rendering `null` until anything fills it — behaviour
   identical, commit is a pure move.
2. Panel slot ref on the context; `TopicView` portals into it.
3. Drawer + breadcrumb trigger, `< lg`.
4. Sticky prev/next.
5. Prose clamp.

## Tests After

- `player-position.test.ts`: `positionLabel` returns `{index:3,total:46}` for
  the third non-blocked item of a 46-item outline; `{index:0,total:0}` for an
  empty outline; skips blocked items in both halves.
- `sidebar-groups.test.ts` unchanged and green — proof the drawer reuses the
  player's open-module rule rather than a second one.
- `sweep-routes.json`: no new rows needed; the four item routes now also assert
  no overflow at 390 through the phase-1 width loop.

## Implementation Steps

1. `player-layout.tsx`:

   ```tsx
   <div className={cn(
     'flex flex-col items-start gap-4',
     'lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]',
     'xl:grid-cols-[20rem_minmax(0,1fr)_24rem]',
   )}>
     <div className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">{contents}</div>
     <div className="min-w-0 w-full">{main}</div>
     <div ref={panelRef} className="hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto" />
   </div>
   ```

   `min-w-0` on the main slot is load-bearing: without it a wide Vimeo iframe
   makes the grid track exceed the viewport, which is the 390px failure mode
   phase 1 fixed elsewhere.
2. Context: `panelSlot` is `RefObject<HTMLDivElement> | null`. `null` on the
   index route (the landing page has no panel).
3. `TopicView`: keep `<div ref={contentRef} className="sv-video …">` holding
   only `{media}` and the title block. Then:

   ```tsx
   const slot = useCourseShell().panelSlot?.current;
   const tabs = <TopicTabs body={body} />;
   return <>…{slot ? createPortal(tabs, slot) : tabs}</>;
   ```

   Read the ref inside a `useState`/`useEffect` pair, not during render — a
   ref's `.current` is null on first render and the panel would never fill.
   Simplest correct form: `const [slot, setSlot] = useState<HTMLElement|null>(null);
   useEffect(() => setSlot(panelSlot?.current ?? null), [panelSlot]);`
4. Clamp prose: `<RichText html={body} />` inside
   `<div className="max-w-[62ch]">` — the same clamp
   `course-landing-page.tsx:119` already uses for a description, so prose is
   ≤ ~90ch at any width without a second rule.
5. `contents-drawer.tsx`:

   ```tsx
   <Drawer>
     <DrawerTrigger className="lg:hidden …">
       <ListTree/> {t('courses.runner.contents.open', { index, total })}
     </DrawerTrigger>
     <DrawerContent side="left">
       <DrawerTitle>{t('courses.runner.contents.title')}</DrawerTitle>
       <OutlineSidebar … onNavigate={close}/>
     </DrawerContent>
   </Drawer>
   ```

   `DrawerContent` already portals, traps focus and closes on ESC. Use the
   controlled `open`/`onOpenChange` form so `onNavigate` can close it.
6. Breadcrumb (`course-shell.tsx:146-197`): render the drawer trigger as the
   first element of the `<nav>`, `lg:hidden`.
7. `course-item-nav.tsx`: add `variant?: 'inline' | 'sticky'`. Sticky adds
   `fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-2
   lg:static lg:border-t-0 lg:bg-transparent lg:px-0`. The main column gains
   `pb-16 lg:pb-0` so the last line of prose is not hidden under it.
8. `outline-sidebar.tsx`: thread an optional `onNavigate` into the item `Link`
   `onClick`. Default undefined — the desktop pane passes nothing.
9. i18n keys: `courses.runner.contents.open` (`"Contents {{index}}/{{total}}"`),
   `courses.runner.contents.title`, `courses.runner.contents.close`. All seven
   locale files; zero baseline additions.
10. Do not touch `courses.runner.tabs.transcriptPending` /
    `.notesPending` / `.overviewEmpty` — those strings are the contract phases
    14–16 replace.

## Regression Gate

```bash
pnpm --filter @sector/web test
pnpm -w typecheck
pnpm -w lint
pnpm -w build
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

Manual, in a real browser: play a video and confirm the playhead is still
reported (Network: `POST …/track` and the position writes) after the tabs are
portalled; open the drawer, click an item, confirm it navigates AND closes;
at 390 confirm the video is visible without scrolling; at 2200 confirm three
columns with no dead gutter.

## Success Criteria

- [ ] At `xl`+ the tab panel sits beside the video; at `lg`–`xl` beneath it.
- [ ] At 390 the video's top edge is within the first viewport (no scrolling
      past a contents list to reach it).
- [ ] Contents drawer opens from the breadcrumb, shows `Contents N/M`, closes
      on navigation and on ESC.
- [ ] Prev/next reachable without scrolling to the bottom at 390.
- [ ] Prose ≤ 90ch at 2200 (measure a topic with a long Overview body).
- [ ] Vimeo watch tracking still reports position after the portal change.
- [ ] Tab labels and placeholder sentences byte-identical to before.
- [ ] Zero additions to `locale-completeness-baseline.json`.
- [ ] No horizontal document scroll at 390px on the four course-item routes.
- [ ] 3-width browser sweep (390 / 1440 / 2200) green.

## Risk Assessment

| Risk | L×I | Mitigation |
| --- | --- | --- |
| Portalling the tabs breaks watch tracking | M×H | Media never leaves `contentRef`; the manual gate explicitly checks the position writes. Unit tests cannot catch this — node env, no DOM |
| Panel ref read during render yields null forever | M×M | Step 3 uses state + effect, not `ref.current` in render |
| Sticky bottom bar covers content | M×M | `pb-16 lg:pb-0` on the main column; checked at 390 in the sweep |
| Drawer focus trap fights the video iframe | L×M | Radix dialog already handles this for every other dialog in the app; the drawer closes on navigation |
| Three columns squeeze the video below useful size at 1440 | M×M | The third column only appears at `xl` (1280) and is `24rem`; at 1440 the video track is ≥ 600px. Verify at 1440 in the sweep, and drop the panel to `2xl` if it is not |
| A quiz item renders an empty third column | M×L | `QuizView` portals nothing; the slot div is empty and collapses (`xl:block` on an empty div is 0-height, grid track still reserved — if the gutter reads wrong, gate the slot on `panelSlot` having children) |

**Rollback:** the `PlayerLayout` extraction is a behaviour-neutral commit;
reverting commits 2–5 returns to today's two-column player with the extraction
harmlessly in place.
