---
phase: 2
title: "Real data, proven"
status: pending
priority: P1
effort: "6 days"
dependencies: []
---

# Phase 2: Real data, proven

## Overview

Make "handles all the real data" a test that can fail. Restore the production BSON
dumps already sitting in the working folder into a **local** replica set, seed local
object storage, and replay every real shape through every Zod schema in CI.

This is the phase the data-layer decision bought. `gusi_nodejs_api` remains the only
thing that touches Mongo and S3 — the client cannot reach S3 in any case, because
media is signed with a **CloudFront key pair** held server-side
(`gusi_nodejs_api/src/lib/s3.ts`, 24h TTL) and presigned S3 URLs expire in ten minutes.

## The production cluster is not involved

Everything here runs against a local replica set restored from dumps on disk. No
step connects to `gusi-cluster-production.6ljc5.mongodb.net`. Refreshing a dump is
a `mongodump` — a read — and nothing in this phase writes anywhere but locally.

## What we have, and what we do not

| Dump | Size | Holds |
| --- | --- | --- |
| `dump-prod-content` | 12M | courses, v2 courses/lessons/topics/quizzes/questions/coursemetas/coursemetaversions, pathologygalleries, scantypes, scantypeitems, scanforms, scanformfields, organizations, roles, products |
| `dump-prod-scans` | 158M | scans, files, scanfindings, scannotes, scanreviews, scanreviewrequests, scanreviewpurchases, groups, groupmembers, groupmetas, sharedscans, groupuserscans, mediadeidentifications |
| `dump-prod-scan-owners` | 476K | users (scan owners only) |
| `dump-staging-scans` | 54M | the same scan domain from staging |

**The gap to state plainly: the dumps carry file *records*, not S3 *objects*.** Media
bytes are not reproducible from them. Media fidelity is therefore tested two ways —
metadata fidelity against the real `files` collection, and playback against a small
seeded MinIO set. Real-object playback needs staging S3 access, which is an ask, not
a task.

## Related code files

- Create: `scripts/data/restore-prod-mirror.sh` — restore the dumps into a local
  replica set `gusi_prod_mirror`, refuse to run if `MONGODB_URI` names anything
  containing `mongodb.net`
- Create: `scripts/data/seed-minio.ts` — synthesise objects for a sample of `files`
  rows so the media surfaces have something to fetch
- Create: `packages/api-client/src/fidelity/replay.ts` — walk a collection, parse each
  document with the matching schema, collect failures by shape not by row
- Create: `packages/api-client/src/fidelity/*.fidelity.test.ts` — one per schema group
- Modify: `turbo.json`, root `package.json` — a `fidelity` task
- Modify: whichever schemas the replay breaks

## Implementation steps

1. Restore `dump-prod-content` + `dump-prod-scans` + `dump-prod-scan-owners` into
   `gusi_prod_mirror` on the local replica set. Document the command in the README.
2. Point a second local `gusi_nodejs_api` instance at the mirror on a second port, so
   the app can be driven against production shapes without disturbing `gusi_dev`.
3. Write the replay harness. Failure output must group by *shape* — "1,204 rows where
   `groups` is absent" — not print 1,204 rows.
4. Run it over every schema in `packages/api-client/src/schemas`. Fix what it finds.
   Known suspects from the source reports: `scan.groups` present on list and absent on
   detail; free-text `category`/`subCategory` on pathology; `z.any()` progress blobs;
   `lessons: [Object]` on v1 `Course`; null S3 urls on `files`.
5. Seed MinIO and confirm the media viewer plays, magnifies and paginates.
6. Add `pnpm fidelity` to CI. A new schema without a fidelity case fails the build.

## Tests / validation

- `pnpm fidelity` reports per-collection parse rates.
- Drive :3100 against the mirror with a real production-scale account: a 2,000-row
  queue, a 22-scan-type list, a 1,334-entry learner filter. Record what is slow.

## Success criteria

- [ ] Every `packages/api-client` schema parses 100% of its production collection, or
      the exception is documented with the shape and a decision
- [ ] The app is usable against the mirror at production row counts, with the slow
      surfaces named and measured
- [ ] No script in this phase can run against an Atlas URI
- [ ] `pnpm fidelity` runs in CI and fails on an unparsed shape

## Risk / rollback

The likely finding is that several schemas are too strict, and one or two surfaces are
too slow at real scale. Both are cheap to fix now and expensive after five more phases
are built on them — which is the whole reason this sits at position 2. If media
playback cannot be proven without staging S3, say so in the report rather than
declaring the phase done.
