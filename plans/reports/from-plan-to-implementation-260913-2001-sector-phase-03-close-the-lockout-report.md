# Sector Phase 3 — Close the lockout

**13 Sep 2026.** Branch `feat/sector-phase-03`, 11 commits, merged into `feat/sector`
at `72ad79d`. Implemented by an agent, reviewed adversarially against the API source,
its email templates and the production mirror, fixed, and verified end to end in a
browser against the mirror stack.

## What shipped

| Surface | Route | API |
| --- | --- | --- |
| Password recovery, three steps | `/forgot-password`, `/forgot-password/verify`, `/forgot-password/reset` | `POST /api/forgot-password/{send-otp,verify-otp,reset}` |
| Invitation landing | `/group-invitation-confirmation?token=` — the path the API's email uses | `POST /api/group-members/confirm-invitation` |
| Per-group scan notification preferences | a card on `/profile` | `GET /api/group-notifications`, `PUT /api/group-notifications/:groupId` |
| Account deletion | a card on `/profile`, typed-email confirmation | `DELETE /api/account/delete` |
| Login page | translated; "Forgot password?" link; post-reset notice | — |

Five new i18n namespaces × 7 locales (`auth`, `recovery`, `invitation`, `notifications`,
`deleteAccount`) with a parity test. New api-client files: `schemas/{password-recovery,
invitation,group-notification-preferences}.ts`, `endpoints/{password-reset,invitation,
group-notification-preferences,account-delete}.ts`, hooks, keys; fidelity manifest entry for
`groupnotifications` (2,303 of 2,303 parse; 62 dropped where the group is gone) and reasons
for the nine payload/token schemas.

## What the review caught before merge

Three blockers, all found by reading the server rather than the client:

1. The PUT response typed `user`/`group` as id strings; the service populates both. Every
   save would have parsed as a failure. Fixed by dropping the response schema — the result
   was unused — and testing the void call.
2. `type` was required on the group; 391 of 1,519 production groups have no `type`, so 401
   leaders (776 memberships) could not load the card. Widened, and every spread field
   re-verified against real documents.
3. Two API emails link with `?q=` (the admin reset and the group-leader reset); the pages
   read only `?token=`. Both flows dead-ended. Both parameters are read now, with a test per
   emailed URL shape.

Should-fix items landed in the same pass: re-enabling a disabled preference no longer wipes
the stored notification types; the invitation page signs out at submit rather than on
mount (mount-time sign-out purged the current draft's files); the step token lives in
`sessionStorage`, so the address bar no longer reveals whether an account exists; the
address is validated client-side before the request; hard-coded English on the profile
card was translated.

## Verified in a browser, against the mirror stack

Chromium on `:3101` → mirror API `:5002` → Mailpit:

- Unknown and real address produce the same sentence and the same URL shape; no leak.
- The OTP email arrived in Mailpit; the code verified; the password was reset; the login
  page showed the notice; sign-in with the new password succeeded.
- The profile shows the notification card for a leader; toggling off then on round-trips
  through the API (`aria-checked` true → false → true after refetch).
- `/group-invitation-confirmation` without a token shows the missing-token state.

Not verified: an invitation with a real token (none can be minted without inviting a real
address), and account deletion (destructive; the endpoint test covers the call).

## Decisions worth recording

- **Non-disclosure over a 400.** The server answers 400 "Email not found"; the client
  treats it as success in wording and in URL. Anyone with devtools still sees the 400; that
  is the server's to fix.
- **Deletion copy is true to the server:** a soft delete that keeps scans, reviews and
  memberships. The legacy "all your data is erased" wording was not lifted because it is
  false.
- **The invitation page cannot name the group.** The token carries ids only and there is
  no unauthenticated lookup; the copy says "a group" rather than inventing a route.

## Unresolved questions

1. Should the API's send-otp route stop answering 400 for an unknown address? The client
   hides it; the wire does not.
2. Mailpit is local only; where do OTP emails go in staging?
