---
phase: 14
title: "Transcript from Vimeo tracks"
status: pending
priority: P1
effort: "4 d"
dependencies: [4]
---

# Phase 14: Transcript from Vimeo tracks

## Overview

Turn the Transcript tab from a promise into a panel. 387 of the 465 distinct Vimeo videos the
course content embeds carry text tracks (all of them English), covering 735 of 887
`v2topicmedia` rows — 83%, re-measured 16 Sep on `gusi_prod_mirror` (894 docs, 735 with
`hasTextTracks: true`, 465 distinct `vimeoVideoId`).

The caption file cannot be fetched from the browser. `@vimeo/player`'s `getTextTracks()` answers
`{label, language, kind, mode}` with no URL, and the REST endpoint that does carry one
(`/videos/{id}/texttracks`) needs the account token and returns a **signed, expiring** link
(`vimeo-rest-client.ts:14-19, 147-153`). So: a server route proxies, parses and caches; the
browser sees cues and never a credential.

**Two deviations from the brainstorm sketch, both deliberate.**

1. *The route is nested under the course* — `/courses/:courseId/topics/:topicId/transcript`, not
   `/topics/:topicId/transcript`. Enrolment scoping is the whole point of putting this on the
   learners router, and the helper that does it takes a course id
   (`validateAndFetchCourseData`, `learners.validation.helper.ts:22`). A topic-only route would
   need a second topic→course resolution to reach the same check.
2. *VTT is parsed server-side, not in `apps/web/src/lib/`.* The route's contract is
   `cues[]`, and phase 15 serves generated cues down the same route from a different source. A
   web-side VTT parser would force phase 15 to re-serialise cues back into VTT to reuse the path.
   The web keeps a pure, unit-tested module for the part it genuinely owns — active-cue lookup
   and timestamp formatting.

This supersedes phase 6 of `plans/260914-1456-sector-course-experience-roadmap/`. What still
holds from it: the proxy architecture, the cache, the one-`Player` rule, the plain-text render.
What changed: coverage is 83%, not 59.8%, so the 70% gate is **met**; chapters are dropped (0
chapter markers across every readable video, measured 15 Sep); parsing moved to the server.

## Gate

| | |
| --- | --- |
| **Condition** | Caption coverage ≥ 70% of embedded videos. **Measured 83%** (387/465 videos, 735/887 topic rows). |
| **Decides** | Plan owner. Nobody external — the Contributor seat already reads these tracks. |
| **Action** | Record the coverage number and the date in the phase report before the first commit. If a re-measure before start drops below 70%, stop and hand the uncovered ids to the content team instead. |

The 78 videos outside that number are **not** this phase's problem: 43 are gone (404 both ways,
a content-team fix) and 35 are alive but unshared with the seat (phase 15's gate).

## Requirements

**Functional**

1. A video topic with a text track shows its transcript as timestamped cues.
2. The cue under the playhead highlights; clicking a cue seeks the player there.
3. Language: the caller's UI locale if a track exists for it, else English, else the first
   `captions` track. Prefer a human track over an `-x-autogen` one for the same language.
4. A video with no track shows "No transcript for this video" — not an error, not a spinner.
5. Against the staging API (10 Sep code, route absent) the tab keeps today's
   `courses.runner.tabs.transcriptPending` copy. No error toast, no empty panel.

**Non-functional**

6. The browser receives no Vimeo token, no signed link, and no unlisted-video hash.
7. A repeat request for the same `(videoId, language)` inside the TTL makes zero outbound Vimeo
   calls.
8. Exactly one `@vimeo/player` instance per mounted topic.
9. Every new string through `t()` in all seven locales; zero additions to
   `locale-completeness-baseline.json`.
10. `courseTranscriptSchema` and its members each get a fidelity decision.

## Architecture

```
web  transcript-panel.tsx ──useCourseTopicTranscript(courseId, topicId, lang)
       │                         │
       │  seekTo(sec)            │  GET /api/v2/learners/courses/:courseId
       │  currentTime            │      /topics/:topicId/transcript?lang=xx
       ▼                         ▼
  use-player-bridge.ts     API  learners.controller.getLearnersTopicTranscript
  (ONE Player, owned            ├─ authUser
   by topic-view.tsx)           ├─ validateAndFetchCourseData  → 404 if not enrolled
                                ├─ TopicMedia.findOne({ topic }) → vimeoVideoId (+ hash)
                                ├─ cache hit (videoId, language, expiresAt > now)? → cues
                                └─ miss:  GET /videos/<id>[:<hash>]/texttracks   [token]
                                          pick track (rule 3)
                                          GET <signed link>   [NO Authorization header,
                                                               host allow-listed]
                                          parse-vtt → cues → cache upsert
                                ▼
                 200 { videoId, language, source: 'vimeo', cues: [{start,end,text}] }
                 200 { videoId, language: null, source: null, cues: [] }   ← no track
                 404 { ... }                                              ← route/topic unknown
```

**Why 200-with-empty-cues and not 404 for a track-less video.** It is the one thing that makes
feature detection free: on staging the route does not exist, `noRouteMiddleware`
(`src/middlewares/noroute.middleware.ts:4-9`) answers a CORS-headed JSON 404 — `cors()` runs at
`server.ts:37`, before routes, and `noRouteMiddleware` after them — so the client can map 404 →
"not built yet" and 200-empty → "no transcript for this video" with a single request and no probe.
`shouldRetryApiError` already refuses to retry a 4xx (`react/retry.ts:12-15`).

**Cache holds parsed cues, not the signed link and not the VTT body.** The link is used inside
the request and discarded, so no TTL arithmetic against `link_expires_time` is needed; the TTL
(24 h, one constant) exists only so a re-captioned video refreshes.

## Related Code Files

**API side** (worktree `…/scratchpad/wt/api`, branch `feat/sector-topic-media`)

- Create: `src/database/v2/topic-transcript-cache/topic-transcript-cache.model.ts` —
  `{ vimeoVideoId, language, source, cues[], expiresAt }`, unique `(vimeoVideoId, language)`,
  TTL index on `expiresAt`. Follows `topic-media.model.ts:57-84` (no soft delete: it is a cache).
- Create: `src/database/v2/topic-transcript-cache/topic-transcript-cache.service.ts`
- Create: `src/lib/vimeo/parse-vtt.ts` — pure WebVTT → cues.
- Create: `src/app/lms/learners/helpers/learners.transcript.helper.ts` — track selection, signed
  link follow, cache read/write.
- Create: `tests/unit/lib/vimeo/parse-vtt.test.ts`,
  `tests/functional/learners/topic-transcript.test.ts`
- Modify: `src/lib/vimeo/vimeo-rest-client.ts:25-31,147-177` — `TextTrackSummary` gains
  `link` and `linkExpiresAt` (in memory only; the "deliberately not stored" comment stays true
  and gains the word *stored*). Verified safe: `fetchVimeoTextTracks` has **no** production
  caller today — only `tests/unit/lib/vimeo/vimeo-clients.test.ts` — so no persistence path
  can pick the new fields up by accident.
- Modify: `src/app/lms/learners/learners.route.ts` (after line 32),
  `learners.controller.ts`, `learners.schema.ts`, `README.md`

**api-client**

- Create: `packages/api-client/src/schemas/course-transcript.ts`,
  `src/endpoints/course-transcript.ts`, `src/react/use-course-transcript.ts`
- Modify: `src/query-keys.ts` (`courseTranscriptKeys`, beside `courseContentKeys:131-138`),
  `src/fidelity/manifest.ts` (`NOT_REPLAYED`, from `:592`), `src/index.ts` (append-only)

**web**

- Create: `apps/web/src/features/courses/runner/transcript-panel.tsx`
- Create: `apps/web/src/features/courses/runner/use-player-bridge.ts` — `{ seekTo, currentTime }`.
  **Shared artefact with phase 16**; whichever lands first creates it. 14 and 16 must not run in
  parallel.
- Create: `apps/web/src/lib/transcript-cues.ts` + `transcript-cues.test.ts` —
  `findActiveCueIndex(cues, seconds)`, `formatCueTimestamp(seconds)`.
- Modify: `apps/web/src/features/courses/runner/topic-view.tsx:131-183` — `TopicTabs` renders the
  panel; `TopicView` constructs the one `Player` and publishes the bridge.
- Modify: `apps/web/src/features/courses/runner/use-vimeo-watch-tracking.ts:30-70` — accept an
  injected `Player` instead of `new Player(iframe)` at `:35`. Keep the teardown comment (`:58-63`)
  verbatim.
- Modify: `apps/web/src/i18n/locales/{en,de,es,fil,fr,it,pt}.json`, `scripts/check/sweep-routes.json`

**Delete** — nothing.

## Tests Before

Written and green **before** any behaviour changes, so the refactor is provably shape-preserving:

- API `tests/functional/learners/track-video-position.test.ts` (**exists**) — run untouched; it is
  the regression net for the learners router.
- API: add to `tests/unit/lib/vimeo/vimeo-clients.test.ts` a case pinning today's
  `fetchVimeoTextTracks` output (`id`, `language`, `type`) so widening the type cannot change it.
- web `apps/web/src/features/courses/runner/*.test.ts` — add
  `topic-tabs-current-state.test.ts`: with no transcript query wired, the Transcript tab renders
  `courses.runner.tabs.transcriptPending` and Notes renders `notesPending`. This is the staging
  behaviour the phase must preserve; it stays green afterwards via the 404 path.

## Refactor

One structural change, landed on its own commit before the feature: **hoist the `Player`.**
`use-vimeo-watch-tracking.ts:35` constructs it today; after the hoist `TopicView` constructs it,
passes it in, and publishes `use-player-bridge.ts`. No new behaviour, no new request. The existing
watch-tracking tests and the cold-load sweep are the gate.

## Tests After

**Unit — API**

- `parse-vtt.test.ts`: two well-formed cues; cue settings (`align:start position:10%`) stripped;
  `<v Speaker>` / `<c.x>` stripped; a malformed timestamp skips one cue and keeps its neighbours;
  CRLF parses like LF; empty body → `[]`; no `WEBVTT` header → `[]`.
- Track selection: locale match wins; `en` beats `de` when locale is absent; `en` beats
  `en-x-autogen`; no track → `null`.

**Functional — API** (`topic-transcript.test.ts`)

- Cache miss calls Vimeo once and stores cues; a second call inside the TTL calls Vimeo **zero**
  times; an entry past `expiresAt` re-fetches.
- A caller not enrolled gets 404; a topic with no `v2topicmedia` row gets 200 with `cues: []`.
- The response body contains no `Authorization`, no signed URL, no `vimeoHash`.
- The signed-link fetch carries **no** `Authorization` header and refuses a link whose host is
  outside the Vimeo allow-list.

**Unit — web**

- `transcript-cues.test.ts`: `-1` before the first cue, after the last, and in a gap; the exact
  start boundary is inside, the exact end boundary outside; `formatCueTimestamp(0) === '0:00'`,
  `(3727) === '1:02:07'`.
- `transcript-panel.test.ts`: 404 → the `transcriptPending` string; 200 with `cues: []` → the
  `noTranscript` string; 200 with cues → a list; clicking a cue calls `seekTo` with its start.

**Fidelity**

`courseTranscriptSchema`, `courseTranscriptCueSchema` and `courseTranscriptSourceSchema` go to
`NOT_REPLAYED`: *"assembled per request from a Vimeo caption file and a server cache; no
collection holds a row of it. Route replay: GET
/api/v2/learners/courses/:courseId/topics/:topicId/transcript for a seeded video topic."*
Add the case to `routes.fidelity.test.ts`. `manifest.test.ts` fails the ordinary unit run if any
is left undecided.

**i18n** — new keys `courses.runner.transcript.{noTranscript,languageLabel,autoGeneratedNote}` in
all seven locales; `courses-namespace-parity.test.ts` green; no baseline addition.

## Implementation Steps

1. **Record the gate.** Write the coverage number (83%, 387/465, measured 16 Sep) and the decision
   into the phase report. One paragraph, before any code.
2. **API — cache model.** `topic-transcript-cache.model.ts`: `vimeoVideoId` (String, required),
   `language` (String, nullable), `source` (`'vimeo' | 'generated'`), `cues` (array of
   `{ start: Number, end: Number, text: String }`), `expiresAt` (Date). Unique index
   `{ vimeoVideoId: 1, language: 1 }`; TTL index `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`.
   `transformIdPlugin` only.
3. **API — `parse-vtt.ts`.** Split on blank lines; a cue is an optional id line, a
   `hh:mm:ss.mmm --> hh:mm:ss.mmm` line (cue settings after the end timestamp discarded), then
   text lines. Strip `<...>` tags, collapse whitespace, skip a cue that fails rather than throwing.
   Under 80 lines, no dependency.
4. **API — widen the REST client.** `TextTrackSummary` gains `link: string | null` and
   `linkExpiresAt: string | null`, read from the same track objects at `vimeo-rest-client.ts:170`.
   Add `fetchTextTrackBody(link, options)`: plain `fetch`, **no Authorization header**, 10 s
   timeout, and a host check — reject unless the hostname ends in `.vimeo.com` or `.vimeocdn.com`.
   Vimeo's JSON drives this outbound call, so the allow-list is the SSRF control.
5. **API — transcript helper.** `resolveTopicTranscript(topicId, requestedLang)`:
   `TopicMedia.findOne({ topic })` → no row or no `vimeoVideoId` → `{ cues: [] }`. Cache lookup by
   `(vimeoVideoId, language)`; on miss, token → `fetchVimeoTextTracks(videoId, hash, token)` →
   select (step 6) → `fetchTextTrackBody` → `parseVtt` → upsert with
   `expiresAt = now + 24 h` → return. Any Vimeo failure returns `{ cues: [] }` and logs the kind
   — never a 500, because a third-party outage must not break the topic page.
6. **API — track selection.** Order: exact `requestedLang`; `requestedLang` prefix match
   (`es` matches `es-ES`); `en`; first `type === 'captions'`; first track. Within a language,
   prefer the id whose language has no `-x-autogen` suffix.
7. **API — route + schema.** `learners.schema.ts`: params `{ courseId, topicId }` via
   `objectIdSchema`, query `{ lang: z.string().max(12).optional() }`. Controller
   `getLearnersTopicTranscript`: `parseRequest`, `req.user.id`, `validateAndFetchCourseData`, then
   the helper. Route line under `learners.route.ts:32`, `authUser`. Update
   `src/app/lms/learners/README.md`.
8. **api-client — schema.** `course-transcript.ts`: `courseTranscriptCueSchema`
   (`{ start: number, end: number, text: string }`), `courseTranscriptSourceSchema`
   (`z.enum(['vimeo','generated']).nullable()`), `courseTranscriptSchema`
   (`{ videoId: string | null, language: string | null, source, cues }`). Export types.
9. **api-client — endpoint + hook + keys.** `getCourseTopicTranscript(client, courseId, topicId,
   lang?, signal?)`. `courseTranscriptKeys.topic(courseId, topicId, language)`.
   `useCourseTopicTranscript(courseId, topicId, lang, enabled)` — `enabled` is the caller's
   "this topic has a video" flag. Append exports to `index.ts`.
10. **api-client — fidelity.** Add the three `NOT_REPLAYED` entries and the route-replay case.
11. **web — hoist the Player** (the refactor commit from above). `TopicView` creates it from the
    iframe inside `contentRef`, passes it to `useVimeoWatchTracking`, and publishes
    `use-player-bridge.ts` with `seekTo(seconds)` and a `currentTime` subscription fed by the
    existing `timeupdate` handler.
12. **web — `transcript-cues.ts`.** `findActiveCueIndex` by binary search; `formatCueTimestamp`.
    Pure, no React.
13. **web — `transcript-panel.tsx`.** States, in order: query pending → `Skeleton`; ApiError with
    `statusCode === 404` → `t('courses.runner.tabs.transcriptPending')`; `cues.length === 0` →
    `t('courses.runner.transcript.noTranscript')`; otherwise the cue list. Each cue is a
    `<button>` rendering `{cue.text}` as a React child — never `dangerouslySetInnerHTML`, never
    `RichText`. Active cue scrolls into view with `block: 'nearest'` **only** if the learner has
    not scrolled the panel in the last 4 s.
14. **web — tabs.** `TopicTabs` takes `courseId`, `topicId` and `hasVideo`. Transcript and Notes
    tabs render only when `hasVideo`; a lesson or quiz keeps Overview alone. Notes keeps its
    `notesPending` copy until phase 16.
15. **web — i18n.** Add the three keys to all seven locale files in the same commit.
16. **Sweep.** Add `?tab=transcript` on an existing seeded topic to `sweep-routes.json` with
    `needs` set to the **topic title**, not transcript text — a sweep assertion that depends on
    third-party caption content is a flaky test.

## Regression Gate

```bash
# scanvault (web + api-client)
cd /Users/lap16299/Documents/code/gusi-lms/scanvault
pnpm --filter @sector/api-client test
pnpm --filter @sector/web test
pnpm lint && pnpm typecheck && pnpm build
SECTOR_MIRROR_JWT_SECRET=<secret> pnpm fidelity      # :5002 must be up, or route replay proves nothing
node scripts/check/cold-load-sweep.mjs <jwt-secret> scripts/check

# API worktree — vitest must not run test files in parallel against one Mongo
cd /private/tmp/claude-501/-Users-lap16299-Documents-code-gusi-lms/\
ec189ad1-d628-4150-9456-6330d395431a/scratchpad/wt/api
pnpm typecheck && pnpm lint
pnpm test:functional --no-file-parallelism tests/unit/lib/vimeo tests/functional/learners
```

## Success Criteria

- [ ] The gate decision (83%, 16 Sep) is written in the phase report before the first commit
- [ ] A captioned topic renders cues; the active cue highlights during playback; clicking a cue at
      08:12 seeks there and playback continues
- [ ] A topic whose video has no track renders "No transcript for this video"
- [ ] **Hides itself against the staging API**: pointed at staging, the Transcript tab shows
      today's `transcriptPending` copy, the console is clean, and no toast fires
- [ ] A second request for the same video+language inside the TTL makes zero outbound Vimeo calls
      (asserted in `topic-transcript.test.ts`, visible in the API log on the manual pass)
- [ ] The response body and the browser network tab contain no token, no signed URL and no
      `vimeoHash`
- [ ] Exactly one `@vimeo/player` instance per mounted topic (DevTools count on the manual pass)
- [ ] `manifest.test.ts` green with an explicit decision for all three new schemas
- [ ] **Mobile gate**: `/learn/courses/:courseId/:topicId` and `?tab=transcript` show no horizontal
      document scroll at 390px; the panel scrolls within itself, not the page
- [ ] Seven locales carry the new keys; `locale-completeness-baseline.json` unchanged

## Risk Assessment

| Risk | L | I | Mitigation |
| --- | --- | --- | --- |
| Signed-link fetch leaks the bearer token to a non-Vimeo host | Low | **Critical** | `fetchTextTrackBody` sends no `Authorization` and rejects any host outside `*.vimeo.com` / `*.vimeocdn.com`; a test asserts both |
| Vimeo rate-limits the transcript fetches | Med | Med | Cache keyed `(videoId, language)`: a popular video is fetched once per 24 h, not once per learner |
| Vimeo outage breaks the topic page | Med | High | The helper degrades to `{ cues: [] }` and logs; never a 500 |
| Two `Player` instances on one iframe | High if step 11 is skipped | High | `TopicView` is the only constructor; DevTools count is a success criterion |
| Phase 4 and this phase both edit `topic-view.tsx` | High | Med | Strict order: 4 merges first. Same rule for phase 16 and `use-player-bridge.ts` |
| Server-side parsing diverges from the roadmap's web-side plan | Certain | Low | Documented in the Overview with the reason; phase 15 depends on it |
| A re-captioned video serves stale cues for up to 24 h | Med | Low | Accepted; the TTL is one constant to lower |
| Auto-scroll fights a learner reading ahead | High if naive | Med | 4 s suppression window after any manual scroll |

## Security & Privacy Considerations

- **The token gains a second job.** It was used by an offline backfill; it now sits in a
  learner-facing request path. It still never leaves the server, and it is read only through
  `secrets.get('VIMEO_ACCESS_TOKEN')` (`vimeo-rest-client.ts:50-60`) — never logged, never echoed.
  The existing client already refuses to include a fetch error's message for exactly this reason
  (`:96-100`); keep that discipline in the new function.
- **The unlisted-video hash is a capability**, not an identifier (`topic-media.model.ts:25-33`).
  Used server-side to build the REST path; never in a response body, a log line or an error.
- **The route is enrolment-scoped, not merely authenticated.** Without
  `validateAndFetchCourseData` it would be a way to read caption text for any course by topic id.
  A non-enrolled caller gets the same 404 the outline gives them — 403 would confirm the topic
  exists.
- **Cue text is third-party content rendered as text.** Plain React children only. The VTT parser
  strips `<v>` / `<c>` tags; anything unexpected stays literal.
- **SSRF.** Vimeo's JSON supplies the URL of the second fetch. The host allow-list in step 4 is
  the control; without it a compromised or malformed response points our server anywhere.
- **No `userId` parameter.** The learners router is `authUser`-scoped throughout
  (`learners.route.ts:10-32`) and must not gain its first exception.
- The iframe sandbox is unchanged. This phase adds SDK calls over the existing postMessage bridge
  and must not relax `sandbox` or widen `ALLOWED_EMBED_HOSTS`.
