---
title: A flow the user chooses, a profile in the rail, and a download that works
status: completed
created: 2026-09-12
---

# A flow the user chooses, a profile in the rail, and a download that works

Three requests, three independent tracks, one session.

1. **Both create-scan flows, switchable from the profile.** The ordered wizard
   was deleted, not flagged. Bring it back as a shell over today's panels and
   let the user pick.
2. **The account control at the bottom of the desktop rail**, opening upward.
3. **Make Download work.** It was blocked in every environment by the media
   CDN serving no CORS headers.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Download reaches the bytes](phase-01-download-reaches-the-bytes.md) | completed |
| 2 | [The account control moves to the rail](phase-02-the-account-control-moves-to-the-rail.md) | completed |
| 3 | [Two ways through create scan](phase-03-two-ways-through-create-scan.md) | completed |
| 4 | [The study bar stops promising a menu](phase-04-the-study-bar-stops-promising-a-menu.md) | completed |

Phases 1-3 are independent and touch disjoint files. Phase 4 followed a
report against the surface phase 3 made switchable.

## Acceptance criteria

- [x] Download saves a single file and a multi-file zip in the browser
- [x] The production build contains no reference to the dev-only proxy
- [x] The dev proxy refuses any host that is not the media CDN or S3
- [x] Exactly one identity control is on screen at every width
- [x] The rail control sits on the bottom edge and opens upward
- [x] A profile setting switches the create-scan flow, saved per browser
- [x] A draft started in one flow opens in the other with its contents intact
- [x] The study bar's chips no longer claim to open a menu they never opened
- [x] The scan-type grid folds once a type is chosen, and only where folding makes sense
- [x] `pnpm -w typecheck`, `lint`, `build` clean; tests 241 web / 91 api-client / 69 ui

## What this did not fix

**Download still fails in a production build.** The fix is a dev-server route;
a built bundle has no dev server. Production needs a CORS response-headers
policy on the CloudFront distribution (an AWS change, no credentials here) or a
streaming route on the API. The code is written so that production keeps
reporting the failure by name rather than 404ing against a route that is not
there.

## Unresolved questions

1. `GET /api/test/cloudfront-url?key=` (`gusi_nodejs_api/src/app/test/test.route.ts:9`)
   signs **any** S3 key for 24 hours with **no authentication**. Is it mounted
   in staging or production? If so it is an unauthenticated read of arbitrary
   patient-adjacent media. Found while investigating this work; unrelated to it.
2. Only the **staging** distribution (`d2i5h4x9hhv8tx.cloudfront.net`) was
   tested. Whether production is configured the same way is unverified.
3. Every CDN response carries `vary: Origin` while carrying no
   `access-control-allow-origin`, which hints the *bucket* may have a CORS
   config the distribution is not forwarding. That changes whether the AWS fix
   is a bucket change or a distribution change. Untestable without credentials.
4. The flow preference is per-browser. Making it per-account needs a server
   change in a repo this app does not own — see phase 3.
