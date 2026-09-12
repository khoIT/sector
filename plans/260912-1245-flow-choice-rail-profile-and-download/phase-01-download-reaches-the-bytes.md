---
phase: 1
title: "Download reaches the bytes"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Download reaches the bytes

## What was actually wrong

Measured against the staging distribution with a real signed URL for a
5,649,166-byte scan video, rather than assumed:

| request | result |
|---|---|
| plain GET | `200` — no `access-control-*` header of any kind |
| GET + `Origin: http://localhost:3100` | `206`, `vary: Origin`, still no `access-control-allow-origin` |
| GET + `Origin: https://scanvault.example` | identical — it is not an origin allowlist, there is no header |
| `OPTIONS` + `Origin` + `Access-Control-Request-Method` | **`403`**, `x-cache: Error from cloudfront` — preflight refused outright |
| GET + `&response-content-disposition=attachment…` | **`403 AccessDenied`** |

Two findings that closed off the obvious workarounds:

- **The signature covers the query string.** Appending
  `response-content-disposition` invalidates it. It would not have worked
  anyway: these are CloudFront **canned-policy signed URLs**
  (`gusi_nodejs_api/src/lib/s3.ts:47`), and `response-content-*` is an S3
  presigned-GET feature with no meaning at a CloudFront edge.
- **The legacy dashboard fails identically.** `gusi_web_dashboard/src/lib/file-utils.ts:166`
  is the same `fetch(url).blob()` against the same host. Its other
  `a.download` uses are same-origin blob URLs from JSON, unaffected.

## What was built

`apps/web/src/lib/media-proxy-url.ts` + `apps/web/vite-media-proxy.ts`.

The dev server fetches the object and returns it same-origin. The signature
survives because host, path and query are reproduced exactly.

Not a `server.proxy` entry: that needs one fixed target host, and the CDN host
arrives at runtime inside URLs the API signs. A small middleware reads the
upstream URL from one encoded query parameter instead — encoded whole, because
re-encoding the parts of a query string is how a signature gets broken.

Three things the implementation gets right on purpose:

- **Streamed, not buffered.** `Readable.fromWeb(…).pipe(response)`. A study is
  routinely hundreds of megabytes and buffering one would put it in the dev
  server's heap. `range` is forwarded, so seeking still works.
- **Not an open proxy.** `isProxyableMediaUrl` allows only `https:` on
  `.cloudfront.net` / `.amazonaws.com`. Without it the dev server would fetch
  anything a URL could name from the developer's machine — `localhost`, cloud
  metadata, the internal network. Tested: a `localhost` target answers `400`.
- **Dev only, and honestly so.** `mediaFetchUrl` reads `import.meta.env.DEV`.
  Verified in the built output: **no reference to `/media-proxy` survives in
  any of the 18 production bundles** — the gate folds to `false` and the path
  is tree-shaken. Production keeps reporting which files could not be fetched,
  rather than 404ing against a route that does not exist.

`fetchScanFiles` takes the rewrite as an injected `toFetchUrl` parameter, so
the behaviour is asserted in a node test without depending on the runner's
environment flags.

## Verified in the browser

- one file → `DVT-29FEB-2704-brunovargas-17092085351.jpg`, **47,111 bytes**
- many files → `FAST-OCT8-00004.zip`, **42,380,054 bytes**, 6 entries, three of
  them ~10 MB MP4s, listed by `unzip -l`
- requests go to `/media-proxy?url=…`; no CORS error in the console

## Risk / rollback

Self-contained: one new module, one new plugin file, two lines in
`vite.config.ts`, one call site. Reverting restores the previous (broken)
behaviour exactly.
