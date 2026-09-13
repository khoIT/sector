# Sector Phase 2 — Real data, proven

**13 Sep 2026.** Branch `feat/sector-phase-02`, 6 commits on top of Phase 1. Every
`@sector/api-client` schema now parses 100% of the production collection that feeds
it, and 100% of every list and detail the running API serves for all four roles.
Six production shapes the schemas rejected were found and fixed on the way.

## What shipped

| Commit | What |
| --- | --- |
| `e1a99bd` | `scripts/data/restore-prod-mirror.sh`, `seed-test-accounts.ts`, `seed-minio.ts`; `mongodb`, `tsx`, `bcryptjs`, `@aws-sdk/client-s3` as dev deps; `SECTOR_API_ORIGIN` for the Vite proxy |
| `564cbe2` | `packages/api-client/src/fidelity/*` — mirror opener (loopback allow-list), wire projection (transform-id + populate + soft-delete rules), shape-grouping replayer, report, manifest, guard test, `pnpm fidelity` (collections + routes) |
| `16647f6`, `9b47c9f` | Six schema widenings, each with the count and evidence in a comment |
| `cdc0588` | Shared Scans list and detail survive a share whose study was deleted |
| `0b54459` | README section, CONTRACTS rule ("every schema has a fidelity decision") |

API repo (worktree, branch `feat/sector-local-media`, `75aeae17`): `get-media-files.ts`
presigns against `S3_ENDPOINT` in development instead of CloudFront, so MinIO-backed
media has URLs. One file, gated on the same condition `lib/s3.ts` already uses.

## The mirror

`gusi_prod_mirror` on the local replica set: 36 collections, 412,515 documents from
`dump-prod-content` + `dump-prod-scans` + `dump-prod-scan-owners`, plus `users` from
`dump-local-gusi-dev-260912` (the production user dump holds 5 documents; without the
local backup 30,504 of 31,487 scans had no resolvable owner).

**Finding worth a doc correction:** 3,141 of the 3,151 "recovered" users are stubs —
`{_id, userName, email, firstName, lastName}` only. No password, no status, no role.
They resolve scan owners; they cannot sign in. `docs/mongo-data-loss-12-sep-2026.md`
says the users came back "in full". Ten real accounts did.

## Parse rates

Collections (raw document → the API's wire shape → schema), all 21 entries:

| Entry | Documents | Rate |
| --- | --- | --- |
| scans → detail shape (populated, files mapped, groups joined) | 30,160 | 100% |
| files → media object | 108,460 | 100% |
| scanreviews, scannotes, scanfindings | 15,576 / 18,923 / 80,905 | 100% |
| sharedscans (result item, list item, detail) | 282 × 3 | 100% |
| groups (user-groups item, filter option) | 1,476 × 2 | 100% |
| scantypes (ref, summary, filter option) · scantypeitems (item, finding definition) | 114 × 3 · 893 × 2 | 100% |
| scanforms, scanformfields, organizations, roles | 8 / 139 / 3 / 5 | 100% |
| users → login user, profile (accounts with a role only) | 14 × 2 | 100% |

Routes (through the mirror API on `:5002`, minted sessions, every page at 100 rows,
one detail in 25): learner 403s on every queue as it should; leader pending 2,002 /
reviewed 3,065; reviewer adds expert 7 / expert-reviewed 2,967; administrator pending
9,215 / reviewed 15,499 / expert-reviewed 2,967 — 100% on every list and every sampled
detail (1,637 details). Plus user-groups, 2,538 scan users, a notes thread. 42 of 42
tests, 10 minutes.

## The six shapes found, and the decisions

| Shape | Rows | Decision |
| --- | --- | --- |
| `scanreviews.reviewFacts` is an object (AI generator's structured facts) | 704 / 15,576 | `z.unknown().nullish()` — nothing renders it |
| `scanfindings.value` null | 191 / 80,905 | `.nullable()`; the detail page already draws a dash |
| `scannotes.scan` null (scan soft-deleted) | 729 / 18,923 | `.nullish()` |
| `sharedscans.scan` null (study deleted) | 5 / 282 | `.nullable()` **and** the list row + detail render "no longer available" — this was a whole-page failure for the recipient |
| `scantypeitems.type` null | 12 / 893 | `.nullish()` |
| detail route `groups: [null, null]` (groups soft-deleted; list mapper filters, detail resolver does not) | 10 / 1,637 sampled | `scanGroupListSchema` accepts and drops nulls |

Every widening carries the count and the route in a comment, and a regression test.
None of them changed a write.

## Media

Seeded MinIO with synthetic objects behind 12 real file keys (8 images, 4 videos)
and drove `:3101` (Sector) → `:5002` (mirror API) → MinIO in Chromium as the seeded
reviewer: the production group queue renders (page one of 2,002), a seeded study opens.
**Real playback of real media is not provable from the dumps** — they carry file
records, not bytes. The plan predicted this; staging object storage remains an ask.

## Accounts and the credential gap

The demo password is private to the team, so `seed-test-accounts.ts` creates
`learner|leader|reviewer|admin@sector.test` in `gusi_dev` and in the mirror, password
from `SECTOR_TEST_PASSWORD`, removable with `--remove`. On the mirror the leader and
reviewer lead the largest production queue (2,002 pending). On the mirror the route
replay mints sessions with the `:5002` instance's own JWT secret (`.env.local`,
gitignored), so it never spends the auth rate limit.

## Infrastructure incident

`mongo-test` died mid-run: `Too many open files`, exit 133, at 87 connections. The
container's soft limit was 1,024 descriptors and WiredTiger holds ~340 for data files.
Data survived on the named volume. Added `ulimits.nofile: 65536` to the local
`docker-compose.override.yaml` (untracked, same file as the 12 Sep volume fix) and
recreated the container; counts verified identical before and after. The upstream
`docker-compose.yaml` still has neither the volume nor the limit.

## Against the plan

- **CI.** There is no CI in this repo yet; Phase 11 creates the pipeline. The gate that
  runs everywhere today is the manifest guard inside `pnpm test` (a schema without a
  fidelity decision fails). `pnpm fidelity` needs the mirror and is a pre-merge gate on
  a developer machine until an anonymised fixture dump exists — the real dumps carry
  PII and cannot go into CI.
- **"Slow surfaces named and measured."** Route walks at 100 rows: admin reviewed list
  ≈ 1.35 s/page, pending ≈ 1.25 s/page, expert-reviewed ≈ 2.5 s/page — the reviewed
  and expert-reviewed detail-heavy pages are the slow ones, all server time. The
  browser queue page rendered page one in under 4 s including cold start.
- Progress collections (`usercourseprogresses`, `qbankprogresses`) are in no dump:
  2 and 0 rows locally. The `z.any()` progress-shape risk the plan names for Phases 6–7
  cannot be retired from the mirror; the read seam defines its own shape instead.

## Unresolved questions

1. Who can grant staging S3 access, so real media playback is proven once?
2. Should the users' "recovered in full" claim in `docs/mongo-data-loss-12-sep-2026.md`
   be corrected, and does anyone hold a dump with the real 3,150 accounts?
3. Should `ulimits` and the named volume go into the upstream `docker-compose.yaml`?
4. Is an anonymised fixture dump (no users, no notes text) acceptable for CI?
