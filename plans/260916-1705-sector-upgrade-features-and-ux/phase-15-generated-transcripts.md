---
phase: 15
title: "Generated transcripts"
status: pending
priority: P2
effort: "3d + external"
dependencies: [14]
---

# Phase 15: Generated transcripts

## Overview

Produce transcripts ourselves for videos Vimeo has no captions for, so the
Transcript tab from phase 14 is never empty for a playable video. Target
today: the 35 videos alive on public oEmbed but with no readable tracks
(5.8 hours of audio), plus any future upload. Served by phase 14's route with
`source: 'generated'` and labelled as such.

## Gate

**Media access.** Measured 16 Sep 2026 with the Contributor-seat token on a
visible video: `privacy.download=false`, `download[]` and `files[]` absent,
`play` carries only a status. The 35 target videos return 404 to the token.
Nothing can be transcribed until one of these is granted by the Vimeo account
owner (business ask, not engineering):

1. Enable download / grant the `video_files` scope to a token minted by the
   owner, or
2. Share the folders holding the 35 videos with the seat (then re-check
   whether Vimeo's own auto-captions can simply be enabled — zero engineering
   if so), or
3. Content team drops the source files into an S3 prefix the worker can read.

Decision owner: Khoi asks the Vimeo owner. Until granted, this phase stops
after step 1 (the decision record) and the phase 14 empty state stands.

## Requirements

**Functional**

- A job transcribes one video: fetch media → extract audio → speech-to-text
  → cues `{start, end, text}` → store as a `v2topictranscripts` document
  `{ vimeoVideoId, language: 'en', source: 'generated', engine, cues, createdAt }`.
- Phase 14's route prefers a Vimeo track when present, otherwise a generated
  transcript, and the response says which.
- The player shows an "Auto-generated transcript" label and a "Report an
  error" link (mailto to the content team address used elsewhere in the app;
  no new store).
- Re-runnable: a video re-transcribed replaces its document.

**Non-functional**

- Runs on the queue worker, never on the API process (ffmpeg lives in the
  worker container — see `src/workers/process-deidentification.ts`).
- Provider decision recorded in step 2 with cost: hosted Whisper-class API at
  roughly USD 0.006/min → ~USD 2 for 5.8 h, pennies per future video; or
  self-hosted `whisper.cpp` large-v3 on the worker (no per-minute cost, adds a
  model download and CPU minutes). Recommend hosted for the backlog, revisit
  if volume grows. Medical vocabulary: expect proper-noun errors; that is
  what the label and report link are for.
- Generated text is excluded from any future search index until reviewed.
- Fidelity decision: `NOT_REPLAYED` for the response (no production
  collection yet); once the collection exists on the mirror, switch to
  `proves: v2topictranscripts`.

## Architecture

```
worker (API repo)
  src/lib/queue/jobs/transcribe-video.job.ts      NEW  JobDefinition — see jobs/deid.job.ts pattern
  src/lib/vimeo/vimeo-media-client.ts             NEW  resolve a media URL (download/files) or S3 key
  src/lib/transcription/speech-to-text.ts         NEW  provider adapter (hosted | whisper.cpp)
  src/database/topic-transcript/{model,service,type}.ts  NEW  v2topictranscripts
  src/workers/transcribe-missing-videos.ts        NEW  handler: enqueue one job per v2topicmedia
                                                       row with hasTextTracks=false and a live video
API
  transcript route from phase 14: source fallback  vimeo → generated → 404 "no transcript"

web (phase 14 panel)
  transcript-panel.tsx  + "Auto-generated" label + report link when source === 'generated'
```

## Related Code Files

- API side — Create: the five files above; Modify: phase 14's transcript
  controller (fallback), `src/lib/secrets.ts` (provider key name, optional),
  `serverless.yml` (worker entry, `enabled: false` until first clean run — same
  convention as `backfill-topic-media`); Create: `tests/functional/transcript/generated-fallback.test.ts`,
  unit tests for the cue builder.
- api-client — Modify: phase 14's transcript schema gains `source: 'vimeo' | 'generated'`
  and `engine?: string`; fidelity decision updated.
- web — Modify: `apps/web/src/features/courses/runner/transcript-panel.tsx`
  (from phase 14), `apps/web/src/i18n/locales/*.json` (`courses.transcript.generated.*`).
- Read: `src/lib/queue/jobs/deid.job.ts`, `src/lib/queue/queue.type.ts`,
  `src/workers/backfill-topic-media.ts`, `src/lib/vimeo/vimeo-rest-client.ts`.

## Tests Before

- Phase 14's route tests pin: Vimeo track → 200; no track → 404 "no
  transcript". Keep them green through the fallback change.
- Transcript panel tests pin the empty state copy.

## Refactor

- Route gains a second source; panel gains a label. Nothing else moves.

## Tests After

- Job unit tests: cue segmentation (≤ ~7 s, sentence-aware), timestamp
  monotonicity, replace-on-rerun.
- Route: generated used only when no Vimeo track; response `source` correct.
- Panel: label and report link only for `source === 'generated'`.
- One real run on the local worker against a single video once media access
  exists; cue count and total duration match the video within 2%.

## Implementation Steps

1. **Decision record** (this can happen now): write the media-access ask with
   the three options to `reports/`, send it, log the answer here. Stop until
   granted.
2. Provider decision + cost note; secret name registered in `secrets.ts`.
3. Model + service + job + media client + STT adapter, with tests.
4. Route fallback + schema `source`/`engine` + fidelity decision.
5. Panel label + report link + locale keys.
6. Run the backlog worker by hand on staging (35 videos); record engine, cost,
   failures; then enable the schedule.

## Regression Gate

```
# API
pnpm vitest run --no-file-parallelism tests/functional/transcript src/lib/transcription
# scanvault
pnpm --filter @sector/api-client test
pnpm --filter @sector/web test -- src/features/courses/runner
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] Media-access decision recorded with the option granted (or the phase
      is parked with the ask sent).
- [ ] All 35 target videos have a generated transcript; the Transcript tab is
      non-empty for every playable video in the library.
- [ ] Generated transcripts are labelled and carry a report link.
- [ ] Route prefers Vimeo tracks; fidelity decision present.
- [ ] Against staging without the route, the panel keeps phase 14's states.

## Risk Assessment

- **Access never granted** → phase parks; the 43 dead videos are a content
  task regardless; coverage stays at 83%.
- **Transcription errors on clinical terms** → labelled as generated, report
  link, and reviewed before any search use.
- **Cost surprise** → backlog is 5.8 h; per-video cost is pennies; note the
  per-hour figure in the decision record.

## Security & Privacy Considerations

- Teaching videos contain no patient identifiers by GUSI policy; still, media
  and transcripts stay in GUSI-controlled storage, and the STT provider must
  be one whose terms exclude training on submitted audio (record in the
  provider decision). The provider key is a server secret, never in the web.
