# Any signed-in account could publish a course version

**14 Sep 2026.** The plan opens with a warning that eight `withPermission` guards ship
commented out on `course-meta-version.route.ts`, and asks for triage before Phase 5.
Phase 5 has landed, so this is that triage. The exposure is real, it is demonstrated
below against a copy of production data, and it is fixed on branch
`feat/sector-course-version-guards` in the API repo.

## Demonstrated, not inferred

A session was minted for the seeded learner account — role `subscriber`, holding **no
course permission of any kind** — against a local API serving the restored production
mirror. It published a draft course version:

```
POST /api/course-meta-version/<versionId>/publish
{"versionId":"…","publishedBy":"…","changeLog":"authorization check"}

HTTP 200  "Version published successfully"
```

| | Before | After |
| --- | --- | --- |
| `status` | draft | **published** |
| `isActive` | false | **true** |

The version became the one every learner on that course resolves. The mirror was
restored from the dump immediately afterwards and verified free of drift, siblings
included.

## What was reachable

Eight routes, all `authUser` only, no role check at all:

| Route | What an ordinary account could do |
| --- | --- |
| `POST /:versionId/publish` | make any draft the live version of any course |
| `POST /:versionId/archive` | take a published version out of service |
| `POST /:versionId/restore` | bring an archived one back |
| `POST /:versionId/:status` | approve a version, which is what lets it be published |
| `POST /course/:courseId/user-group` | read which versions a user group resolves |
| `POST /assign/user-course` | repoint one learner's enrolment at another version |
| `POST /assign/users` | repoint many learners at once |
| `POST /migrate/:userCourseId` | migrate a learner between versions |

A ninth, `POST /:versionId/set-default`, never had a guard at all, not even a commented
one, and it decides which version a learner without a version pin resolves.

## Why they were commented out

Not a regression, and not carelessness. The guards were committed already commented
out, in the same commit that created the file. The reason is visible in what they say:
`publish:course`, `archive:course`, `restore:course`, `approve:course`, `manage:course`,
`assign:course` and `migrate:course` **are not in `config/permissions.ts` and never
were**. The `Permission` type is derived from that object, so the code would not compile
with them in place, and no role could hold one if it did. Whoever wrote them had a
permission vocabulary in mind that was never added.

## The fix

Guard with the permissions that exist, and with the ones the sibling writes in the same
file already use — `edit:course` guards create, update, delete, reject and
convert-to-draft there today. `withPermission` needs only one of a listed set and treats
`full-access` / `admin:full-access` as wildcards, so nobody who could already edit a
version loses access. The three routes that repoint real learners also accept
`edit:user-course`, because whoever may edit an enrolment may move it.

Re-verified end to end on the mirror:

| | learner | administrator |
| --- | --- | --- |
| publish | **403** | 200 |
| archive | **403** | 200 |
| set-default | **403** | passes the guard |

## One thing found on the way, not fixed

`POST /:versionId/set-default` answers **500** when the version is not published. The
service throws "Only published versions can be set as default" and the error middleware
does not recognise it, so a user error is reported as a server fault and the message is
echoed to the caller. Pre-existing, unrelated to the guards, and worth its own ticket.

## Unresolved questions

1. Is the missing permission vocabulary (`publish:course` and the rest) wanted? If those
   are meant to be assignable separately from `edit:course`, they need adding to
   `config/permissions.ts` and to a role, and these guards should then name them. The fix
   here is deliberately the smallest one that closes the hole without inventing a
   permission model.
2. Was anything published, archived or reassigned in production by an account that should
   not have been able to? The version documents carry `publishedBy` and the approval
   history, so it is answerable with a read.
