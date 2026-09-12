---
phase: 2
title: "The account control moves to the rail"
status: completed
priority: P2
dependencies: []
---

# Phase 2: The account control moves to the rail

## The premise was wrong, and it was worth saying so

The request was for the profile at the bottom left "like in the old version".
The old version does not have that. `gusi_web_dashboard/src/components/dashboard/sidebar.tsx:142-202`
has a `SidebarFooter` holding **Settings / Help / Logout** — no avatar, no
name, no role. `git log --all -S "Avatar"` on that file returns nothing: it has
never contained one. Legacy's identity block is top-right
(`header.tsx:80` → `<UserNav />`), which is where this app already had it.

Put to the user with both readings. They chose the avatar row — the
shadcn `NavUser` pattern legacy installed the primitives for and never used.
So this is a new arrangement, not a restoration, and the plan says so.

## What was built

`AccountMenu` gained a `placement: 'rail' | 'topbar'` prop rather than a second
component. The identity block, theme items, sign-out and build line are the
same menu; a second copy would be a second copy to keep in step.

- **rail** — full width, name and role at every width, `ChevronUp`,
  `side="top" align="start"`
- **topbar** — the compact chip as before, name and role above `md`

The rail needs no `mt-auto`: `sidebar.tsx`'s nav is already `flex-1`, so a
block after it lands on the bottom edge for free.

## The duplicate this could have recreated

The sidebar is `hidden … lg:block`. A rail-only control disappears entirely
below `lg` — taking sign-out off phones with it — so the topbar keeps a copy.
Mounted **breakpoint-exclusively** (`lg:hidden` on the topbar one), never both
visible, never sharing state.

This matters because the identity block was already removed once for being
duplicated, and putting the rail copy *beside* the topbar copy would recreate
exactly that. Verified rather than assumed, by counting visible triggers:

| viewport | in the rail | in the topbar | identity controls visible |
|---|---|---|---|
| 1440 | visible | hidden | **1** |
| 700 | hidden | visible | **1** |

Also verified: the trigger sits 16px from the rail's bottom edge and the menu
opens upward (menu bottom 832px ≤ trigger top 836px).

## Risk / rollback

Additive. `placement` defaults to `'topbar'`, so the component behaves as
before wherever the prop is omitted.
