# Sector

A rebuild of the GUSI Scan Vault as a pnpm + Turborepo monorepo, reading from the
existing legacy API. Nothing here touches production: the app talks to a local
`gusi_nodejs_api` on `:5001` against the local `gusi_dev` database.

```
scanvault/
├── apps/web              Vite + React + React Router + TanStack Query (port 3100)
└── packages/
    ├── config            shared tsconfig bases + shared ESLint flat config
    ├── ui                design tokens, ThemeProvider, UI primitives
    └── api-client        typed client over the legacy API
```

Feature work happens on top of this foundation. **Read [CONTRACTS.md](./CONTRACTS.md)
first** — it is the exact surface (package names, tokens, component props, hooks,
route mounting point, auth API) every feature area depends on.

## Prerequisites

- **Node 22.** Pinned in `.nvmrc`. Node 24 breaks the legacy API (`logger.error`
  crashes inside `util.inspect` and turns handled 4xx responses into opaque 500s).
- **pnpm 10.8**, via Corepack. `packageManager` in the root `package.json` pins it.
- The legacy API running on `http://localhost:5001` against local Mongo `gusi_dev`
  (which must be a replica set — the API uses transactions).

```bash
nvm use            # reads .nvmrc -> 22
corepack enable pnpm
```

## Install and run

The legacy API **must already be running on `http://localhost:5001`** against the
local `gusi_dev` Mongo replica set. Sector has no backend of its own: with the
API down, the login page loads but every sign-in fails with a network error.

```bash
pnpm install
pnpm dev             # http://localhost:3100
```

`pnpm dev` from the repo root is the single command — Turbo runs the only `dev`
task in the workspace (`apps/web`, Vite) and streams its output. The port is
fixed: `strictPort` is on, so if 3100 is taken Vite fails loudly instead of
silently moving to 3101 and making the documented URL wrong.

`/api/*` is proxied to `http://localhost:5001`, so the API client runs with an
empty base URL and there is no CORS in development. Set `VITE_API_BASE_URL` only
if you need to point at an API on another origin.

Sign in with a demo account (password is in the team's local setup notes):

| Account                        | Role          | Surfaces | Sees                                               |
| ------------------------------ | ------------- | -------- | -------------------------------------------------- |
| `learner@scanvault.test`       | subscriber    | 2        | My Scans, Shared Scans                             |
| `leader@scanvault.test`        | group_leader  | 4        | + Group Scans (unreviewed / reviewed)              |
| `reviewer@scanvault.test`      | scan_reviewer | 6        | + Expert Scans; leads a group, so both queues fill |
| `reviewer-solo@scanvault.test` | scan_reviewer | 6        | same tabs, but leads no group → group queues empty |

"Surfaces" counts the leaf lists, which is what the in-page tab bar navigates.
Group Scans and Expert Scans are each ONE top-level tab carrying two sub-tabs, so
a leader sees 3 top-level tabs over 4 surfaces and a reviewer 4 over 6. Each leaf
is gated on its own permission — the legacy tab bar left the two _reviewed_
sub-tabs ungated, which let a role holding only `view:scan:pending` open a list
the server would 403.

Verified against the local API, all four accounts, on 2026-09-11:

| Account       | my  | shared | group unrev / rev | expert unrev / rev |
| ------------- | --- | ------ | ----------------- | ------------------ |
| learner       | 5   | 1      | 403 / 403         | 403 / 403          |
| leader        | 0   | 0      | 2004 / 3068       | 403 / 403          |
| reviewer-solo | 0   | 0      | 0 / 0             | 7 / 2967           |
| reviewer      | 0   | 0      | 2004 / 3068       | 7 / 2967           |

The two reviewer accounts carry identical permissions and differ only in data.
That is deliberate: tab visibility is role-driven, so an empty queue still shows
its tab rather than disappearing.

## Everyday commands

All of these run through Turbo from the repo root:

```bash
pnpm dev             # the app on :3100 (needs the legacy API on :5001)
pnpm -w typecheck    # tsc --noEmit in every package
pnpm -w test         # vitest in ui, api-client and web
pnpm -w lint         # eslint flat config
pnpm -w build        # production build of apps/web
```

Per package:

```bash
pnpm --filter @sector/ui test          # the WCAG AA token contrast suite
pnpm --filter @sector/web test         # route guards, tab visibility, formatters
pnpm --filter @sector/web dev          # same as `pnpm dev`, without Turbo
```

### Checking the API schemas against the real API

`@sector/api-client` parses every response with Zod. An opt-in suite verifies
those schemas against the running API, across all four demo accounts and all five
scan list views:

```bash
SECTOR_DEMO_PASSWORD='<demo password>' pnpm --filter @sector/api-client test:live
```

Run it after adding or widening a schema. A `parse` ApiError there means the wire
disagrees with the type — which would otherwise blank a page at runtime.

Note: `/api/login` and `/api/me` share a **20 requests / 15 minutes per IP** limit.
Repeated sign-ins while testing will start returning 429; the response's
`RateLimit-Reset` header says how many seconds remain.

### One page load, before anything merges

The suites run in a node environment with no DOM, so nothing in them ever
renders. A slice can pass lint, typecheck, every test, the build and the
fidelity replay and still be dead on screen. Open the routes:

```bash
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

Each route gets a fresh browser context, because the bug this exists to catch
was invisible on a second visit with a warm query cache. The fixture directory
holds `sweep-ids.json` (a user id per role) and `sweep-routes.json` (the paths
and which role opens each). `sweep-routes.json` ships beside the script and
covers every route built so far, so only `sweep-ids.json` has to be written by
hand — the seeded accounts get fresh ids each time the local database is
rebuilt, which is why it cannot be committed. Omit the fixture directory to use
the shipped routes. Set `SECTOR_WEB_ORIGIN` to point the sweep at a worktree's
own dev server on its own port instead of the shared `:3101` instance.

### The production mirror, and proving the schemas against it

The dumps beside this repo hold every production content and scan collection.
Restored into a **local** database, `gusi_prod_mirror`, they are the fidelity
target: `pnpm fidelity` replays every document through the schema that parses
its API route and reports, per route, how many parsed and which _shapes_ did
not — "704 reviews hold an object in `reviewFacts`", not 704 rows.

```bash
scripts/data/restore-prod-mirror.sh   # dumps → gusi_prod_mirror on localhost (≈ 1 min)
pnpm fidelity                         # every collection, every schema; prints the parse table
```

Nothing in this connects to the production cluster. Every script and the
harness itself refuse any URI whose host is not loopback.

The register of what proves what is `packages/api-client/src/fidelity/manifest.ts`.
A schema exported from `src/schemas` that appears in no entry there and is not
excused with a reason fails the ordinary `pnpm test`, so a new route family
cannot ship without deciding how real data tests it. When the replay finds a
shape, the schema either learns it (with the count and the reason in a
comment, see `reviewFacts` in `schemas/scan.ts`) or the manifest records it as
a known exception.

**Driving the app against the mirror.** A second API instance serves the
mirror on `:5002`, and a second dev server proxies to it on `:3101`, leaving
`:5001` / `:3100` on `gusi_dev` untouched. From a clone of the API repo:

```bash
NODE_ENV=development HTTP_PORT=5002 \
MONGODB_URI='mongodb://localhost:27017/gusi_prod_mirror?directConnection=true' \
AWS_SECRET_MANAGER_KEY=local AWS_SECRET_MANAGER_REGION=us-east-1 \
S3_ENDPOINT=http://localhost:9000 S3_ACCESS_KEY=minioadmin S3_SECRET_KEY=minioadmin \
AWS_S3_BUCKET=gusi-local JWT_SECRET_KEY="$SECTOR_MIRROR_JWT_SECRET" \
EMAIL_PROVIDER=smtp SMTP_HOST=localhost SMTP_PORT=1025 pnpm dev:http
```

```bash
SECTOR_API_ORIGIN=http://localhost:5002 pnpm --filter @sector/web exec vite --port 3101
```

The two `AWS_SECRET_MANAGER_*` values only have to be present: the API's env
loader requires them, fails to reach AWS, and falls back to the environment.
Media on the mirror comes from local MinIO (`docker-compose.minio.yml` in the
API repo), fed by `pnpm tsx scripts/data/seed-minio.ts`, which puts synthetic
objects behind a sample of real file keys — the dumps carry file records, not
the bytes, so real playback of real media still needs staging object storage.

**Accounts.** The demo accounts' password is private to the team, so the
tooling seeds its own:

```bash
SECTOR_TEST_PASSWORD='<8+ characters>' pnpm tsx scripts/data/seed-test-accounts.ts --db gusi_dev
SECTOR_TEST_PASSWORD='<the same>'       pnpm tsx scripts/data/seed-test-accounts.ts --db gusi_prod_mirror
```

| Account                | Role          | On `gusi_dev`                             | On the mirror                      |
| ---------------------- | ------------- | ----------------------------------------- | ---------------------------------- |
| `learner@sector.test`  | subscriber    | no scans of its own                       | no scans of its own                |
| `leader@sector.test`   | group_leader  | leads the same group as the demo leader   | leads the largest production queue |
| `reviewer@sector.test` | scan_reviewer | leads the same group as the demo reviewer | leads the largest production queue |
| `admin@sector.test`    | administrator | `full-access`                             | `full-access`                      |

The learner is also enrolled in every course that has a published version, 115
of them on the mirror, because the dumps carry no enrolments and a learner with
more than a hundred is the case My Courses has to get right.

`scripts/data/seed-course-progress.ts` then gives that learner real progress by
driving the API rather than by writing documents, so the records are shaped the
way the version pinning and recalculation shape them:

```bash
pnpm tsx scripts/data/seed-course-progress.ts        # needs the mirror API on :5002
```

It leaves a spread the surfaces can be judged against — one course untouched,
four part way, one finished — and a course only reaches 100% because its
quizzes are answered question by question, which is the one thing an ordinary
track call cannot do.

`--remove` takes them out again. Keep the password in `.env.local` (gitignored)
so the route replay can find it: `pnpm fidelity` also walks every list view
through the running mirror API for all four accounts when
`SECTOR_MIRROR_JWT_SECRET` is set to the secret the `:5002` instance was
started with, minting sessions rather than spending the auth rate limit.

Normally it comes from `.env.local` at the repo root, which is gitignored and
holds the two local secrets, so the replay just runs. If that file is missing,
read the secret back off the running instance rather than hunting for where it
was set:

```bash
PID=$(lsof -nP -iTCP:5002 -sTCP:LISTEN -t | head -1)
export SECTOR_MIRROR_JWT_SECRET=$(ps -Eww -p "$PID" | tr ' ' '\n' |
  grep -m1 '^JWT_SECRET_KEY=' | cut -d= -f2-)
```

A run that cannot reach the mirror, or has no secret, prints `route replay
skipped` and reports only the collection half. That line is the thing to look
for: the count alone will not tell you, because a skipped half still reads as a
pass. Note that `turbo.json` must list the variable under `passThroughEnv` or it
never reaches the task at all, which is how the replay went unnoticed for a
while.

## Layout of the app

`apps/web/src`:

```
app/          providers, the router, the Scan Vault tab routes
auth/         session context, route guards, login + 403 pages
shell/        sidebar, topbar, theme switcher, nav config
features/
  scan-list/    the six Scan Vault surfaces + the data table
  scan-detail/  media viewer, context panel, notes, sharing, review panel
  create-scan/  the upload wizard
lib/          the API client instance and shared display formatters
routes/       feature-routes.tsx — the mounting point for non-tab surfaces
```

Two route mounting points, kept apart so parallel edits do not collide:
`app/scan-vault-routes.tsx` owns the tab paths, `routes/feature-routes.tsx` owns
everything else. Both inherit the auth guard and the shell chrome. See
[CONTRACTS.md](./CONTRACTS.md) §5 for the full URL table.

## Known gaps

- **DICOM is a placeholder.** The scan detail viewer labels DICOM files but does
  not render them; local `gusi_dev` contains no DICOM bytes to point it at.
- **Dynamic organization forms** (`forms[]` from `/scan-type/:id/items`) are
  parsed but not rendered. The wizard collects findings only.
- **The create-scan wizard creates the scan row at Submit**, not at first file
  accepted, because `POST /api/scan/create` requires `scanTypeId` (unknown until
  step 2) and `groupIds` (chosen in step 3), and `PUT /api/scan/:id/update`
  accepts neither. Abandoned uploads therefore leave orphaned S3 objects that
  nothing reaps.
- **Multipart upload is wired in the client but unused** — the wizard always uses
  the single-shot presigned PUT, so there is no resume after a network drop.
- **Note deletion, scan tags and the AI review panel are not ported.**
- The React Router v7 future-flag console warnings are left on deliberately;
  enabling `v7_startTransition` changes how lazy routes interact with Suspense
  and was not worth the risk here.
