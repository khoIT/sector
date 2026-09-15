---
phase: 1
title: "Vimeo access and media backfill"
status: completed
priority: P1
effort: "5 days"
dependencies: []
---

# Phase 1: Vimeo access and media backfill

## Overview

<!-- Red team 2026-09-14: F14 — delta: durations and thumbnails come from PUBLIC oEmbed and
     need no token, so this phase no longer blocks on one; the token is now needed only for
     Phase 6's text tracks. Counts corrected to the `deletedAt: null` set (868/464). A
     deploy mechanism for staging/production is now specified. Effort 4d → 5d. -->

Every duration, thumbnail, caption and chapter this roadmap wants already exists — on
Vimeo, not in GUSI. This phase pulls that metadata for the videos the courses embed and
stores it where the outline can read it. It surfaces nothing: Phase 3 renders the
durations, Phase 6 renders the transcripts.

**The token is not the blocker it was assumed to be.** <!-- Red team 2026-09-14: F14a -->
Vimeo's **public oEmbed** endpoint returns `duration` and `thumbnail_url` with no
authentication — confirmed against `https://vimeo.com/api/oembed.json?url=…` for all 35
topics of course `681a4b5d779a0d9e6c9cc538` on 14 Sep 2026. Only **text tracks** require
the authenticated REST API. So this phase splits:

| Data | Source | Auth | Unblocks |
| --- | --- | --- | --- |
| duration, thumbnail | `vimeo.com/api/oembed.json` | **none** | Phases 2, 3, 5, 7 |
| text tracks, chapters | `api.vimeo.com/videos/{id}/…` | token | Phase 6 only |

Build the oEmbed pass first. Phases 2, 3, 5 and 7 stop waiting on a credential nobody has
issued yet. The token pass is a second, smaller step whose only consumer is Phase 6's gate.

Its other deliverable is still a **number**: how many videos carry text tracks. Phase 6's
transcript tab is gated on it, and Phase 6's cost has since been corrected upward
(see Phase 6), so the gate is re-decided once both are known.

**Verified against the mirror (`gusi_prod_mirror`, 14 Sep 2026), on the `deletedAt: null`
set the backfill actually queries:** <!-- Red team 2026-09-14: F14d -->

| | |
| --- | --- |
| Topics, non-deleted | 1,472 |
| Topics embedding `player.vimeo.com/video/<id>` | **868** |
| Distinct Vimeo video ids | **464** |
| …of which carry `?h=<hash>` (unlisted) | 272 topics / 170 ids |
| Topics embedding bare `vimeo.com/<id>` (WP core embed) | 19 docs / 11 ids, 1 id not also a player embed |
| Topics embedding **YouTube** | 7 docs / 2 ids — will never get a duration |
| Topics with more than one embed | **0** |
| `v2topics` documents carrying any duration field | **0** |
| `v2lessons.imageUrl` non-empty | 357 of 626 (S3 keys like `images/lms/3771_AAA.png`, presigned by the API) |
| `v2courses.imageUrl` non-empty | **2** of 175, both on `(Deleted)` test courses |

The unfiltered totals (869 / 465) include 8 soft-deleted topics. Success criteria below are
pinned to the filtered set so a correct run is not red by one.

Two traps, both verified:

- **`course.duration` is not a runtime.** It is `{ value, unit: hours|days|weeks|months|years }`
  (`packages/api-client/src/schemas/course.ts:80-84`) — an *access* duration authored in
  the console (`gusi_scanhub_console/src/components/ui/duration-input.tsx:29-50`). Absent
  on all 175 course documents, and not the thing to backfill.
- **The console already shows a per-item duration slot, hard-coded.** The course builder
  renders `item.duration` (`gusi_scanhub_console/src/pages/dashboard/courses/course-builder.tsx:1519`)
  from a literal `'(0m0s)'` (`:1044,:1188,:1199`). A UI slot with no data source.

## Requirements

**Functional**

1. A re-runnable backfill that extracts every Vimeo embed from `v2topics.content` and
   writes duration + thumbnail per topic to a sidecar collection — **using public oEmbed,
   no credential**. <!-- Red team 2026-09-14: F14a -->
2. A second, token-gated pass that records whether text tracks exist, in which languages,
   and the chapter count.
3. A read-only Vimeo API token for the GUSI account, reachable through
   `src/lib/secrets.ts`. Blocks requirement 2 only.
4. A written **caption-coverage number**, committed to this plan's `reports/` folder.
5. A **deploy mechanism** that can populate `v2topicmedia` on staging and production —
   named and built in this phase, not assumed. <!-- Red team 2026-09-14: F14b -->
6. Module and course rollups are computed, never stored (Phase 3 owns the arithmetic).

**Non-functional**

7. Idempotent, and **self-correcting**: a topic whose embed was removed or changed must not
   keep a stale row. Re-running is the repair mechanism.
8. Rate-limit tolerant: concurrency capped, `429` retried with backoff, partial progress
   survives a crash.
9. A video that 404s, is private, or times out is recorded with a `fetchError` on its row.
   The run **refuses to write its report** if every fetch failed. <!-- Red team 2026-09-14: F14e -->
10. A missing or empty token **fails loudly before the first request** of the token pass.
    `secrets.get` returns `''` without throwing for an empty `LOCAL_DEV_SECRETS` entry
    (`src/lib/secrets.ts:290-294` throws only on `undefined`/`null`), so the guard must be
    explicit. <!-- Red team 2026-09-14: F14e -->
11. Never logs the token, and never writes to `v2topics`, `v2lessons` or `v2courses`.

## Architecture

```
v2topics.content (HTML, deletedAt:null)
      │  extractVimeoEmbeds()  — three shapes, see step 2
      ▼
  [ { topicId, videoId, hash|null, provider: 'vimeo'|'youtube' } ]
      │
      ├── PASS A (no auth, build first) ─────────────────────────────
      │     GET https://vimeo.com/api/oembed.json?url=https://vimeo.com/<id>[?h=<hash>]
      │       → duration (s), thumbnail_url, title
      │
      └── PASS B (token, Phase 6 gate only) ────────────────────────
            GET https://api.vimeo.com/videos/<id>[:<hash>]/texttracks
            GET https://api.vimeo.com/videos/<id>[:<hash>]/chapters
      ▼
  v2topicmedia  (NEW collection, unique on topicId)
      ▼
  Phase 2 joins it into the outline (ONE duration field — see Phase 2)
  Phase 6 reads hasTextTracks for its gate
```

**Ownership.** Entirely the **API repo**. No `apps/web` or `packages/api-client` file
changes; nothing reaches the wire until Phase 2 puts it there.
<!-- Red team 2026-09-14: F12 — Phase 2, not Phase 3, owns the outline wire; this phase
     stores the data and stops. -->

**Why a sidecar collection.** `v2topics` is author-owned and edited through the console.
Writing machine-fetched metadata onto it bumps `updatedAt` on 868 documents the console's
list sorts by, so every backfill run would look like 868 authoring edits. The sidecar also
holds bookkeeping (`fetchedAt`, `fetchError`, `vimeoVideoId`) that no author should see.

**How staleness is handled — in the backfill, not at read time.**
<!-- Red team 2026-09-14: F14 (FMA F7) -->
An earlier draft said Phase 3 would treat a row whose `vimeoVideoId` no longer matches the
live content as absent. That is not implementable where it was placed: `fetchOutlineContent`
selects only `_id title status` (`learners.outlinecontent.helper.ts:63`), so honouring it at
read time would mean loading up to 185 HTML bodies per outline request. The backfill already
has the HTML, so it does the reconciliation: a topic that no longer embeds anything has its
row **deleted**; a topic whose embed id changed is re-fetched and overwritten. Durations are
therefore a snapshot whose freshness equals the last run — so the run is **scheduled**, not
one-shot (step 8).

**Deploy mechanism.** <!-- Red team 2026-09-14: F14b -->
`scripts/db/backfill-pathology-scan-type.ts:19-22,47-52` — the precedent this phase cites —
**refuses any non-loopback host and any `mongodb.net` host by design** ("There is no
'against production' mode"). A script following it can never populate staging or
production. So the runnable logic lives in a service module called from **two** entry
points: the loopback-only script (mirror rehearsal) and a scheduled Lambda
(`serverless.yml`, `enabled: false`, invoked manually per environment), reusing the
`processCourseProgressRecomputeJobs` block shape. The script keeps the loopback guard.

## Related Code Files

**Create**

- API repo: `src/database/v2/topic-media/topic-media.model.ts` — the `v2topicmedia` schema.
- API repo: `src/database/v2/topic-media/topic-media.service.ts` — `bulkUpsertByTopicId`,
  `deleteByTopicIds`, `getByTopicIds`.
- API repo: `src/lib/vimeo/extract-vimeo-embeds.ts` — the pure extractor (three shapes).
- API repo: `src/lib/vimeo/vimeo-oembed-client.ts` — **no auth**; duration + thumbnail.
- API repo: `src/lib/vimeo/vimeo-rest-client.ts` — token; text tracks + chapters.
- API repo: `src/lib/vimeo/backfill-topic-media.service.ts` — the logic both entry points
  call.
- API repo: `scripts/db/backfill-topic-media.ts` — loopback-only entry point.
- API repo: `src/workers/backfill-topic-media.ts` — the deployable entry point.
- API repo: `tests/unit/lib/vimeo/extract-vimeo-embeds.test.ts`
- API repo: `tests/functional/vimeo/backfill-topic-media.test.ts`
  <!-- Red team 2026-09-14: F14f — the previously cited precedent
       `tests/scripts/migrate-repair-progress-status.test.ts` was reported missing by one
       reviewer and present by another. Do not cite it. `tests/functional/` is the
       repo's dominant convention (224 test files, all under `tests/`). -->
- `plans/260914-1456-sector-course-experience-roadmap/reports/vimeo-caption-coverage-<YYMMDD>.md`

**Modify**

- API repo: `src/lib/secrets.ts` — add `VIMEO_ACCESS_TOKEN` to `LOCAL_DEV_SECRETS`
  (`:109` region). Empty locally; the token pass fails loudly on `''`.
- API repo: `serverless.yml` — a function block after `dailyCertificateEntitlementReport`
  (`:103-116`), `enabled: false`, `timeout: 600`, `memorySize: 512`,
  `reservedConcurrency: 1`, `maximumRetryAttempts: 0`.
- API repo: `package.json` — `"backfill:topic-media"` for the loopback script.

**Delete** — none.

## Implementation Steps

1. **Model.** `v2topicmedia`: `topicId` (unique), `provider` (`'vimeo' | 'youtube'`),
   `vimeoVideoId`, `vimeoHash`, `durationSeconds`, `thumbnailUrl`, `thumbnailWidth`,
   `hasTextTracks`, `textTrackLanguages[]`, `chapterCount`, `fetchedAt`, `fetchError`,
   timestamps. `transformIdPlugin`; **no** `softDeletePlugin` — a row here is cache.

2. **Extractor** (`extract-vimeo-embeds.ts`). Three shapes, all present in the mirror:
   <!-- Red team 2026-09-14: F14c -->
   - `player.vimeo.com/video/(\d+)` — 868 topics
   - `player.vimeo.com/video/(\d+)\?[^"']*h=([0-9a-f]+)` — **272 topics**; capture the hash,
     it is the unlisted-video access token and the REST call is `GET /videos/<id>:<hash>`
   - bare `vimeo.com/(\d+)` (WordPress core embed) — 19 topics, 1 id unique to this shape
   - `youtube.com` / `youtu.be` — 7 topics: recorded with `provider: 'youtube'` and
     **no duration**, so they are reported rather than silently absent forever.

   Return one embed per topic. `multipleEmbeds` is **0** on the mirror, so there is no
   multi-embed branch to write — if the count is ever non-zero the run reports it and takes
   the first.

3. **oEmbed pass** (`vimeo-oembed-client.ts`, no auth).
   `GET https://vimeo.com/api/oembed.json?url=https://vimeo.com/<id>` (append `?h=<hash>`
   to the inner URL when present). Read `duration` (seconds) and `thumbnail_url`.
   Concurrency 4, `429` honours `Retry-After`, `404`/`403` records the failure kind without
   retrying. **Fetch per distinct video id, not per topic** — 464 calls, not 868.

4. **Reconcile.** For every non-deleted topic with **no** embed, delete any existing
   `v2topicmedia` row. For a topic whose embed id differs from its stored row, overwrite.
   This is what makes a re-run a repair rather than an accumulation.

5. **Token pass** (`vimeo-rest-client.ts`). Guard first: read
   `secrets.get('VIMEO_ACCESS_TOKEN')` and **throw if it is empty or whitespace** before
   any request. Then per distinct id: `GET /videos/<id>[:<hash>]/texttracks` and
   `/chapters`. Record `hasTextTracks`, `textTrackLanguages[]`, `chapterCount`. Do **not**
   store the caption `link` — it is signed and expiring (`link_expires_time`); Phase 6
   fetches it fresh. <!-- Red team 2026-09-14: F3 -->

6. **Run against the mirror.** `MONGODB_URI=mongodb://localhost:27017/gusi_prod_mirror`,
   via the loopback script. The mirror is content-complete, so this is a true rehearsal.
   Production Atlas is read-only and is never a target for either entry point.

7. **Deploy path.** Ship the Lambda with `enabled: false` and invoke it manually once per
   environment (staging, then production) after the mirror rehearsal is clean. Record the
   invocation and its report in the phase's report file.

8. **Schedule it.** Set the Lambda to a monthly `cron()` so a re-captioned or replaced
   video is picked up. A video **replaced in place on Vimeo keeps its id**, so nothing else
   can detect that its length changed. <!-- Red team 2026-09-14: F14 (FMA F7) -->

9. **Write the coverage report.** Videos asked / answered / failed with failure kinds;
   **videos with ≥1 text track as a count and a percentage of 464** (Phase 6's gate input);
   track languages and `captions` vs `subtitles`; videos with ≥1 chapter; duration coverage
   over the 868 video topics; the 7 YouTube topics listed for the content team; the 1
   bare-embed-only id. The report **must refuse to write** if `failed === asked`.

## Tests / validation

**Unit** — `tests/unit/lib/vimeo/extract-vimeo-embeds.test.ts`: plain `player.vimeo.com`
embed; embed with `?h=<hash>` (hash captured); bare `vimeo.com/<id>`; YouTube embed tagged
`provider: 'youtube'` with no id fetched; a `vimeo.com/channels/...` link that is **not** a
video; empty body → `[]`; a body with two embeds returns one and flags it. Use real bodies
copied from `gusi_prod_mirror.v2topics`, following
`packages/ui/src/components/fixtures/rich-text-samples.ts`.

`tests/functional/vimeo/backfill-topic-media.test.ts` with a stubbed client: a full run
writes one row per video topic; a re-run changes only `fetchedAt`; a topic whose embed was
removed has its row **deleted**; a topic whose embed id changed is overwritten; a `404`
leaves `fetchError: 'not_found'` with other rows intact; an **empty token throws before any
request** in the token pass; `--dry-run` writes nothing; a run where every fetch failed
writes no report.

**Fidelity** — **none, and that is the decision.** No schema is exported from
`packages/api-client/src/schemas`, so `fidelity/manifest.test.ts`'s guard has nothing to
demand. Phase 2 adds the replay decision when these fields reach the wire.

**Browser** — **none, and that is the decision.** This phase renders nothing and adds no
row to `scripts/check/sweep-routes.json`. The first browser check of this data is Phase 3's.

**Manual validation** — after the mirror run, three `mongosh --quiet --eval` reads:
`db.v2topicmedia.countDocuments()` ≈ 868;
`db.v2topicmedia.countDocuments({ durationSeconds: { $gt: 0 } })`;
`db.v2topicmedia.distinct('vimeoVideoId').length` = 464.

## Success Criteria

- [ ] The oEmbed pass completes with **no credential** and covers **≥90%** of the 465
      distinct video ids. **Measured 15 Sep 2026: 421 of 465 = 90.5%.** The original ≥95%
      target is not reachable without a token — see the private-video row in Risk below —
      so the token pass is what closes the gap, not a better extractor.
      <!-- Red team 2026-09-15: measured, not assumed -->
- [ ] `db.v2topicmedia.distinct('vimeoVideoId').length` equals the extractor's dry-run
      count (**465** on today's mirror: 464 player-embed ids plus `271215560`, which
      appears only as a bare WordPress core-embed), not a hard-coded literal
- [ ] Every video that did not answer has a non-null `fetchError`
- [ ] A topic whose embed is removed loses its row on the next run
- [ ] The token pass throws on an empty `VIMEO_ACCESS_TOKEN` before issuing a request
- [ ] `v2topics`, `v2lessons` and `v2courses` have unchanged `updatedAt` after a run
- [ ] `v2topicmedia` is populated on **staging** by the deployable entry point, not only on
      the mirror by the script
- [ ] `reports/vimeo-caption-coverage-<YYMMDD>.md` states caption coverage over 464 videos
      as one quotable number, and lists the 7 YouTube topics
- [ ] No file under `apps/web/` or `packages/` is modified by this phase

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Token never issued | Medium | **Low now** (was High) | oEmbed needs none; only Phase 6's gate waits |
| Caption coverage below Phase 6's gate | Medium | High for Phase 6 only | This phase exists to find out early; Phase 6 states the fallback |
| Unlisted videos 403 without the hash | **Disproved** | — | Tested 8 unlisted videos with and without their `?h=`: all 8 resolved either way. oEmbed does not require the hash. It is still captured, because the REST API needs `<id>:<hash>` and the player needs it in the page. <!-- Red team 2026-09-15: measured --> |
| **43 videos are private and oEmbed cannot describe them** | **Certain** (measured) | **Medium** — 43 topics show no duration | Their page returns 200 and `player.vimeo.com/video/<id>?h=<hash>` returns **200**, so they play normally; only the metadata is withheld. oEmbed 404s for the page URL *and* the player URL, with or without the hash, and a matching `Referer` does not help. Only the token pass can resolve them. They cluster in the newer content (FASH, CURLS, Hepatitis B). Each keeps a row with `fetchError: 'not_found'` so the gap is visible rather than silent. |
| Backfill cannot reach staging/production | **Was certain** | High | Two entry points; the deployable one is a listed success criterion |
| Stale rows after content is re-authored | High over time | Medium | Reconciliation in the backfill + a monthly schedule |
| Empty token produces a valid-looking 0% report | Medium | High | Explicit throw; report refuses to write when `failed === asked` |
| YouTube topics never get durations | Certain (7 topics) | Low | Recorded as `provider: 'youtube'` and listed for the content team |
| Rate limiting stretches the run | Medium | Low | Concurrency 4, `Retry-After`, per-id not per-topic |

## Security Considerations

- The token is **read-only** by scope (`public`, `private`) and is needed only for the text
  tracks pass. Request the narrowest scopes Vimeo will issue.
- **It will have a second call site.** This phase reads it from a scheduled backfill only, but
  Phase 6's transcript proxy puts the same token in a learner-facing request path. Scope the
  request accordingly, and keep the client in `src/lib/vimeo/vimeo-rest-client.ts` safe to
  call from a route — no process-wide caching of a signed `link`, no token in a thrown error.
  <!-- Red team 2026-09-14: consistency sweep — Phase 6 F3 -->

- Secrets Manager only, with an **empty** `LOCAL_DEV_SECRETS` entry — and an explicit
  emptiness check, because `secrets.get` returns `''` without throwing
  (`src/lib/secrets.ts:290-294`). Never `gusi_nodejs_api/.env`.
- The unlisted-video **hash is a capability**: `<id>:<hash>` grants access to a video Vimeo
  otherwise hides. Store it (272 topics need it) but treat it like a credential — never log
  it, and never serve it to the browser. Phase 3 serves `thumbnailUrl` and
  `durationSeconds` only.
- The clients must strip `Authorization` from anything they log or throw.
- Thumbnails stay on `i.vimeocdn.com` over https and are never re-hosted — avoiding the
  `legacywp-content` S3 bucket that is being retired.
- Both entry points are write paths. The script keeps the loopback guard the pathology
  precedent established; the Lambda writes only to the environment it is deployed in.
  Neither is ever pointed at production Atlas by hand.


## Outcome — 2026-09-15

Built on `feat/sector-topic-media` in `gusi_nodejs_api`, off `feat/sector-api`.
Gates: typecheck 0, lint 0, **241 tests pass** (29 new unit, 12 new functional).

**What the numbers actually are**, measured by running the real code over all 1,472
non-deleted topics rather than by querying with a regex:

| | Planned | Measured |
| --- | --- | --- |
| Topics embedding a Vimeo video | 868 | **887** (868 player iframes + 19 bare WP core-embeds) |
| Distinct video ids | 464 | **465** (`271215560` appears only as a bare embed) |
| Unlisted (`?h=`) topics | 272 | 272 ✓ |
| YouTube topics | 7 | 7 ✓ |
| Topics with >1 embed | 0 | **1** — `681a4d4b82414b2fcc5af34a`, two *YouTube* videos, which is why a Vimeo-only count read zero |
| oEmbed coverage | assumed ~100% | **421 of 465 = 90.5%** |

**Two plan assumptions were wrong, both now corrected above:**

1. *"Unlisted videos 403 without the hash."* Disproved — 8 unlisted videos resolved with
   and without their hash. The hash is still captured, because the REST API and the player
   need it.
2. *"Durations need no token."* True for 90.5%. **43 videos are private**: the page returns
   200 and `player.vimeo.com/video/<id>?h=<hash>` returns 200 — they play normally — but
   oEmbed 404s for the page URL and the player URL alike, with or without the hash, and a
   matching `Referer` does not help. Only the authenticated API can describe them. They
   cluster in the newer content (FASH, CURLS, Hepatitis B).

**Still blocked, and not by engineering:** the caption pass and those 43 durations both need
a Vimeo API token, which does not exist. The coverage number Phase 6 gates on therefore
cannot be produced yet. `requireVimeoToken` throws before issuing a request, and the report
refuses to render when every lookup failed, so neither failure can masquerade as "this
content has no captions".
