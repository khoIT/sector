# ScanVault

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
local `gusi_dev` Mongo replica set. ScanVault has no backend of its own: with the
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

| Account                        | Role          | Surfaces | Sees                                                |
| ------------------------------ | ------------- | -------- | --------------------------------------------------- |
| `learner@scanvault.test`       | subscriber    | 2        | My Scans, Shared Scans                              |
| `leader@scanvault.test`        | group_leader  | 4        | + Group Scans (unreviewed / reviewed)               |
| `reviewer@scanvault.test`      | scan_reviewer | 6        | + Expert Scans; leads a group, so both queues fill   |
| `reviewer-solo@scanvault.test` | scan_reviewer | 6        | same tabs, but leads no group → group queues empty   |

"Surfaces" counts the leaf lists, which is what the in-page tab bar navigates.
Group Scans and Expert Scans are each ONE top-level tab carrying two sub-tabs, so
a leader sees 3 top-level tabs over 4 surfaces and a reviewer 4 over 6. Each leaf
is gated on its own permission — the legacy tab bar left the two *reviewed*
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
pnpm --filter @scanvault/ui test          # the WCAG AA token contrast suite
pnpm --filter @scanvault/web test         # route guards, tab visibility, formatters
pnpm --filter @scanvault/web dev          # same as `pnpm dev`, without Turbo
```

### Checking the API schemas against the real API

`@scanvault/api-client` parses every response with Zod. An opt-in suite verifies
those schemas against the running API, across all four demo accounts and all five
scan list views:

```bash
SCANVAULT_DEMO_PASSWORD='<demo password>' pnpm --filter @scanvault/api-client test:live
```

Run it after adding or widening a schema. A `parse` ApiError there means the wire
disagrees with the type — which would otherwise blank a page at runtime.

Note: `/api/login` and `/api/me` share a **20 requests / 15 minutes per IP** limit.
Repeated sign-ins while testing will start returning 429; the response's
`RateLimit-Reset` header says how many seconds remain.

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
