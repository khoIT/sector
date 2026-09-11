---
phase: 1
title: "The account menu"
status: pending
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

### Role is the point

`role.name` — `subscriber`, `scan reviewer`, `group leader`, `administrator`, `Superadmin` —
goes under the name, title-cased. It is what decides which tabs the user sees and whether the
Assess button is live, and it is currently invisible.

### What goes in the menu

| Item | Why |
|---|---|
| Identity block — name, email, username | Matches the legacy menu header; email disambiguates the two test accounts people run locally |
| Profile | Phase 2 |
| Appearance — the existing three-way theme control, inline | Frees the topbar of a control most users set once; the switcher component moves, it is not rewritten |
| Build version, dim, not a menu item | So a bug report can name a build. Read from Vite's `import.meta.env` at build time |
| Logout | Confirms first, as legacy does |

**Not** in the menu: My Referrals and My Certificates. Both are course-side surfaces that do
not exist here and would be dead links.

## Related Code Files

- Create: `apps/web/src/shell/account-menu.tsx`
- Create: `apps/web/src/shell/user-initials.ts` + `user-initials.test.ts`
- Create: `apps/web/src/shell/logout-dialog.tsx`
- Modify: `apps/web/src/shell/topbar.tsx` — the theme switcher moves into the menu
- Modify: `apps/web/src/auth/auth-context.tsx` — confirm `logout()` clears the stored session
  and the query cache; add the cache clear if it does not
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
- **`logout()` may not clear the React Query cache**, which would leave one user's scan list
  visible for a frame to the next. Check before trusting it; this is a real leak if absent.
- Rollback: revert; the topbar returns to the theme switcher alone.
