---
phase: 2
title: "Profile and password"
status: pending
priority: P2
dependencies: [1]
---

# Phase 2: Profile and password

## Overview

The page behind the Profile link: see the account, change the name, change the photo, change
the password. Not the legacy profile editor.

## Requirements

- Functional: a signed-in user can read their own account detail, update first and last name,
  upload a photo, and change their password with the current one; each result is confirmed or
  refused with the server's message.
- Non-functional: the auth context updates in place after a successful save, so the account
  menu's name changes without a reload.

## Architecture

### Scope, and the evidence for cutting it

The legacy profile schema has six sections — personal info, professional identity, licensing,
facility, device and experience, funding — with enums for profession, POCUS device, training
status and more.

**The `userprofiles` collection is empty. Zero documents, against 3,151 users.** Nobody has
ever filled one in. Building a six-section editor for a shape with no data is speculation, and
in a scan vault it is speculation about a course-side concern. So this phase builds the part
that is backed by real fields on the `users` collection and nothing else:

- name — 2,985 of 3,151 users have one
- photo — **zero** users have one, but the field and the upload route exist
- password — every account has one

If the extended profile becomes a requirement it is a separate plan with its own reason.

### Routes

All four already exist on the server and are unused by this app:

| Route | Use |
|---|---|
| `GET /api/account/profile` | Not needed for read — `useAuth()` has it. Used only to re-read after a write |
| `PUT /api/account/profile` | first name, last name |
| `PUT /api/account/password` | current + new |
| `POST /api/account/photo` | multipart, answers `{ url }` |

`DELETE /api/account/delete` is deliberately not wired. Account deletion from inside a scan
vault is not a flow anyone asked for and it is unrecoverable.

The photo route posts `FormData`. Check `packages/api-client/src/client.ts` before writing it —
the client sets a JSON content type by default, and multipart needs the browser to set the
boundary itself, so this may need a documented escape hatch rather than a new client.

## Related Code Files

- Create: `packages/api-client/src/endpoints/account.ts`, `schemas/account.ts`,
  `react/use-account.ts`
- Create: `apps/web/src/features/account/account-page.tsx`, `profile-form.tsx`,
  `password-form.tsx`, `photo-upload.tsx`
- Modify: `apps/web/src/app/routes.tsx` (or wherever routes are declared) — add `/account`
- Modify: `apps/web/src/auth/auth-context.tsx` — a way to merge a partial user update

## Implementation Steps

1. `schemas/account.ts`: reuse `authUserSchema` for the read shape rather than restating it;
   add payload schemas for the two writes.
2. `endpoints/account.ts`: the three calls. Photo upload last, once the multipart question above
   is settled.
3. `use-account.ts`: mutations that, on success, merge the returned user into the auth context.
4. `account-page.tsx`: two cards — Account (name, photo, read-only email/username/role) and
   Password. Server error messages render inline, not as a toast that disappears.
5. Password form: current, new, confirm. Client-side check that new matches confirm and differs
   from current; everything else is the server's rule, not a guessed one.
6. Tests: payload shapes; the auth-context merge; the confirm-mismatch guard.

## Tests / Validation

- `pnpm --filter @scanvault/api-client test`, `--filter @scanvault/web test`, `-w typecheck`
- By hand against staging with a throwaway account: change a name and watch the account menu
  update without a reload; change a password and sign in again with it

## Risk Assessment

- **Multipart through a JSON client.** The most likely place this phase stalls. If the client
  cannot express it cleanly, the photo upload is cut from this phase rather than bent into it —
  no user has a photo today, so nothing regresses.
- **A password change may invalidate the session.** Test it; if the server rotates the token,
  either refresh it or send the user to the login page with a message, never leave them on a
  page whose next request 401s.
- **Email and username are read-only here.** Both are identity keys used elsewhere; changing
  them is not a scan vault concern.
- Rollback: revert; the Profile link can point nowhere for one release or be hidden.
