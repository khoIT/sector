# Session handoff at cutover

## Decision: same-origin handoff, not re-authentication

Sector is deployed to the same domain the dashboard occupied — cutover replaces the
dashboard's deployment target rather than standing Sector up on a second domain. The
evidence is the redirect mechanism already built for Step 1: `LegacyRedirect`
(`apps/web/src/app/legacy-redirect.tsx`) is a client-side React Router component that
resolves old `/dashboard/*` paths against `legacy-route-map.ts`. That only works if a
browser hitting one of those paths loads _Sector's_ JS bundle in the first place, which
only happens if Sector is served from the same origin the dashboard's links, bookmarks
and emailed notification URLs point at. The rollback plan in the phase notes — "point
users back at the dashboard while it still exists" via DNS — says the same thing from
the other direction: a DNS-level rollback only makes sense if cutover was itself a
DNS/origin-level swap, not a parallel deployment on a second domain.

Given that, a browser signed into the dashboard still has its session sitting in
`localStorage` on the exact origin Sector now serves, so a same-origin handoff applies
and re-authentication is not required.

## What it does

`apps/web/src/app/storage-migration.ts` already renames Sector's own pre-rename keys
(`scanvault.*` → `sector.*`) once, synchronously, before the first render. It now also
picks up the dashboard's session, which was never namespaced: a bare `token` (string)
and a bare `user` (JSON), both written by `gusi_web_dashboard`'s `auth.context.tsx`.

- Runs only when nothing is already written under `sector.session` — a session this
  build already wrote, or already migrated from `scanvault.session`, is newer and wins.
- Validates the combined `{ token, user }` against the same `authSessionSchema` a login
  response is parsed with. A value that fails to parse (corrupt JSON, a shape from some
  other app, a stray `token` with no `user`) is left exactly where it was — nothing here
  guesses at it or deletes it.
- On success, writes `sector.session` and removes the dashboard's `token` and `user`
  keys. One migration, one direction, same as every other key this file moves.

## What it does not do

- **No refresh.** The dashboard never stored a `refreshToken` (its `auth.context.tsx`
  only ever read/wrote `token` and `user`), and `authSessionSchema.refreshToken` is
  optional for exactly this reason. A handed-off session is good for whatever remains
  of the bearer token's 7-day life and cannot be silently renewed past that — the
  learner is signed out and returns to `/login` like any other expired session, not
  told anything special.
- **No revalidation of the token itself.** An already-expired or already-revoked
  dashboard token parses and hands off fine; the first API call then 401s and the
  existing `onUnauthorized` path clears the session, the same as it would for a session
  Sector wrote itself. This is the ordinary expiry path, not a gap this change opens.

## If the same-origin premise turns out to be wrong

If cutover ends up serving Sector from a different domain than the dashboard, this
handoff silently does nothing useful (the dashboard's `localStorage` entries live on
the old origin's storage partition, unreachable from the new one) and every user needs
to sign in again once. That is a re-authentication launch note by a different name: if
that happens, say so in the cutover announcement rather than let people discover it —
"you'll need to sign in again after this update" — the same requirement the plan gives
for the actual re-auth path.
