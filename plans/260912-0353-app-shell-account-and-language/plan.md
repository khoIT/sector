---
title: "App shell: account, profile and language"
description: "The header chrome Scan Vault is missing — an account menu with a real identity block, the profile page behind it, and a language control — built before the create-scan redesign so the working create-scan flow stays untouched."
status: pending
priority: P1
branch: "main"
tags: [scan-vault, shell, account, i18n]
blockedBy: []
blocks: [260912-0321-create-scan-study-redesign]
created: "2026-09-11T20:56:04.189Z"
createdBy: "ck:plan"
source: skill
---

# App shell: account, profile and language

## Overview

Scan Vault's topbar carries a page title, a mobile nav toggle and a theme switcher. The legacy
dashboard's carries a language switcher, a feedback button, a notification bell, a mode toggle
and an account menu that names who you are signed in as and what role you hold.

A reviewer working a queue of other people's scans needs to know which account they are acting
as — the permission model turns on it, and "you cannot assess your own scan" is a rule the user
can only reason about if the row and the header agree on who they are. Today the header never
says.

**This ships before the create-scan redesign** (`260912-0321`). That plan rewrites the create
flow; this one adds shell around it. Doing the shell first means the current create-scan study
keeps working untouched while the chrome lands, and the redesign starts on a finished shell
rather than moving a target.

## What already exists, and what is missing

| Legacy header control | Scan Vault |
|---|---|
| Mode toggle (light/dark, two states) | **Already better.** `theme-switcher.tsx` is a three-way light/dark/**system** control; `system` removes `data-theme` so the OS preference keeps driving the palette |
| Account menu — avatar, name, role, Profile, Referrals, Certificates, Logout | **Missing entirely.** No identity anywhere in the shell |
| Language switcher — 7 locales | **Missing.** No i18n seam at all |
| Notification bell | Out of scope: push notifications are a feature-flagged LMS surface, not scan vault |
| Feedback button | Out of scope: same |
| Referrals, Certificates | Out of scope: course-side surfaces with no Scan Vault meaning |

## What the data says

Measured against local `gusi_dev`, read-only:

| Question | Answer | Consequence |
|---|---|---|
| How many of the 3,151 users have a profile photo? | **Zero.** `photo` is empty on every user | The avatar is always initials. Build the fallback properly; keep the `<img>` path because the field and the upload route exist |
| How many have an extended profile (profession, licensing, facility)? | **Zero.** `userprofiles` is an empty collection | The legacy profile editor's six sections have no data behind them. Phase 2 builds identity and password only |
| Do users have names? | 2,985 of 3,151 have a first name; all 3,151 have a username | The identity block falls back to username, not to a blank |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [The account menu](./phase-01-the-account-menu.md) | Pending |
| 2 | [Profile and password](./phase-02-profile-and-password.md) | Pending |
| 3 | [Language placeholder](./phase-03-language-placeholder.md) | Pending |

## Dependencies

- Phase 1 needs the `DropdownMenu` primitive. So does Phase 3 of
  [Scan list: rows, groups and actions](../260912-0337-scan-list-rows-groups-and-actions/plan.md),
  which adds `@radix-ui/react-dropdown-menu` and `packages/ui/src/components/dropdown-menu.tsx`.
  **Whichever runs first builds it; the second reuses it.** Do not build two.
- Phase 2 is reachable only through Phase 1's menu, so it follows it.
- Phase 3 is independent of both.
- This plan blocks `260912-0321-create-scan-study-redesign`.

## Acceptance criteria

- [ ] The header always says which account is signed in and what role it holds
- [ ] Logout is reachable in two clicks from every page and confirms before acting
- [ ] A user can change their own name and password without leaving Scan Vault
- [ ] The language control lists the locales the legacy app ships and persists a choice
- [ ] Every string the new surfaces add goes through the translation seam, not a literal
- [ ] `pnpm -w typecheck`, `lint`, `test`, `build` green; contrast gate green

## Open question

"Version design selection" is read here as **appearance**: the existing three-way theme control
moves into the account menu beside the build version, which is Phase 1. If it instead meant a
*UI version* switch — the legacy `SCANS_NEW_UI_V2` feature flag that swaps a row's action layout
between an old and a new design — say so and Phase 1 changes shape. Scan Vault has one design,
so a version switch would mean building a second one to switch to.

## Source material

- `gusi_web_dashboard/src/components/dashboard/header.tsx`, `user-nav.tsx`,
  `mode-toggle.tsx`, `src/components/language-switcher.tsx`, `src/context/language.context.tsx`,
  `src/i18n/config.ts` — read 12 Sep
- `gusi_web_dashboard/src/api/account/account.api.ts` — the five account routes
