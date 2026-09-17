---
phase: 16
title: "Learner notes"
status: pending
priority: P2
effort: "4d"
dependencies: [4]
---

# Phase 16: Learner notes

## Overview

Timestamped personal notes on a topic, in the Notes tab the player already
shows as "not built". A new user-content store with four routes, scoped to
the caller, included in account deletion. The prior roadmap gated this on a
question nobody answered; the gate is kept.

## Gate

**A named observable.** Before this phase starts, the plan owner writes down
what would show Notes was worth building. Proposed:

- notes created per active learner per week (target: ≥ 10% of learners who
  open a topic create at least one note within four weeks of launch), and
- 30-day return-visit rate of note-takers vs non-note-takers.

Instrumentation needed (observability dropped to zero at cutover): two events
(`note_created`, `topic_opened`) written to the existing `userlogs` path or a
minimal events collection — decide in step 1, keep it to counts, no content.
If the owner declines to name an observable, the phase is deferred and the
Notes tab is removed from the strip rather than left as a placeholder.

## Requirements

**Functional**

- Notes tab: list of the learner's notes for this topic, newest first, each
  with a timestamp chip (click → seek the player, same hook phase 14 uses),
  body text, edit, delete.
- "Add note" captures the current playhead when the video is present.
- Notes are private to their author; a group leader never sees them.
- Deleting the account deletes the learner's notes.

**Non-functional**

- Body ≤ 2,000 characters, plain text; rendered as text, never HTML.
- Soft delete (`deletedAt`); list excludes deleted; hard purge on account
  deletion.
- Offline-tolerant UI: optimistic add with rollback; no draft persistence
  beyond the textarea.
- Strings `courses.notes.*` in seven locales; schemas with a fidelity
  decision (`NOT_REPLAYED` until the collection exists on the mirror, then
  `proves: coursetopicnotes`).

## Architecture

```
API (worktree)  src/app/lms/learners/notes/
  notes.route.ts         GET    /api/v2/learners/courses/:courseId/topics/:topicId/notes          authUser, caller-scoped
                         POST   /api/v2/learners/courses/:courseId/topics/:topicId/notes          { timestampSeconds?, body }
                         PATCH  /api/v2/learners/notes/:noteId                  { body }
                         DELETE /api/v2/learners/notes/:noteId                  soft delete
  notes.controller.ts / notes.schema.ts (zod)
  src/database/course-topic-note/{model,service,type}.ts   coursetopicnotes
      { user, course, topic, timestampSeconds, body, createdAt, updatedAt, deletedAt }
      index { user:1, topic:1, deletedAt:1 }
  src/app/account/account.controller.ts  deleteAccount → purge notes for the user

api-client  endpoints/course-notes.ts  + schemas/course-note.ts  + fidelity decision
web         features/courses/runner/notes-panel.tsx      list, add, edit, delete
            features/courses/runner/note-editor.tsx
            features/courses/runner/topic-view.tsx        Notes tab renders the panel
```

Enrolment scoping: reuse the learners' enrolment check the outline route
uses (`src/app/lms/learners/`), so a learner cannot write notes on a topic
they are not enrolled in.

## Related Code Files

- API side — Create: the route/controller/schema trio, the model/service/type
  trio, `tests/functional/learners/notes.test.ts`; Modify:
  `src/app/lms/learners/learners.route.ts` (mount), `src/app/account/account.controller.ts`
  (`deleteAccount`, ~line 287: purge), `src/database/index.ts` (register model).
- api-client — Create: `packages/api-client/src/endpoints/course-notes.ts`,
  `packages/api-client/src/schemas/course-note.ts` (+ tests); Modify:
  `packages/api-client/src/index.ts`, `packages/api-client/src/fidelity/manifest.ts`.
- web — Create: `apps/web/src/features/courses/runner/notes-panel.tsx`,
  `note-editor.tsx`, tests; Modify: `topic-view.tsx`, `apps/web/src/i18n/locales/*.json`.
- Read: `apps/web/src/features/account/delete-account-dialog.tsx` (copy says
  what is deleted — add "your course notes").

## Tests Before

- API: `deleteAccount` functional test pins today's deletion side effects,
  so the purge is an addition the test can assert.
- Web: topic-view tests pin the Notes tab placeholder copy and the tab strip.

## Refactor

- Notes tab swaps placeholder for the panel behind a capability probe (404 on
  the list → keep the placeholder; staging stays honest).

## Tests After

- API: CRUD as owner → 2xx; another user's note → 404 (not 403, to avoid
  enumeration); unenrolled topic → 403; body > 2,000 → 400; account delete
  purges.
- api-client: schema tests + fidelity decision present.
- Web: add with playhead, timestamp click seeks, edit/delete, optimistic
  rollback on 500, placeholder retained on 404.
- Event counts written on create and on topic open.

## Implementation Steps

1. Owner names the observable; add the two events (counts only).
2. API model/service/routes/tests; account purge.
3. api-client endpoint + schema + fidelity decision.
4. Panel + editor + tab wiring + locale keys.
5. Browser pass at 390 and 2200: the Notes panel sits in phase 4's side
   column on wide screens and under the video on phones.

## Regression Gate

```
# API
pnpm vitest run --no-file-parallelism tests/functional/learners tests/functional/account
# scanvault
pnpm --filter @sector/api-client test
pnpm --filter @sector/web test -- src/features/courses/runner
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] Observable named and instrumented before code lands.
- [ ] Notes are caller-scoped end to end; cross-user reads return 404.
- [ ] Account deletion removes notes (test).
- [ ] Notes tab works against the local API and keeps its placeholder
      against staging.
- [ ] No horizontal scroll at 390px on the item route with the panel open.

## Risk Assessment

- **Unmeasured feature** → the gate; without the observable, remove the tab.
- **Clinical text in notes** → learners may type case details; treat as
  personal data: private, purged with the account, excluded from exports
  unless the learner asks.

## Security & Privacy Considerations

- Caller scoping on every route; enrolment check on write; 404 for foreign
  ids; text-only rendering; soft delete with purge on account deletion; no
  admin read route in this phase.
