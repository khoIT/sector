# Incidental security findings from the Sector port

Found while porting the learner app off `gusi_web_dashboard`. None was the goal of
that work; all sit in `gusi_nodejs_api` and affect production today. Listed
most-serious first. Nothing here was tested against the production cluster — every
check ran against the local production mirror, the local test database, or by
reading source.

## 1. Course-version routes had no permission guards — PROVEN exploitable, FIXED

`src/app/course-meta-version/course-meta-version.route.ts`. Eight routes carried
`authUser` but no `withPermission`; the publish route had never had one.

Proven live on the mirror stack, not argued: a learner account holding no course
permission published a course version. HTTP 200, `draft` → `published`,
`isActive` → true. Any authenticated learner could publish, unpublish or activate
any course version.

Cause: the guards named permissions absent from `config/permissions.ts`, so
whoever wrote them found they locked everyone out and removed them instead of
adding the vocabulary.

Fixed on `feat/sector-course-version-guards`, now merged into `feat/sector-api`,
using permissions that exist (`edit:course`, `course:full-access`). Re-verified:
learner 403, administrator 200. Mirror restored from dump, zero drift.

**Open question for the team:** does the missing course-permission vocabulary
want adding properly, or are `edit:course` / `course:full-access` the intended
long-term gate? And: did anything get published or reassigned in production by an
account that should not have been able to? I have not looked, and I will not
without being asked — it needs a production read.

## 2. `PUT /api/users/:id/password` appears to store the password unhashed

`src/app/user/user.controller.ts:519` passes `body.password` straight to
`userService.updateById`, which is a `findOneAndUpdate`
(`src/database/user/user.service.ts:581`). The hashing hook is
`userSchema.pre('save')` (`src/database/user/user.model.ts:161`) and Mongoose
document middleware does not run on a query update.

The sibling route `PUT /api/users/:id` hashes explicitly first
(`user.controller.ts:473`), which shows the authors knew the hook does not fire
there. This one does not.

Confirmed by reading, not by executing the route. Evidence it is rarely used: in
the production mirror, 13 of 14 stored passwords are bcrypt and 1 is the legacy
WordPress format, none plaintext. That is **not** proof production is clean — the
mirror's `users` collection is a partial, PII-minimised clone of 14 rows against
3,155 real users.

Worth its own ticket, and worth a production count of non-`$2`/non-`$P$` password
prefixes before anyone assumes it never fired.

## 3. Three scan routes trust any authenticated caller with any scan id

Found reviewing the scan surfaces against the API source.

- `POST` / `DELETE /api/scan/:id/tags` require only `edit:scan`. **Every role in the
  production mirror holds `edit:scan`, subscriber included.** There is no ownership
  check, so any authenticated account can tag or untag any scan id — including
  flipping another user's study to "complete".
- `POST /api/scan-review/request-expert` carries **no `withPermission` at all**. The
  route debits a review credit. Any authenticated account can spend a credit against
  any scan id.
- `scan-reset.controller.ts` performs **no ownership check** and logs the action as
  `'Scan reset for re-upload by admin'` while accepting any role. Any authenticated
  account can reset any failed scan, which zeroes its `fileCount`
  (`scan.service.ts:1309-1322`). 491 scans in the mirror are in a resettable state
  holding files.

All three are pre-existing. Sector is the first client that makes them reachable from
a normal learner screen, which is why they surfaced now. The Sector client gates all
three on ownership; the server does not agree, and the server is the one that matters.

## 4. A password hash is written into the audit log

`src/app/user/user.controller.ts:487-497`. `updateUserById` records the new bcrypt
hash in `userlogs.details`. Audit logs are usually read by more people, and
retained longer, than the user collection.

## 5. Live refresh tokens land in access logs

`/api/me` takes the refresh token as a **query parameter**, and `src/server.ts:39`
runs `morgan('tiny')`, which logs `:url`. Sentry captures request URLs too. Observed
directly:

```
GET /api/me?refreshToken=9ce71f3c…4ab144f643d059d1 200 947 - 26.098 ms
```

The query-parameter contract is pre-existing and should not be broken while the
deployed mobile app depends on it. Two cheap mitigations: a morgan `:url` token
that strips `refreshToken`, and a Sentry `beforeSend` that scrubs the query string.
Moving the token to a header belongs in the next API version.

Rotation limits each logged token to a single use — except for the legacy tokens in
finding 5, which stay valid.

## 6. A legacy refresh token survives every revocation path

Found reviewing the new per-device session work. `refreshTokenService` deletes
session rows on password reset, but nothing clears the old `users.refreshToken`
field, and `/me` still honours it and mints a fresh 30-day session from it.

So: token leaks (see finding 4) → user resets their password → reset revokes zero
rows because no session document exists yet → attacker replays the leaked legacy
token and holds a new 30-day session.

Deterministic, no race needed. Fix in flight on `feat/sector-auth-sessions`.

## 7. `POST /api/switch-user` has neither `authUser` nor a rate limit

`src/app/auth/auth.route.ts:28`. Gated only by a signed token. Pre-existing and
unchanged by any Sector work. Flagging, not diagnosing — I have not tested it.

## 8. Five group export routes carry `authUser` only

`src/app/group/manager/manager.route.ts` — `GET /report/:groupId`,
`POST /export-scans/:groupId`, `POST /export-user-scans/:groupId`,
`POST /export-course-progress`, `POST /export-course-data/:groupId`. No
`withPermission` on any of them. They return member lists, scan activity and course
progress, which is real user PII and patient-adjacent data.

The controller may scope results to groups the caller can see. **Unverified** — a
Sector agent is reading it now and this section will be updated with the answer.
If it does not scope, any authenticated user can export any group.

## 9. The Referrals surface carries an enumerable PII leak

From the Phase 9 analysis: 0 referral documents against 3,152 users. Recommended
for deletion rather than porting, which also closes the leak.

## Unresolved questions

1. Should the missing course-permission vocabulary be added, or is the existing
   pair the intended gate? (finding 1)
2. Does anyone want a production audit of what was published or reassigned by
   accounts that lacked the permission? (finding 1)
3. How many production users hold a password that is neither bcrypt nor the
   WordPress format? (finding 2)
4. Do the group export controllers scope by caller? Answer pending. (finding 8)
5. Is reset-upload meant to be a learner action at all? The API logs it as an
   admin action and checks no ownership. (finding 3)
