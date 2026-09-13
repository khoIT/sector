---
phase: 3
title: "Close the lockout"
status: pending
priority: P1
effort: "7 days"
dependencies: [1]
---

# Phase 3: Close the lockout

## Overview

The port introduced a hole the original does not have: **there is no in-app password
recovery.** A grep for `register|forgot` across `apps/web/src` returns only prose in
comments. A user who forgets a password has nowhere to go, and once Sector replaces
:3000 there is no other door.

Alongside it, three account-level surfaces the new app cannot reach at all.

## Requirements

- Functional: a locked-out user can recover unaided; an invited user can land and
  activate; a group leader can read and write their scan-notification settings; a
  user can delete their account.
- Non-functional: every string translated, because this is where a confused user
  arrives.

## Related code files

- Create: `apps/web/src/auth/forgot-password-page.tsx`,
  `reset-password-page.tsx`, `reset-sent-page.tsx`
- Create: `apps/web/src/auth/invitation-landing-page.tsx`
- Create: `apps/web/src/features/account/notification-preferences.tsx`
- Create: `apps/web/src/features/account/delete-account-dialog.tsx`
- Create: `packages/api-client/src/endpoints/password-reset.ts`,
  `invitation.ts`, `group-notification-preferences.ts`, `account-delete.ts`
- Modify: `apps/web/src/auth/login-page.tsx` — the link that does not exist today
- Modify: `apps/web/src/app/router.tsx` — four unauthenticated routes
- Modify: `apps/web/src/i18n/locales/*.json` — 7 locales

## Implementation steps

1. Read the dashboard's own recovery flow and the API's reset endpoints before
   designing anything — the token shape and expiry are the server's, not ours.
2. Forgot → sent → reset, three pages. The "sent" page must not confirm whether the
   address exists.
3. Invitation landing: accept the token, show which group invited them, set a password.
4. Group scan-notification preferences. **916 group leaders across 554 groups have
   live settings today — 2,363 documents, 2,353 with email on.** They are per group,
   not per account; model them that way or the writes will be wrong.
5. Account deletion with a real confirmation and a plain statement of what goes.
6. Translate all of it.

## Tests / validation

- Unit: token handling, expiry, and the "sent" page's non-disclosure.
- Browser: complete a reset end to end against the local API; confirm the notification
  toggle round-trips and reads back after a reload.
- All 7 locales render without a missing-key string.

## Success criteria

- [ ] A user who forgets a password recovers without anyone's help
- [ ] An invited user activates from the email link
- [ ] A group leader's notification settings read and write, per group
- [ ] Account deletion works and says what it does
- [ ] Zero hard-coded English on these surfaces

## Risk / rollback

Low blast radius — all new routes, mostly unauthenticated. The only real risk is
modelling notification settings per account instead of per group, which would write
garbage over 2,363 live documents. Verify the shape against the mirror from Phase 2
before the first write.
