---
phase: 1
title: The account menu
status: completed
priority: P1
dependencies: []
---

# Phase 1: The account menu

## Overview

Put the signed-in identity in the header: avatar, name, role, and a menu carrying Profile,
appearance and Logout.

## Requirements

- Functional: every page says who is signed in and in what role; Logout confirms, clears the
  session and returns to the login page; the theme control stays reachable.
- Non-functional: no new request — `AuthUser` already carries every field; keyboard-operable;
  collapses to the avatar alone below `md`.

## Architecture

### No new endpoint

The legacy `UserNav` fetches `GET /api/account/profile` on every mount purely to render the
avatar and name. Scan Vault does not need it: `authUserSchema`
(`packages/api-client/src/schemas/auth.ts`) already carries `email`, `userName`, `firstName`,
`lastName`, `photo` and `role.name`, populated at login and on `GET /api/me`. Read it from
`useAuth()`. That removes the legacy skeleton-on-every-page-load as a side effect.

### The avatar is always initials

**No user in the database has a photo** — `photo` is empty on all 3,151. So the fallback is not
a fallback, it is the control. Initials come from the first name and last name where both
exist (2,985 of 3,151) and from the first two characters of the username otherwise. Keep the
`<img>` branch: the field is on the wire and Phase 2 adds the upload that fills it.

**Corrected at build time — the initials branch would never have run.** `photo` is empty in the
database, but the API never returns that: `getUserPhoto` substitutes `DEFAULT_USER_PHOTO`
(`images/user.png`, a grey silhouette) and hands back a presigned URL for it, on login and on
`GET /api/account/profile` alike. So every account was rendering the same anonymous icon, and
initials — the thing that actually distinguishes one account from another, which is the whole
point of putting identity in the header — never appeared. `isDefaultPhoto()` reads that
placeholder as "no photo", matching on the key rather than the whole URL because the presigned
signature and expiry change on every request.

### Role is the point

`role.name` — `subscriber`, `scan reviewer`, `group leader`, `administrator`, `Superadmin` —
goes under the name, title-cased. It is what decides which tabs the user sees and whether the
Assess button is live, and it is currently invisible.

### What goes in the menu

| Item | Why |
|---|---|
| Identity block — name, email, username | Matches the legacy menu header; email disambiguates the two test accounts people run locally |
| Profile | Phase 2 |
| Appearance — three menu items, one per theme | See the deviation below |
| Build version, dim, not a menu item | So a bug report can name a build. Read from Vite's `import.meta.env` at build time |
| Logout | Confirms first, as legacy does |

**Not** in the menu: My Referrals and My Certificates. Both are course-side surfaces that do
not exist here and would be dead links.

### Two deviations, and the reason for each

**1. Appearance is three menu items, not the segmented control moved inline.**

Radix's `DropdownMenu` manages arrow-key focus across its `Item`s only; a segmented control
dropped inside the content as a plain element is not in that roving order, so moving
`ThemeSwitcher` into the menu would have made a keyboard-reachable control keyboard-unreachable.
Three `DropdownMenuItem`s with a tick on the active one are idiomatic for a menu and fully
operable. `onSelect` is prevented so the menu stays open while comparing themes.

`ThemeSwitcher` is NOT dead code: the login page still renders it, which is the one surface with
no account menu to put the choice in.

**2. The shell already had an identity block. It has been consolidated, not duplicated.**

The premise above — "the header never says" — was wrong. `UserSummary` in `sidebar.tsx` carried
an avatar, name, role and a sign-out button, rendered in both the desktop rail and the mobile
nav panel. Adding the account menu beside it would have put the same identity on screen twice,
as the first browser run showed.

`UserSummary` is removed and the account menu is the single identity surface. That also fixes
three things the sidebar version got wrong:

- sign-out fired on one click with **no confirmation**
- initials were computed inline as `firstName[0] + lastName[0]`, which yields an empty string
  whenever either name is missing — 166 of 3,151 users
- on mobile the block lived inside the collapsed nav, so identity was invisible until the user
  opened the menu

The one thing the sidebar version got right — falling back to initials when the presigned photo
URL expires after 24 hours — is carried over into the menu's `Avatar`.

## Related Code Files

- Create: `apps/web/src/shell/account-menu.tsx`
- Create: `apps/web/src/shell/user-initials.ts` + `user-initials.test.ts`
- Create: `apps/web/src/shell/logout-dialog.tsx`
- Modify: `apps/web/src/shell/topbar.tsx` — the theme switcher moves into the menu
- Modify: `apps/web/src/auth/auth-context.tsx` — **checked, no change needed.** `clearSession`
  (exposed as `signOut`, not `logout`) already calls `sessionStore.clear()` and
  `queryClient.clear()`, so the leak this phase flagged as a risk is not present
- Delete: the `UserSummary` block in `apps/web/src/shell/sidebar.tsx` and its two call sites
- Depends on: `packages/ui/src/components/dropdown-menu.tsx` — shared with
  [Scan list phase 3](../260912-0337-scan-list-rows-groups-and-actions/phase-03-the-actions-a-row-needs.md).
  Build it in whichever phase runs first.

## Implementation Steps

1. `user-initials.ts`: `initialsFor(user)` — both names, else username, else `?`. Upper-case,
   two characters, handles a single-character name and a name that is entirely whitespace.
2. `account-menu.tsx`: trigger is avatar + (above `md`) name, role and chevron. Content is the
   identity block, Profile, an Appearance row wrapping `<ThemeSwitcher />`, the version line,
   a separator and Logout.
3. `logout-dialog.tsx`: confirm, then `auth.logout()` then navigate to `/login`. Failure leaves
   the dialog open with the error.
4. Move `<ThemeSwitcher />` out of the topbar into the menu; keep the component as it is.
5. Tests: initials across the four cases; menu renders role name; Logout opens the dialog and
   does not log out until confirmed.

## Tests / Validation

- `pnpm --filter @scanvault/web test`, `-w typecheck`, `lint`
- `pnpm --filter @scanvault/ui test` — contrast gate covers the new menu surface
- By eye at 390px: the trigger is the avatar alone and the menu still opens

## Risk Assessment

- **The theme control becomes less discoverable** once it is one click deeper. It is a
  set-once preference and the header is crowded; if it turns out people flip it constantly,
  moving it back is one line.
- ~~**`logout()` may not clear the React Query cache.**~~ **Checked — it does.** `clearSession`
  in `auth-context.tsx` calls `queryClient.clear()` alongside `sessionStore.clear()`.
- Rollback: revert; the topbar returns to the theme switcher alone.
