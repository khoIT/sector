---
phase: 4
title: "Scan surfaces to parity"
status: completed
priority: P1
effort: "16 days"
dependencies: [2]
---

# Phase 4: Scan surfaces to parity

## Overview

Close the 54 open items from the parity audit on the surfaces Sector already has.
The decision to replace :3000 rather than sit beside it converted six of them from
"arguable scope" into must-builds — there is no other app for a reviewer to go to.

## The six that changed status

| Gap | Why it is now mandatory |
| --- | --- |
| Reviewer cannot mark a study complete/incomplete | 26% of local scans carry one of those tags; the list filters on them and nothing can write them. The "scan marked incomplete" email to the learner is gone with them. |
| Expert cannot correct a submitted expert review | The monetised path has no correction. |
| Expert review cannot be requested on an existing scan | It exists only inside the create wizard. |
| AI Review Generator and its permission gate | Not ported at all. |
| Reset-upload recovery | `/api/scan/:id/reset-upload` unimplemented; three notices already promise it. |
| Add / delete files after submit | Smallest deletable unit today is a whole scan. |

## Work, grouped by where it lands

**Upload robustness (~4d)** — `fileTotal` is set to the stored-file count so a partial
submit records itself as complete; a single transient PUT failure fails the whole file
with no retry/backoff; "Choose again" accepts any file unvalidated and submits it under
the old name, size and MIME; the 200 MB study cap and per-file size check are absent;
IndexedDB quota failure is swallowed.

**Recovery (~3d)** — a failed confirmation strands a scan in `pending` forever; files
left out of a submit are unrecoverable because the draft and its blobs are destroyed;
reset-upload.

**Reviewer writes (~4d)** — the tags write (`/api/scan/:id/tags`), editing a submitted
review, requesting expert review on an existing scan, the AI Review Generator action in
both expert queues.

**Detail (~3d)** — prev/next scan navigation and position; add and delete individual
files; post-submit editing of findings and external patient ID; reply on a shared-scan
thread; magnify a still; DICOM originals and cine playback; activity-log severity.

**List (~1d)** — queue step-through (prev/next + j/k); the group filter is fed by the
caller's own memberships so it is empty for exactly the roles with the biggest queue;
delete on queue and reviewed rows; learner filter narrowed by chosen groups.

**Cross-cutting (~1d)** — route guards ignore the server's `full-access` /
`admin:full-access` wildcards, locking a wildcard-only role out of the whole app; a
role change needs a full reload to take effect.

## Deliberately still open

**Required findings stay advisory.** The original hard-blocks submit; the rebuild warns
in three places and lets it through. That was a design call, and the audit re-graded it
minor. Revisit only if a clinician asks.

## Related code files

- Modify: `apps/web/src/features/create-scan/**` (upload, draft, submit)
- Modify: `apps/web/src/features/scan-detail/**`
- Modify: `apps/web/src/features/scan-list/**`
- Modify: `apps/web/src/app/permission-guard.tsx` — wildcard handling
- Create: `packages/api-client/src/endpoints/scan-tags.ts`, `scan-reset-upload.ts`,
  `scan-file-delete.ts`, `expert-review-request.ts`, `ai-review.ts`

## i18n (~2d, folded into the totals above)

create-scan and scan-detail are 100% hard-coded English while the shell offers seven
languages. Extract and translate both. Sequence this **last** in the phase so strings
have stopped moving.

## Tests / validation

- Every row in the audit's open list is re-verified **in a browser**, against the same
  API, the way the audit was run. A code-level fix is not a closed row.
- Unit tests for the upload retry policy and the wildcard permission resolution.

## Success criteria

- [ ] The audit's open-major list is empty
- [ ] A reviewer can mark complete/incomplete and the learner gets the email
- [ ] A partially-uploaded scan can be recovered by its owner
- [ ] A wildcard-only role can open the app
- [ ] No hard-coded English left on create-scan or scan-detail

## Risk / rollback

The upload work touches the one path where user data is genuinely destroyed — drafts,
blobs and a study that cannot be re-made. Every change there needs a test that proves
the failure mode before the fix. Everything else is additive and revertible per area.
