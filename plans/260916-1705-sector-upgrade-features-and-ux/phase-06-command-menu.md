---
phase: 6
title: Command menu
status: completed
priority: P2
effort: 1.5d
dependencies:
  - 1
---

# Phase 6: Command menu

## Overview

A ⌘K / Ctrl-K command menu on every authenticated route: jump to any nav
destination the user may see, and to scans and courses already in the query
cache. The legacy dashboard had one (`search-menu.tsx`, cmdk); Sector has
none. Client-only, no API change.

## Requirements

**Functional**

- Opens with ⌘K (mac) / Ctrl-K, and from a search affordance in the topbar.
- Sources, in this order: nav destinations (filtered by the same visibility
  predicate the rail uses), recent scans (from cached list pages), recent
  courses (from the cached My Courses page). Nothing is fetched on open.
- Typing filters across all sources; Enter navigates; Esc closes; arrows move.
- Empty query shows the nav destinations only.
- Fully keyboard operable; focus returns to the trigger on close.

**Non-functional**

- No network on open or on keystroke. Recent items come from
  `queryClient.getQueriesData()`; if the cache is cold the section is absent,
  not empty.
- Strings through `t()` in all seven locales under a new `command.*`
  namespace; add a `command-menu-locale-parity.test.ts` next to the other
  namespace parity tests so the gate covers it.
- No new dependency. `@radix-ui/react-dialog` (already in `packages/ui`) +
  a listbox with `aria-activedescendant` is enough for four sources; `cmdk`
  would add fuzzy scoring we do not need at this size. Revisit if sources grow.

## Architecture

```
shell/topbar.tsx ── trigger button (search icon, "⌘K" kbd hint) ──┐
document keydown (⌘K / Ctrl-K) ───────────────────────────────────┤
                                                                   ▼
shell/command-menu/command-menu.tsx      Dialog (packages/ui) + <CommandList/>
   ├── command-sources.ts                pure: (user, queryClient, t) → CommandItem[]
   │     ├── navItems()        visibleNavGroups(user) → {id, label, path, icon}
   │     ├── recentScans()     queryClient.getQueriesData({queryKey:['scans']})
   │     └── recentCourses()   getQueriesData({queryKey:['learner-courses']})
   ├── filter-commands.ts                pure: (items, query) → ranked items
   └── use-command-menu-hotkey.ts        keydown listener, ignores editable targets
```

Item shape: `{ id, group: 'nav'|'scan'|'course', label, hint?, path }`.
Ranking: prefix match on label > word-start match > substring; stable within
a group. Max 8 per group.

## Related Code Files

- Create: `apps/web/src/shell/command-menu/command-menu.tsx`
- Create: `apps/web/src/shell/command-menu/command-sources.ts`
- Create: `apps/web/src/shell/command-menu/command-sources.test.ts`
- Create: `apps/web/src/shell/command-menu/filter-commands.ts`
- Create: `apps/web/src/shell/command-menu/filter-commands.test.ts`
- Create: `apps/web/src/shell/command-menu/use-command-menu-hotkey.ts`
- Create: `apps/web/src/i18n/command-menu-locale-parity.test.ts`
- Modify: `apps/web/src/shell/topbar.tsx` (trigger)
- Modify: `apps/web/src/shell/app-shell.tsx` (mount once inside `NuqsAdapter`)
- Modify: `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`
- Read only: `apps/web/src/shell/nav-config.ts` (`visibleNavGroups`, `NAV_GROUPS`),
  `apps/web/src/app/query-client.ts`, legacy
  `gusi_web_dashboard/src/components/dashboard/search-menu.tsx`

Verify the exact query keys used by the scan lists and My Courses before
writing `command-sources.ts` (grep `queryKey` in `packages/api-client/src/endpoints/`).

## Tests Before

- `apps/web/src/shell/nav-config.test.ts` already pins `visibleNavGroups`
  per role. Add a case asserting the resolved item list for each demo role
  is what `command-sources.navItems()` will consume, so a later nav change
  fails here first.
- Topbar render test (new, `topbar.test.tsx`): renders title and the mobile
  nav toggle for a signed-in user — pins the current DOM before the trigger
  is added.

## Refactor

- Topbar gains a trigger; nothing else in the shell changes shape.
- `use-command-menu-hotkey.ts` ignores events whose target is an input,
  textarea, select or `contenteditable`, so typing "k" with ⌘ held in a note
  field does not open the menu.

## Tests After

- `command-sources.test.ts`: nav items follow role visibility (learner sees
  no Group Administration); cold cache yields no scan/course groups; warm
  cache yields ≤ 8 per group, newest first.
- `filter-commands.test.ts`: prefix beats word-start beats substring; empty
  query returns nav only; diacritics-insensitive match.
- `command-menu.test.tsx` (jsdom): opens on ⌘K, arrow moves
  `aria-activedescendant`, Enter calls navigate with the item path, Esc
  restores focus to the trigger.
- Locale parity test for `command.*`.

## Implementation Steps

1. Write `filter-commands.ts` + tests (pure).
2. Write `command-sources.ts` + tests; read query keys from the endpoints, not
   string literals typed by hand.
3. Build `command-menu.tsx` on `Dialog`/`DialogContent` from `@sector/ui`;
   listbox semantics: `role="listbox"`, options `role="option"`, one
   `aria-activedescendant`.
4. Hotkey hook; mount `<CommandMenu/>` once in `app-shell.tsx`.
5. Topbar trigger: icon button with visible `⌘K` hint on `lg+`, icon only below.
6. Add `command.*` keys to all seven locales; write the parity test.
7. Run the 3-width sweep: the dialog must fit at 390 (full-width sheet) and
   never cause horizontal document scroll.

## Regression Gate

```
pnpm --filter @sector/web test -- src/shell
pnpm --filter @sector/web test -- src/i18n
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>   # phase 1 sweep, 390/1440/2200
```

## Success Criteria

- [ ] ⌘K / Ctrl-K opens the menu on every authenticated route; Esc closes and
      returns focus.
- [ ] A learner never sees Group Administration in the menu.
- [ ] Zero network requests on open or while typing (assert in the jsdom test
      with a fetch spy).
- [ ] Keyboard-only path: open → type → arrow → Enter navigates.
- [ ] No horizontal document scroll at 390px with the menu open; sweep green.
- [ ] All `command.*` keys present in seven locales; no baseline additions.

## Risk Assessment

- **Hotkey conflicts** with browser/OS shortcuts on some layouts → only
  ⌘K/Ctrl-K, never single-letter hotkeys; skipped over editable targets.
- **Stale cache items** (a deleted scan still listed) → navigating to it hits
  the existing 404 page; acceptable, and the list refreshes on next visit.
- **Scope creep** toward full-text search → out of scope; sources are fixed
  to three, no server search in this phase.
