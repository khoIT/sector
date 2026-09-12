# ScanVault vs ScanHub — verified parity gaps on the scan surfaces

**13 Sep 2026.** Nine parallel audits read the original
(`gusi_web_dashboard`, running at :3000) against the port (`scanvault/apps/web`, :3100), then a
second pass tried to **refute** every claim. 76 of 90 claims survived. Severities below are the
verifier's re-grade, not the finder's.

Both apps were driven in a real browser against the same API (`localhost:5001`), and every
"fixed" row was re-verified there.

**Where it stands: 20 fixed this session, 2 part-fixed, 54 open** — 26 of the 76 are major.

## What the browser found that code review did not

- The **scan detail page told every learner their study went to no group.**
  `GET /api/scan/:id/get` does not send `groups`; `GET /api/scan/list` does. One schema covered
  both and carried `.default([])`, so a field the response never sent read as the positive claim
  that routing went nowhere — on the one decision submit cannot undo.
- **Submitting told nobody.** The API sends the owner's email and the group leaders' notices from
  `PUT /api/scan/:id/update` with `notifyUser`, and the owner's is additionally gated on the scan
  holding at least one `scanLogs` entry. The port called `create` and stopped, so a submitted
  study reached no inbox and opened with an empty Activity log.
- **The range readout rendered "221–7 of 7"** on a page past the end of a list — beside a
  diagnostic empty state telling a group leader they lead no groups, with the pagination hidden
  because it was gated on having rows.

## The four that are worth arguing about

1. **Required findings no longer block submit** (`findings/required-findings-not-blocking`,
   confirmed, re-graded minor). The original hard-blocks; the port makes them advisory and warns
   in three places. That was a deliberate design call in the rebuild, not an oversight — but it
   does mean the port accepts studies the original rejects. **A product decision, not a bug.**
2. **Expert review cannot be requested on an existing scan.** It is the monetised path and it
   exists only inside the create wizard. Requested in three places by the audit.
3. **Reviewers cannot mark a study complete/incomplete.** 26% of scans in the local database carry
   one of those tags; the port's list can filter on them but nothing can write them, and the
   "scan marked incomplete" email to the learner is gone with them.
4. **create-scan and scan-detail are hard-coded English** while the shell offers seven languages.

## Deliberately out of scope

The organization-scoped ontology and the org `forms` payload: `scans_org-with-forms_all` is off
everywhere, so `organizationId` stays null and the generic `/api/scan-type/:id/items` is correct.
Note that `gusi_web_dashboard` **forces that flag on in local dev**
(`src/config/growthbook-local-overrides.ts:32`), so :3000 shows five org scan types where :3100
shows the twenty-two generic ones. That difference is the flag, not a gap.

The dashboard's own **"Scan Vault" tab** (a library of uploaded files) was refuted as a gap: the
surface is unreachable in the original too.

## The full list

### Major (26)

| | Area | Gap | Status |
| --- | --- | --- | --- |
|  | upload | fileTotal is set to the stored-file count, so a partial submit records itself as complete | open |
|  | upload | A single transient PUT failure fails the whole file — automatic retry with backoff is gone | open |
|  | upload | "Choose again" accepts any file unvalidated and submits it under the old name, size and MIME type | open |
|  | sharing | Group leaders are never notified that a study was routed to their group | **fixed** |
|  | sharing | `scanLogs` is dropped from the submit sequence, so the owner gets no submission email/push and the scan's activity log is empty | **fixed** |
| ~ | sharing | A failed file confirmation strands the scan in `pending` forever and the receipt's advice cannot be followed | open |
|  | expert | No way to request an expert review on a scan that already exists | open |
|  | expert | Three notices promise a recovery path the port does not have | **fixed** |
|  | expert | review.reviewMD / translatedReviewMD are parsed but never displayed | **fixed** |
|  | expert | AI Review Generator and its permission gate are not ported | open |
|  | draft | "Discard draft" / "Start fresh" destroy a 7-day draft on one unconfirmed click | **fixed** |
|  | draft | No user-log audit trail is written for scans created in the port — every study's Activity log is empty | **fixed** |
|  | draft | After a partial submit the only recovery instruction points at a feature the port does not have | part-fixed |
|  | detail | AI-assisted review markdown and Instant Review panel are never rendered | part-fixed |
|  | detail | No prev/next scan navigation or position indicator on any detail page | open |
|  | detail | An expert can no longer correct a submitted expert review | open |
|  | detail | Reviewer cannot mark a study complete/incomplete; the list filter for it is now write-only | open |
|  | detail | Pending/failed files are counted and paged through in the media viewer | **fixed** |
| ~ | file-vault | No way to delete a single uploaded file; the port's smallest deletable unit is a whole scan | open |
|  | list | Step-through-the-queue navigation (prev/next + j/k) is not ported | open |
|  | list | An empty page past the end shows a false diagnostic and removes every pagination control | **fixed** |
|  | list | Group filter is fed by the caller's own memberships, so it is empty for the roles with the biggest queue | open |
|  | cross | The create-scan and scan-detail surfaces are 100% hard-coded English while the shell still offers 7 languages | open |
|  | cross | No way to recover a failed or partially-uploaded scan — /api/scan/:id/reset-upload is not implemented | open |
|  | cross | Expert review can no longer be requested for an already-submitted scan | open |
|  | cross | Reviewers can no longer mark a scan complete/incomplete — the /api/scan/:id/tags writes are gone, and with them the "scan marked incomplete" email to the learner | open |

### Minor (44)

| | Area | Gap | Status |
| --- | --- | --- | --- |
| ~ | upload | Files left out of the submit are unrecoverable — the draft and its blobs are destroyed | open |
|  | upload | The 200 MB study cap and the per-file size check are absent | open |
|  | upload | A file is invisible while it validates, and validation runs one file at a time | open |
| ~ | upload | The three-file nudge is auto-hidden exactly when the user is about to submit | open |
|  | upload | Removing or cancelling a file leaves its blob in IndexedDB for the rest of the session | open |
| ~ | upload | IndexedDB being unavailable or full is swallowed with no quota check and no message | open |
|  | upload | The scan's upload audit trail is never written — scanLogs is left empty | **fixed** |
|  | upload | The submitted step tells the user to retry the upload from the study, which nothing supports | **fixed** |
|  | sharing | "Only you will see this study" / "Nobody — no group selected" overstates what groupIds actually gates | **fixed** |
|  | expert | Spending a credit at submit leaves the cached balance one credit too high | **fixed** |
| ~ | expert | A chosen credit pool that drains to zero stays chosen, and the panel still promises the review | open |
|  | expert | total / used credit figures are dropped for both the user and every group | open |
| ~ | expert | Buy credits replaces the create-scan tab instead of opening checkout beside it | open |
| ~ | expert | A resumed submit re-issues the expert-review request with no record that it already succeeded | open |
| ~ | draft | The persistence guard ignores four of the fields the draft persists, so they are lost on reload and a stale draft is left on disk | **fixed** |
|  | draft | The submitted screen never links to the study it just created, though it holds the id | **fixed** |
|  | draft | A draft with findings, a note and routing but no files cannot be discarded | **fixed** |
| ~ | findings | Item `condition` is parsed but never evaluated — dependent rows are always visible, always counted, always submittable | open |
| ~ | findings | planFindingTransfer overwrites answers when several source rows share one name+kind+options, and still reports all of them as carried | **fixed** |
|  | findings | Required findings no longer block submit; they are advisory only | open |
| ~ | findings | "Clear defaults" disappears as soon as one auto-filled row is edited, and the button re-applies defaults over the edit | open |
| ~ | findings | Scan-type switch plans against a snapshot: unloaded source definitions clear everything, and answers typed during the fetch are dropped | **fixed** |
| ~ | detail | No way to add files to an existing scan | open |
|  | detail | No way to remove a file from a scan | open |
|  | detail | Interrupted uploads can no longer be repaired from the detail page | open |
|  | detail | DICOM-derived scans lose access to the original study and its cine playback | open |
| ~ | detail | Video plays only the original rendition, with no quality choice and no loop | open |
|  | detail | Ultrasound stills can no longer be magnified | open |
|  | detail | External patient ID is read-only after submit | open |
|  | detail | The recipient of a shared scan can no longer reply on the thread | open |
| ~ | detail | Activity log hides severity and per-entry error messages | open |
|  | detail | Share panel accepts anything as an email address | open |
|  | list | "Reset for Re-upload" exists nowhere in the port, despite the code claiming it moved to the scan page | open |
| ~ | list | Request Expert Scan Review (and its payment-return alert) is absent from My Scans | open |
|  | list | AI Review Generator action missing from both expert queues | open |
|  | list | Learner filter lists every learner org-wide, never narrowed by the chosen groups | open |
|  | list | Delete is no longer offered on queue or reviewed rows, for any role | open |
|  | cross | Route guards ignore the server's full-access / admin:full-access wildcards, so a wildcard-only role is locked out of the whole app | open |
|  | cross | Owner can no longer delete an individual file from an unreviewed scan | open |
|  | cross | document.title is a constant — every tab, history entry and bookmark reads "ScanVault" | **fixed** |
|  | cross | /scans/group and /scans/expert always redirect to the unreviewed leaf, 403-ing roles that may only read the reviewed list | **fixed** |
|  | cross | A scan whose DB status lags behind its uploaded files shows "Pending" instead of "Submitted" | open |
|  | cross | A role or permission change does not take effect until a full page reload | open |
|  | cross | Password recovery has no route and no link — a locked-out user has nowhere to go | open |

### Cosmetic (6)

| | Area | Gap | Status |
| --- | --- | --- | --- |
| ~ | sharing | Default group routing changed from every group to leaf groups only | open |
|  | sharing | Receipt shows a rejected expert-review request as "Not requested" | **fixed** |
|  | detail | Back link can navigate somewhere other than the list it names | open |
|  | list | A legacy bookmark with limit=30 or 40 leaves the rows-per-page control blank | open |
|  | list | A scan whose DB status lags its uploads now reads "Pending" instead of "Submitted" | open |
|  | list | Clicking anywhere in a row no longer opens the scan | open |

`~` marks a claim the verifier only partly upheld; the row states what survived.

## Unresolved questions

1. Do required findings block submit, or stay advisory? The port diverges from the original here
   by design.
2. Is post-submit editing in scope — findings, patient id, adding and deleting files? The original
   allows all four from the detail page; the port is read-only after submit. This is one decision,
   not four.
3. Does ScanVault replace the dashboard's scan area or run beside it? It decides whether the
   missing reviewer tools (mark complete, edit a submitted review, AI Review Generator) are gaps
   or deliberate scope.
4. Which seven languages actually matter? Translating two large surfaces is only worth it for the
   locales that have users.
