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

- `DELETE /api/scan/:id/files` has **no ownership check** either, and it hard-deletes
  File documents rather than soft-deleting them.

All four are pre-existing. Sector is the first client that makes them reachable from
a normal learner screen, which is why they surfaced now. The Sector client gates them
all on ownership; the server does not agree, and the server is the one that matters.

The last one deserves attention because the reset-upload recovery now calls it from a
learner action. Sector narrows the call to records whose own status says the bytes
never reached storage, so it deletes nothing that holds data — but a hard-deleting
route with no ownership check, reachable by any authenticated caller with any scan id,
should not stay that way.

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

## 6. A legacy refresh token survived every revocation path — FIXED, needs sign-off

Found reviewing the new per-device session work. `refreshTokenService` deletes
session rows on password reset, but nothing clears the old `users.refreshToken`
field, and `/me` still honours it and mints a fresh 30-day session from it.

So: token leaks (see finding 4) → user resets their password → reset revokes zero
rows because no session document exists yet → attacker replays the leaked legacy
token and holds a new 30-day session.

Deterministic, no race needed.

Fixed. Revocation now clears the legacy field as well as the session rows, and the
migration upserts so two tabs presenting the same legacy token both succeed instead
of one getting a 500 carrying the raw database error. Both regression tests were run
against the pre-fix source and fail there with exactly these symptoms, so they are
not phantom tests. 176 of 176 tests pass on the merged branch.

**Two customer-visible behaviour changes ride with it and want a decision before
this reaches production:**

1. `/api/me` can now return 401 where it returned 200, but only when a session is
   revoked between the lookup and the rotation — that is, a password reset, password
   change or account deletion lands mid-request. That is the fix working. Sector
   already drops its session on any 401, so it is safe there. The deployed mobile
   client's behaviour is unknown and is not in any repository cloned here.
2. `PUT /api/users/:id` now signs a user out when an admin edits their password or
   moves them off active status. Previously it did not, while the dedicated password
   route did — so the same capability had opposite outcomes depending on which route
   an admin used.

## 7. `POST /api/switch-user` has neither `authUser` nor a rate limit

`src/app/auth/auth.route.ts:28`. Gated only by a signed token. Pre-existing and
unchanged by any Sector work. Flagging, not diagnosing — I have not tested it.

## 8. Five group export routes carry `authUser` only — safe today, but only by a flag

`src/app/group/manager/manager.route.ts` — `GET /report/:groupId`,
`POST /export-scans/:groupId`, `POST /export-user-scans/:groupId`,
`POST /export-course-progress`, `POST /export-course-data/:groupId`. No
`withPermission` on any of them. They return member lists, scan activity and course
progress, which is real user PII and patient-adjacent data.

**Answered.** All five do scope, inside the controller body, via `assertLeadsGroup`.
So they are not exploitable today. But that safety rests entirely on
`GROUP_LEADER_SCOPED_VISIBILITY` staying hardcoded true. If that kill switch is ever
flipped, these routes — and the whole `/manage` family — have no second line of
defence, because none of them carries a permission gate. A route whose only
protection is a constant nobody thinks of as security is one refactor from being
open.

**Adjacent, and worse — two of them, both verified:**

- `PUT` and `DELETE /api/group-members/:id` have no `assertLeadsGroup` at all, only a
  permission gate. Same family, same data, no scoping.
- `GET /api/group-assignment/learners?groupId=<any>` has **no scoping of any kind** —
  zero `assertLeadsGroup` in that controller — and it returns learner **email
  addresses**. The seeded `subscriber` role holds `read:group-assignment`, so the
  lowest-privileged account in the system can read the roster of any group by id.

That last one is the most directly exploitable item in this document. Group ids are
not secret; they appear in URLs.

## 9. Dashboard aggregates are readable for any group by any signed-in user

`checkUserAccess` short-circuits on its self-check before it reaches the group check, so
an authenticated caller passing any `groupId` gets that group's dashboard aggregates —
scan counts, course progress, learner totals. The seeded `subscriber` role, the lowest
in the system, is enough.

Found while reviewing the new home screen, which is the first client to call these
endpoints. The endpoint's own doc comment claims the access check works; it does not.
The comment is being corrected on the client side, but the check itself is an API fix.

Same shape as finding 8's adjacent items: an authorization helper that reads as if it
gates, placed where it does not.

## 10. `GET /api/group-assignment` trusts the caller's `groupId`

The route applies a permission check and then trusts whatever `groupId` the client
sends. Proven: a minted `subscriber` token belonging to a user who leads no group got
HTTP 200 and **8,720 assignment rows carrying real student names and email addresses**.
The sibling route `/group/:groupId` correctly returns 403 for the same user.

The route file's own comment claims a bare subscriber does not hold
`read:group-assignment`. The roles collection contradicts it.

This is the same finding as 9 and the group-export items, and it is now the third
route family where the scoping sits in one sibling and not the other. Worth fixing as
a class rather than one route at a time.

## 11. The Referrals surface carries an enumerable PII leak

From the Phase 9 analysis: 0 referral documents against 3,152 users. Recommended
for deletion rather than porting, which also closes the leak.

## Unresolved questions

1. Should the missing course-permission vocabulary be added, or is the existing
   pair the intended gate? (finding 1)
2. Does anyone want a production audit of what was published or reassigned by
   accounts that lacked the permission? (finding 1)
3. How many production users hold a password that is neither bcrypt nor the
   WordPress format? (finding 2)
4. Answered: the export controllers do scope, but only through a hardcoded flag with
   no permission gate behind it. Is that flag meant to be flippable? (finding 8)
5. Is reset-upload meant to be a learner action at all? The API logs it as an
   admin action and checks no ownership. (finding 3)
6. `checkUserAccess` gates several endpoints, not just the dashboard ones. Does the
   same short-circuit affect the others? I checked only the dashboard path. (finding 9)
