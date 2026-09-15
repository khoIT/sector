---
phase: 6
title: "Transcript plus notes and chapters"
status: pending
priority: P2
effort: "9 days"
dependencies: [1, 5]
---

# Phase 6: Transcript plus notes and chapters

## Overview

<!-- Red team 2026-09-14: F3 — delta: the transcript is re-architected. The Player SDK's
     getTextTracks() returns NO caption URL, so the browser cannot fetch a VTT at all; the
     only source is the authenticated REST endpoint, whose link is signed and expiring. The
     transcript therefore needs a server-side proxy + cache route — the design this phase
     previously rejected. Notes gets its own go/no-go instead of inheriting the transcript's
     gate. Effort 7d → 9d. -->

Three things that make the Phase 5 shell worth having: an interactive transcript, notes
timestamped to the video, and chapter markers. All three exist on Vimeo already — the
questions are how many videos carry them, and what each costs.

**The transcript is more expensive than assumed.** <!-- Red team 2026-09-14: F3 -->
An earlier draft had the browser call `player.getTextTracks()` and `fetch(track.link)`. The
Vimeo Player SDK's documented track object is `{ label, language, kind, mode }` — **there is
no `link`**, and no way to get a caption file URL out of the embed. The only source is the
REST endpoint `GET /videos/{id}/texttracks`, whose `link` is **signed and expiring**
(`link_expires_time`) and requires the account token Phase 1 keeps server-side. So the
design this phase previously rejected — proxy it on the server — is the only one that works,
and it brings a route, a cache with expiry handling, a schema, a fidelity decision and a
CORS story with it.

**Two gates, not one.**

> **Transcript gate.** Ship the Transcript tab only if **≥70% of the embedded videos have at
> least one text track**, measured over the 464 distinct ids Phase 1 resolves
> (`reports/vimeo-caption-coverage-<date>.md`). Below that: no Transcript tab, and the
> uncovered video ids go to the content team as a captions backlog.
>
> **This threshold is an open question, defaulting to 70%**, and it is now re-decided on
> **two** inputs, not one: the measured coverage *and* the corrected cost above. 70% was
> chosen because below it the tab is absent more often than present, which teaches learners
> it does not exist. With a proxy route in the price, a marginal coverage number argues more
> strongly for deferral than it did. Take the decision before the phase starts.
> <!-- Red team 2026-09-14: F3 -->

> **Notes gate.** Notes is **not** a fallback for a failed transcript gate, and does not
> inherit its decision. <!-- Red team 2026-09-14: F3 (scope F11) -->
> plan.md's evidence is early drop-off and missing reminders; nothing in it measures note
> usage or comprehension, and Notes is the only item in the roadmap that creates a **new
> user-content store** with clinical/PII implications, a soft-delete lifecycle, four routes
> and a seed + replay path. Ship it only if the plan owner answers: *what observable would
> tell us this was worth building?* If the answer is "nothing we will measure", defer it and
> ship Transcript (if gated in) + Chapters. A failed transcript gate must not silently
> promote a notes CRUD to headline feature of Release 2.

Chapters are ungated and cheap (~0.5 day, no API): the rail renders when the video has
chapters and is absent otherwise, exactly as durations behave in Phase 3.

**Verified starting point.** `@vimeo/player ^2.30.4` is already a dependency
(`apps/web/package.json:18`) and already drives `use-vimeo-watch-tracking.ts` — `new Player(iframe)`,
`.on/.off/.destroy` (`:31-42`). Phase 2 added `timeupdate`, `pause`, `seeked`. This phase adds
`getCurrentTime()`, `setCurrentTime()` and `getChapters()` — same SDK object, no new
dependency. The sanitiser already forces
`sandbox="allow-scripts allow-same-origin allow-presentation"` on every `player.vimeo.com`
iframe (`sanitize-rich-text.ts:45-47`), which is what the postMessage bridge needs.

## Requirements

**Functional**

1. **Transcript tab** (gated): the video's text track as timestamped cues, each clickable to
   seek; the cue under the playhead highlights as it plays.
2. Transcript VTT is fetched **through the GUSI API**, which holds the token, follows the
   signed link and caches the body. The browser never sees a Vimeo credential or a signed URL.
3. **Notes tab** (separately gated): a learner's own notes on a topic, each capturing the
   playhead, clickable to seek. Create, edit, delete.
4. **Chapters** (ungated, per video): a rail under the player; clicking one seeks.
5. When a video has no text track, the Transcript tab is **absent**, not present-and-empty.
6. If a gate is not met, that feature's code is **not merged half-built**.

**Non-functional**

7. The API caches VTT bodies with a TTL **strictly under** the Vimeo link's
   `link_expires_time`, keyed on `(vimeoVideoId, trackId)`. A cache miss re-asks Vimeo; a
   stale signed link is never replayed.
8. Transcript text is not stored as GUSI content — only cached — so it cannot go stale
   against a re-captioned video beyond the TTL.
9. A note write is one request. No autosave-per-keystroke.
10. Every new string through `t()` in all seven locales; no addition to
    `locale-completeness-baseline.json` (432 keys).
11. Parse-not-cast: the transcript response and the notes schemas each get Zod and a fidelity
    decision.

## Architecture

```
GATE A ─► reports/vimeo-caption-coverage-<date>.md (Phase 1) + the cost correction above
GATE B ─► plan owner's answer on Notes

TRANSCRIPT  (server-side — the browser has no path to a VTT)
  apps/web  transcript-panel.tsx
      │  GET /api/v2/learners/courses/:courseId/topics/:topicId/transcript?lang=
      ▼
  API  learners.transcript.controller
      ├─ enrolment check (validateAndFetchCourseData, learners.validation.helper.ts:22)
      ├─ v2topicmedia → vimeoVideoId (+ hash for the 272 unlisted)
      ├─ cache hit?  (vimeoVideoId, trackId) → cached VTT body, TTL < link_expires_time
      └─ miss: GET https://api.vimeo.com/videos/<id>[:<hash>]/texttracks   ← Phase 1 token
               pick track by lang → GET track.link (signed) → store body + expiry
      ▼
  cues parsed CLIENT-side from the proxied body (parse-vtt.ts, pure)

CHAPTERS                                   NOTES  (gate B)
  @vimeo/player getChapters()                GUSI API, coursetopicnotes
  browser-only, no API                       4 routes under /v2/learners
      │                                            │
      └──────────────┬─────────────────────────────┘
                     ▼
   TopicView owns the ONE Player and publishes usePlayerBridge()
        seekTo(seconds) · currentTime
   (NOT player-frame.tsx — Phase 5 cut that; see Phase 5's F8 note)
```

**Who owns what**

| Side | Owns |
| --- | --- |
| **web** | VTT parsing, cue highlighting, the chapter rail, the notes UI, all seeking. |
| **api-client** | The transcript response schema and the notes schemas/endpoints/hooks, plus their fidelity decisions. |
| **API** | **The transcript proxy and its cache**, and the notes collection + four routes. |

**Why the proxy, restated for the next reader.** The token cannot go to the browser; the
signed `link` expires and must not be handed out or stored long; and the VTT host's CORS
policy is Vimeo's business, not something GUSI can assume. One authenticated route removes
all three problems and gives a natural cache point. Note the scope change this forces on
Phase 1: there, the token is read once by an offline backfill; here it sits in a
learner-facing request path. Phase 1's security section records that second role.

**Why notes are a new collection.** `usercourseprogresses.items[].metadata` is `Mixed`
(`user-course-progress.model.ts:153-157`) and already carries an unbounded `lastAccessedDates`
array pushed on every track call (`learners.process.topic.ts:219`). Free text inside a
document a transaction re-saves in full is both write amplification and a data-loss risk.

**The seek seam.** Three features need "move the player to N seconds", and there is one
`Player` — owned by `TopicView` (Phase 5 cut the hoist). `TopicView` publishes
`usePlayerBridge()` with `seekTo` and a current-time subscription. No feature constructs its
own `Player`.

## Related Code Files

**Create**

- API repo: `src/app/lms/learners/helpers/learners.transcript.helper.ts` — track selection,
  signed-link follow, cache read/write. <!-- Red team 2026-09-14: F3 -->
- API repo: `src/database/v2/topic-transcript-cache/topic-transcript-cache.model.ts` —
  `{ vimeoVideoId, trackId, language, body, expiresAt }`, TTL index on `expiresAt`.
- API repo: `src/database/course-topic-note/course-topic-note.model.ts`,
  `course-topic-note.service.ts` (gate B)
- API repo: `tests/functional/learners/topic-transcript.test.ts`
- API repo: `tests/functional/learners/topic-notes.test.ts` (gate B)
- `apps/web/src/features/courses/transcript/parse-vtt.ts` + `.test.ts`
- `apps/web/src/features/courses/transcript/active-cue.ts` + `.test.ts`
- `apps/web/src/features/courses/transcript/transcript-panel.tsx`
- `apps/web/src/features/courses/chapters/chapter-rail.tsx`,
  `use-vimeo-chapters.ts`
- `apps/web/src/features/courses/runner/use-player-bridge.ts` — the `seekTo` /
  current-time context published by `TopicView`. <!-- Red team 2026-09-14: F3 / Phase 5 F8 -->
- `apps/web/src/features/courses/notes/{notes-panel,note-row}.tsx`,
  `note-model.ts` + `.test.ts` (gate B)
- `packages/api-client/src/schemas/course-transcript.ts`,
  `endpoints/course-transcript.ts`, `react/use-course-transcript.ts`
- `packages/api-client/src/schemas/course-topic-note.ts`,
  `endpoints/course-topic-note.ts`, `react/use-course-topic-notes.ts` (gate B)

**Modify**

- API repo: `src/app/lms/learners/learners.route.ts` — the transcript route, and four notes
  routes (gate B).
- API repo: `src/app/lms/learners/{learners.controller.ts,learners.schema.ts,README.md}`
- API repo: `src/lib/vimeo/vimeo-rest-client.ts` (Phase 1) — reused for `texttracks`.
- `apps/web/src/features/courses/shell/item-tabs.ts` (Phase 5) — conditional tabs.
- `apps/web/src/features/courses/runner/topic-view.tsx` — publishes the player bridge and
  renders the active tab's panel.
- `apps/web/src/features/courses/runner/use-vimeo-watch-tracking.ts` — accepts the `Player`
  instance from `TopicView` rather than constructing its own (`:31`), so there is exactly one.
  Keep the teardown discipline and its comment (`:37-42`) verbatim.
- `packages/api-client/src/query-keys.ts` — `courseTranscriptKeys`, and `courseNoteKeys`
  (gate B), beside `courseContentKeys` (`:121-127`).
- `packages/api-client/src/fidelity/manifest.ts`, `src/index.ts` (append-only)
- `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`,
  `courses-namespace-parity.test.ts`
- `scripts/check/sweep-routes.json`

**Delete** — nothing.

## Implementation Steps

1. **Read both gates before writing code.** Open the Phase 1 coverage report. If coverage
   < 70%, cut steps 2–7 and file the uncovered ids as a content-team backlog. Get the plan
   owner's Notes answer. Re-scope the phase from the two answers, and record both decisions
   in the phase report. Do not build a gated feature "for later".
2. **Transcript cache model.** `{ vimeoVideoId, trackId, language, body, expiresAt }`,
   unique on `(vimeoVideoId, trackId)`, TTL index on `expiresAt`. The TTL comes from Vimeo's
   `link_expires_time` **minus a safety margin**, so a cached entry never outlives the link
   it was fetched with.
3. **Transcript route.** `GET /api/v2/learners/courses/:courseId/topics/:topicId/transcript?lang=`,
   `authUser`, enrolment-checked via `validateAndFetchCourseData`
   (`learners.validation.helper.ts:22`) so a non-enrolled caller gets the same 404 the outline
   gives them. Resolve `v2topicmedia` → `vimeoVideoId` (+ hash). On a cache miss, call
   `GET /videos/<id>[:<hash>]/texttracks`, choose the track (step 4), `GET track.link`, store
   and return. Respond `{ language, cues: null, body: <vtt string> }` — the server returns the
   VTT text; the client parses it, so the parser stays pure and unit-testable in the web repo.
4. **Track selection.** Prefer the caller's i18n language, else `en`, else the first
   `type: 'captions'`, else the first track. Return the chosen `language` so the UI can label
   it. No track → **404 with a distinguishable body**, which the client turns into "no
   Transcript tab", not an error toast.
5. **`parse-vtt.ts`.** WebVTT is small: a `WEBVTT` header, blank-line-separated cues, each
   `hh:mm:ss.mmm --> hh:mm:ss.mmm` then text lines. Parse to
   `{ startSeconds, endSeconds, text }[]`. Strip cue settings after the end timestamp
   (`align:start position:10%`), strip inline tags (`<v Speaker>`, `<c.x>`), collapse
   whitespace. A malformed cue is skipped, not fatal. No dependency — under 80 lines.
6. **`active-cue.ts`.** `findActiveCueIndex(cues, seconds)` — binary search; `-1` before the
   first cue, after the last, and in gaps. Cheap enough to run on every `timeupdate`.
7. **Transcript panel.** No virtualisation — a 45-minute lecture is a few hundred cues.
   Scroll the active cue into view with `block: 'nearest'` **only when the learner has not
   scrolled in the last few seconds**; auto-scrolling under someone reading ahead is how this
   feature becomes hated. Clicking a cue calls `seekTo(cue.startSeconds)`.
8. **Chapters.** `await player.getChapters()` → `[{ startTime, title, index }]`. Render the
   rail only when non-empty. Cross-check against Phase 1's `chapterCount` for reporting, but
   **trust the live SDK answer** for rendering — the backfill is a snapshot, the video is the
   truth.
9. **One Player, published.** Move `new Player(iframe)` out of
   `use-vimeo-watch-tracking.ts:31` into `TopicView`, and pass the instance into the hook.
   `TopicView` publishes `usePlayerBridge()`. `TopicView` becomes the only place in the app
   that constructs a `Player`.
10. **Notes** (gate B). Model:
    `{ user, course, topic, positionSeconds, body, timestamps }`, indexes
    `{ user, course, topic }` and `{ user, topic, createdAt: -1 }`, with `transformIdPlugin`
    **and** `softDeletePlugin` — a deleted note is a user action worth being able to reverse.
    Four routes under the learners router, every one deriving the user from `req.user.id`,
    with ownership **in the selector**: `{ _id: noteId, user: req.user.id }` on `PUT` and
    `DELETE`. Payload `body: z.string().trim().min(1).max(4000)`.
11. **Notes panel** (gate B). A `Textarea` (`packages/ui/src/components/textarea.tsx`), an
    "Add note at mm:ss" button reading `player.getCurrentTime()` at click time, and a list
    ordered by `positionSeconds` with position-less notes last. Editing keeps the original
    position — a note is about a moment, and fixing a typo does not move it.
12. **Tabs.** `tabsForItem(item, { hasTranscript })` →
    `['overview', ...(hasTranscript ? ['transcript'] : []), ...(notesShipped ? ['notes'] : [])]`
    for a video topic; `['overview']` for a lesson and a quiz. Phase 5's `activeTab` fallback
    already handles `?tab=transcript` on a track-less video and `item-tabs.test.ts` pins it.

## Tests / validation

**Unit**

- `parse-vtt.test.ts` (gate A) — a well-formed two-cue file; cue settings stripped;
  `<v Speaker>` / `<c.x>` stripped; a malformed timestamp skips one cue and keeps its
  neighbours; empty body → `[]`; CRLF parses like LF; no `WEBVTT` header → `[]` rather than a
  guess.
- `active-cue.test.ts` (gate A) — `-1` before the first and after the last; exact start
  boundary inside; exact end boundary outside; a gap is `-1`.
- `note-model.test.ts` (gate B) — `formatNoteTimestamp(0)` is `'0:00'`, `(3727)` is
  `'1:02:07'`, `(null)` is `null`; position-less notes sort last; whitespace-only body
  rejected before any request.
- `item-tabs.test.ts` (**exists**, Phase 5) — extended: a video topic with a transcript has
  three tabs; without, two; a lesson one; a quiz one; `?tab=transcript` on a track-less topic
  falls back to Overview.
- API `topic-transcript.test.ts` (gate A) — a cache miss calls Vimeo once and stores the body;
  a second request inside the TTL calls Vimeo **zero** times; an entry past `expiresAt` is
  re-fetched; a video with no tracks returns the distinguishable 404; a caller not enrolled in
  the course gets 404; the response body never contains a Vimeo signed URL or the token.
- API `topic-notes.test.ts` (gate B) — create/list/edit/delete round-trip; a note on a course
  the caller is not enrolled in is 404; learner B gets **404** (not 403) on learner A's note
  by id, via the selector; a 4,001-character body is 400; whitespace-only is 400; delete sets
  `deletedAt` and the note leaves the list.
- i18n gates green across all seven locales, no baseline addition.

**Fidelity**

- `courseTranscriptSchema` is assembled per request from a third-party body and a cache — it
  belongs in `NOT_REPLAYED` with
  `'proxied from Vimeo per request and cached; route replay: GET /api/v2/learners/courses/:courseId/topics/:topicId/transcript for a seeded video topic'`,
  plus a case in `routes.fidelity.test.ts`. <!-- Red team 2026-09-14: F3 -->
- `courseTopicNoteSchema` (gate B) gets a real `REPLAY_ENTRIES` entry against
  `coursetopicnotes` once the seed writes one — a plain stored document with a
  `transformIdPlugin` toJSON, so `project: raw` suffices, as for `sharedscans`
  (`manifest.ts:156-161`). Create/update payloads go to `NOT_REPLAYED` as request bodies.
- **Chapters get no entry, and that is the decision** — they never cross GUSI's API. Record it
  as a comment in `use-vimeo-chapters.ts` so the next reader does not look for one.
- `manifest.test.ts` fails the ordinary unit run if any of these is left undecided. Run
  `pnpm fidelity` with `SECTOR_MIRROR_JWT_SECRET` set and `:5002` up; a skipped route replay
  (`routes.fidelity.test.ts:65-70`) proves nothing.

**Browser** — `node scripts/check/cold-load-sweep.mjs <jwt-secret> <fixture-dir>`:

```json
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b/681a4e2c82414b2fcc5af816?tab=notes",
  "role": "learner", "needs": "note" }
{ "path": "/learn/courses/681a4b63779a0d9e6c9cc55b/681a4e2c82414b2fcc5af816?tab=transcript",
  "role": "learner", "needs": "Physics and Probes" }
```

The second row's `needs` is deliberately the **topic title**, not transcript text: whether a
transcript renders depends on that video's tracks, and a sweep assertion that depends on
third-party content is a flaky test. It proves the deep link does not blow up; the manual pass
proves the transcript.

Manual pass:

1. Open a captioned video topic. Transcript tab present, cues render, the active cue follows
   playback.
2. Click a cue at 08:12 — the player seeks there and keeps playing.
3. Scroll the transcript up while playing — auto-scroll does not yank the view back.
4. Open a video **without** captions — the Transcript tab is absent, not empty.
5. **Second load of the same transcript issues no outbound Vimeo call** (check the API log) —
   the cache is doing its job.
6. Notes (gate B): add at 02:30, reload, confirm persistence and the timestamp; click it to
   seek; edit and confirm the position is unchanged; delete.
7. A video with chapters shows the rail and seeks; one without shows no rail and no gap.
8. Console clean; **exactly one** `@vimeo/player` instance per mounted topic (DevTools).

## Success Criteria

- [ ] Both gate decisions are recorded in writing — coverage number, cost correction, and the
      Notes go/no-go — before any gated code merges
- [ ] **If transcript gated in:** clicking a cue seeks; the active cue highlights; a
      track-less video shows no Transcript tab; the browser receives **no** Vimeo token and
      **no** signed URL
- [ ] A repeat transcript request inside the TTL makes zero outbound Vimeo calls
- [ ] A cached entry never outlives the signed link it was fetched with
- [ ] **If transcript gated out:** no transcript code is merged and the uncovered ids are
      handed over as a list
- [ ] **If Notes gated out:** no notes code is merged, and the phase does not silently become
      a notes CRUD
- [ ] **If Notes gated in:** a note survives reload with its `mm:ss`; learner B gets 404 on
      learner A's note
- [ ] A video with chapters shows the rail; one without shows no rail and no empty space
- [ ] Exactly one `@vimeo/player` instance per mounted topic
- [ ] `manifest.test.ts` green with an explicit decision for every new schema
- [ ] Cold-load sweep 100% healthy

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Transcript discovered mid-sprint to need a server route | **Was certain** | **Critical** — invalidated the estimate and the ownership table | Re-architected up front; effort re-costed 7d → 9d |
| Caption coverage below the gate | Unknown until Phase 1 | High for this phase | Gate stated with a default, a fallback and a second input (cost) |
| Signed link cached past expiry | Medium | Medium | TTL derived from `link_expires_time` minus a margin; a test asserts re-fetch after expiry |
| Vimeo rate limits on transcript fetches | Medium | Medium | Cache keyed `(videoId, trackId)`; a popular video is fetched once per TTL, not once per learner |
| Two `Player` instances on one iframe | High if step 9 is skipped | High | `TopicView` is the only constructor; manual step 8 counts them |
| VTT parser meets an unexpected shape | Medium | Low | Per-cue skip; seven parser tests including CRLF and a missing header |
| Auto-scroll fights a reading learner | High if naive | Medium | Suppression window; manual step 3 |
| Notes ships without a reason | Medium | Medium | Its own go/no-go, answered by the plan owner, not inherited from the transcript gate |
| Phase 5's shell context changes under this phase | Low | Medium | This phase depends on Phase 5; `topic-view.tsx` and `use-player-bridge.ts` are edited here and nowhere else |

## Security Considerations

- **The token gains a second job.** Phase 1 uses it in a scheduled backfill; this phase puts it
  in a learner-facing request path. It still never leaves the server: the browser calls a GUSI
  route and receives VTT text, never a Vimeo credential and never a signed URL. Phase 1's
  security section carries the matching note, so the two phases describe one token with two
  call sites.
  <!-- Red team 2026-09-14: F3 -->
- The transcript route is enrolment-checked, not merely `authUser` — otherwise it is a way to
  read caption text for any course by topic id. Reuse `validateAndFetchCourseData`.
- The cached VTT is third-party content rendered as **text**, not HTML. Render cues as plain
  React children; never `dangerouslySetInnerHTML`. Strip `<v>`/`<c>` tags in the parser and
  treat anything unexpected as literal text.
- The unlisted-video hash from Phase 1 is a capability. It is used server-side to build the
  REST URL and must never appear in a response body or a log line.
- **Notes are user-generated text and are rendered.** Render as `{note.body}` in a React
  element — never through `RichText`. That sanitiser exists for authored WordPress content;
  routing learner input through it applies a policy built for a different threat model. React's
  own escaping is the right control.
- Notes ownership lives in the selector (`{ _id: noteId, user: req.user.id }`), not in an `if`
  after a fetch, so there is no window where the wrong note is loaded. A miss is 404, not 403 —
  403 confirms the note exists.
- No `userId` parameter on any route here. The learners router is `authUser`-scoped throughout
  (`learners.route.ts:9-21`) and must not gain its first exception; Phase 4 is busy removing
  exactly that pattern from `group-assignment.controller.ts`.
- Notes are private to their author: no leader surface, no export, no admin view, and Phase 8
  must not add them. A note on a POCUS topic can carry clinical or patient-adjacent detail.
- The iframe sandbox is unchanged. This phase adds SDK calls over the existing postMessage
  bridge and must not relax `sandbox` or widen `ALLOWED_EMBED_HOSTS`.
