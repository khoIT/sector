# Sector contracts

The surface four feature areas build on. Everything documented here exists and is
verified by `pnpm -w typecheck`, `pnpm -w test` and `pnpm -w lint`.

If you need something that is not here, add it — but add it in a NEW file and
export it from that package's barrel rather than widening an existing module, so
parallel work produces separable diffs.

---

## 1. Packages and import paths

| Package              | Import specifier                                                  | What it is                                  |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `@sector/ui`         | `import { … } from '@sector/ui'`                                  | tokens, ThemeProvider, primitives           |
| `@sector/ui`         | `'@sector/ui/styles.css'`                                         | the stylesheet. Imported ONCE, already done |
| `@sector/api-client` | `import { … } from '@sector/api-client'`                          | transport, schemas, hooks                   |
| `@sector/config`     | `'@sector/config/tsconfig.react.json'`, `'@sector/config/eslint'` | build config                                |

Inside `apps/web`, `@/` is an alias for `apps/web/src/`.

Both library packages export TypeScript source directly (no build step), so
`pnpm --filter @sector/web dev` picks up edits to `packages/*` with HMR.

Add a dependency to `apps/web` with
`pnpm --filter @sector/web add <pkg>`, then re-run `pnpm install` at the root.

---

## 2. Design tokens

Defined in `packages/ui/src/styles/tokens.css`. The complete light palette is on
bare `:root`; dark is redefined in BOTH
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { } }` and
`:root[data-theme="dark"] { }`.

| Token           | Light     | Dark      | Use                                                            |
| --------------- | --------- | --------- | -------------------------------------------------------------- |
| `--bg`          | `#efe7da` | `#17150f` | the parchment shell behind everything                          |
| `--surface`     | `#fdfaf4` | `#211e17` | the inset content panel (`<Card>`)                             |
| `--surface-2`   | `#f6f0e5` | `#2b271d` | table headers, zebra rows, chips, secondary buttons            |
| `--ink`         | `#22201c` | `#f2eadc` | body text                                                      |
| `--ink-dim`     | `#5e574c` | `#b3a996` | metadata, labels, column headers                               |
| `--line`        | `#ddd2be` | `#3d3729` | hairline borders and dividers                                  |
| `--accent`      | `#ee7625` | `#ee7625` | **GUSI orange. FILLS ONLY.**                                   |
| `--accent-ink`  | `#2f6b73` | `#6ec3cd` | **the text-level accent**: links, active tab labels            |
| `--accent-soft` | `#fce9d8` | `#382718` | accent chip / selected-row background                          |
| `--ok`          | `#2e6b41` | `#79d09a` | success text                                                   |
| `--ok-soft`     | `#dcede1` | `#1b2d22` | success pill background                                        |
| `--warn`        | `#8a5300` | `#e8b45e` | warning text                                                   |
| `--warn-soft`   | `#faebcd` | `#33260f` | warning pill background                                        |
| `--crit`        | `#b3261e` | `#f0928a` | error text                                                     |
| `--crit-soft`   | `#f9dedb` | `#351d1b` | error pill background                                          |
| `--radius`      | `8px`     | `8px`     | corner radius                                                  |
| `--scan-ground` | `#14120f` | `#0b0a08` | ultrasound media backdrop, AND the label on an `--accent` fill |

### Three rules the contrast test enforces

1. **Never put the orange on text.** `--accent` is 2.78:1 on the light `--surface`
   and 2.36:1 on `--bg` — both fail AA. Use `--accent-ink` (teal) for any accented
   text. It happens to clear AA against the _dark_ surface, which is exactly the
   trap: the rule stays fills-only so a component cannot look correct in one theme
   and be illegible in the other. The test asserts the light-palette failure so
   nobody "simplifies" the two accent tokens into one.
2. **Text on an orange fill is `--scan-ground`.** `--ink` works in light (5.62:1)
   but drops to 2.42:1 once the palette flips to dark. `--scan-ground` is the only
   near-black that stays dark in both themes: 6.46:1 light, 6.84:1 dark.
3. **Text over ultrasound media is white, dimmed with opacity.** No token works
   there: `--scan-ground` is a fixed near-black while `--ink` and `--surface` each
   swap with the theme, so any token pairing is legible in one theme only. The
   test asserts white against `--scan-ground` in both.

`packages/ui/src/styles/token-contrast.test.ts` parses `tokens.css` (stripping
comments first — the file's own doc comment names all three selectors) and asserts
21 foreground/background pairs at 4.5:1 in all three theme states, plus the two
rules above. Change a hex and run `pnpm --filter @sector/ui test`.

### Tailwind utilities

A `@theme inline` block maps each token onto a Tailwind v4 namespace, so every
token has a utility whose name matches the token name:

```
bg-bg  bg-surface  bg-surface-2  bg-accent  bg-accent-soft
bg-ok-soft  bg-warn-soft  bg-crit-soft  bg-scan-ground
text-ink  text-ink-dim  text-accent-ink  text-ok  text-warn  text-crit  text-scan-ground
border-line   rounded-token   text-body   font-sans
```

`inline` keeps the `var()` in the generated rule, so a runtime theme flip works.
`rounded-token` is `border-radius: var(--radius)`. `text-body` is 13px/1.5, the
body size. Arbitrary values (`bg-[var(--surface)]`) also work if you prefer them.

Tailwind sources are `apps/web/src/**` plus an explicit
`@source '../../../packages/ui/src'` in `apps/web/src/styles.css` (auto-detection
does not walk into `node_modules`, and `@sector/ui` is a pnpm symlink). **If you
add a package whose components use Tailwind classes, add an `@source` line for it.**

### Typography and numerals

One sans stack (system UI), 13px body, 1.5 line height, set on `body`. The rem
scale is untouched, so Tailwind spacing is still 16px-based.

Numeric table columns must use tabular figures. `<TableCell numeric>` and
`<TableHeaderCell numeric>` apply it (plus right alignment) for you; the raw
utility is the class `sv-num`.

---

## 3. `@sector/ui` exports

### ThemeProvider

Already mounted at the app root. Do not mount a second one.

```tsx
const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
// theme:         'light' | 'dark' | 'system'   (what the user chose, persisted)
// resolvedTheme: 'light' | 'dark'              (what is actually painted)
// setTheme(t)    toggleTheme()
```

`system` removes `data-theme` from `<html>` so the media query decides; an explicit
choice stamps it. Persisted under `localStorage['sector.theme']`, guarded.

### Primitives

All are `forwardRef` and spread the rest of their native props. All take
`className`, merged with `cn()` (clsx + tailwind-merge) so your utilities win.

| Component    | Props beyond the native element                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`     | `variant?: 'primary' \| 'secondary' \| 'ghost' \| 'link' \| 'danger'` (default `primary`), `size?: 'sm' \| 'md' \| 'lg' \| 'icon'` (default `md`), `asChild?: boolean`. Defaults `type="button"` unless `asChild`.                         |
| `Input`      | `label?: ReactNode`, `error?: string`, `hint?: ReactNode`, `numeric?: boolean`. Renders its own `<label>`, wires `aria-invalid` / `aria-describedby`, and shows `error` (in `--crit`) or `hint`.                                           |
| `Badge`      | `tone?: 'neutral' \| 'accent' \| 'ok' \| 'warn' \| 'crit'` (default `neutral`)                                                                                                                                                             |
| `StatusPill` | `label: ReactNode`, `dot?: boolean` (default `true`), plus `tone`. A Badge with a leading tone dot.                                                                                                                                        |
| `Card` …     | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — plain divs, no extra props.                                                                                                                            |
| `Table` …    | `Table` (wraps itself in an `overflow-x-auto` div), `TableHead`, `TableBody`, `TableRow` (`interactive?`, `selected?`), `TableHeaderCell` (`numeric?`), `TableCell` (`numeric?`), `TableCaption`.                                          |
| `Dialog` …   | Radix re-exports: `Dialog`, `DialogTrigger`, `DialogClose`, `DialogPortal`, `DialogOverlay`, `DialogContent` (`hideCloseButton?`), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`. Every dialog needs a `DialogTitle`. |
| `Tabs` …     | Radix re-exports: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`. Underline active state in `--accent-ink`.                                                                                                                              |
| `Select` …   | Radix re-exports: `Select`, `SelectTrigger` (adds `placeholder?`), `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`.                                                                          |
| `Skeleton`   | plain div; give it size classes. `SkeletonTable` takes `rows?` (6), `columns?` (5), `className?`.                                                                                                                                          |
| `EmptyState` | `title: ReactNode`, `description?`, `icon?`, `action?`, `tone?: 'neutral' \| 'crit'`, `className?`. Covers nothing-yet, nothing-matched and request-failed (use `tone="crit"` + a retry button).                                           |

Also exported: `cn`, `buttonVariants`, `badgeVariants`, and the colour math
(`contrastRatio`, `relativeLuminance`, `meetsAA`, `parseHex`, `AA_NORMAL_TEXT`,
`AA_LARGE_TEXT`).

**Status pills:** `StatusPill`'s `tone` is deliberately domain-free. Map a scan
status with `scanStatusTone()` from the API client:

```tsx
import { SCAN_STATUS_LABEL, scanStatusTone } from '@sector/api-client';
import { StatusPill } from '@sector/ui';

<StatusPill tone={scanStatusTone(scan.status)} label={SCAN_STATUS_LABEL[scan.status]} />;
```

Icons: `lucide-react` is a dependency of `apps/web`, not of `@sector/ui`.
Size them `h-4 w-4` (or `h-5 w-5` in an EmptyState) and add `aria-hidden`.

---

## 4. `@sector/api-client`

### Conventions

- **Every failure throws an `ApiError`.** Nothing resolves with `{success:false}`.
  The legacy split (reads threw, writes returned an envelope) is gone.
- **Every response with a schema is `.parse()`d**, not cast.
- **All cache keys come from the factories.** Never hand-write a key string.
- The package imports no UI library, no toast and no router. Success and error
  messaging belongs at the call site.

### Client

Already created and provided at the app root (`apps/web/src/lib/api.ts`). Reach it
from a hook with `useApiClient()`.

```ts
const client = useApiClient();
const scan = await client.get('/api/scan/x/get', { schema: scanSchema, signal });
```

`client.get/post/put/patch/del(path, options)` and `client.request(path, options)`:

```ts
type RequestOptions<TOut> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown; // object -> JSON; FormData -> browser sets the boundary
  query?: QueryInput; // URLSearchParams-encoded; arrays become `a,b`
  schema?: ResponseSchema<TOut>; // Zod schema for the envelope's `data`
  requireAuth?: boolean; // default true
  signal?: AbortSignal;
  headers?: Record<string, string>;
};
```

When you type a schema variable by hand, use `ResponseSchema<T>` (exported), not
`ZodType<T>` — any schema using `.default()` has an input type that differs from
its output type and `ZodType<T>` will not match.

Envelope handling: the HTTP status decides. `status: 'error'` in a 2xx body is the
only other failure signal, and a **missing** `status` counts as success — which is
what makes the group-leader branch of `POST /api/scan-review/request` work.
A missing `data` key resolves to `undefined`.

### ApiError

```ts
class ApiError extends Error {
  kind: 'http' | 'network' | 'parse';
  statusCode: number;          // 0 for network/parse
  path: string;
  details: unknown;            // string | Zod-issue array | record, depending on route
  get isUnauthorized / isForbidden / isNotFound: boolean;
  fieldErrors(): Record<string, string>;   // -> react-hook-form setError()
}
isApiError(e)   isAbortError(e)
```

An aborted request re-throws the original `AbortError` untouched so React Query
records a cancellation, not a failure. Keep that in mind for autosave paths.

### List queries

```ts
buildListQuery<TKey>({ globalFilter?, columnFilters?, sorting?, pagination? }): QueryInput
```

- `globalFilter` -> `keyword`, dropped when blank. **Debounce it with
  `LIST_SEARCH_DEBOUNCE_MS` (600) before it enters a query key.**
- `columnFilters: { id: TKey; value: string | string[] }[]`; arrays comma-encode.
- `sorting: { id, desc }[]`; the field is checked against `ALLOWED_SORT_FIELDS`
  and falls back to `createdAt` — the server silently ignores anything else.
- `pagination: { pageIndex, pageSize }`, 0-based; converted to 1-based `page`.
  `pageSize` is clamped to `MAX_PAGE_SIZE` (100), the server's real cap.

Constants: `DEFAULT_PAGE_SIZE` (20), `MAX_PAGE_SIZE` (100), `LIST_SEARCH_DEBOUNCE_MS`
(600), `DEFAULT_SORT`, `ALLOWED_SORT_FIELDS`, plus helpers `normalizeSortField`,
`isAllowedSortField`, `clampPageSize`, `encodeQuery`.

Filter-key unions — **do not mix them up**, they are a real trap:

```ts
ScanListFilterKey = 'keyword' | 'status' | 'tags' | 'scanTypeKeys' | 'groupIds' | 'userIds';
SharedScanListFilterKey = 'keyword' | 'sharedBy' | 'scanTypeIds' | 'status';
//                                                  ^ ids on shared scans, keys on scan routes
```

### Cache key factories

```ts
type ScanListView = 'my' | 'pending' | 'reviewed' | 'expert' | 'expert-reviewed';
SCAN_LIST_VIEWS  // the five, as a readonly array

scanKeys.list(view, params)     scanKeys.listRoot(view)     // ['get-pending-scans', …]
scanKeys.detail(view, scanId)   scanKeys.detailRoot(view)   // ['get-pending-scan-by-id', id]
scanKeys.allListRoots()         // every list prefix, for a change that moves a scan
scanKeys.users(type)            scanKeys.userGroups()

noteKeys.list(scanId) / listRoot()
reviewKeys.credits() / groups()
sharedScanKeys.list(params) / listRoot() / detail(id) / detailRoot()
scanTypeKeys.list() / items(id) / filter() / full() / filterOptions() /
  organizations(userId) / orgList(orgId) / orgItems(orgId, scanTypeId) /
  orgForms(orgId, scanTypeId) / form(formId) / formsByIds(ids)
authKeys.session()
mutationKeys.*   // login, updateScan, addScanReview, addScanNote, uploadPresign, …
```

The string prefixes match the legacy ones (`get-scans`, `get-pending-scans`, …)
so prefix invalidation keeps working. Invalidate with the `*Root` helpers:

```ts
queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('pending') });
queryClient.invalidateQueries({ queryKey: scanKeys.detail('pending', scanId) });
```

**Invalidation graph to preserve** (from the legacy client; most used `onSettled`,
firing on error too, which is deliberate for the scan flows):

- update scan -> detail(view, id), listRoot(view)
- delete scan -> detail(view, id), listRoot for my/pending/reviewed
- add review -> listRoot + detail for pending and expert, keyed off
  **`review.scan`** (the scan id string), not `review.id`
- add/remove tag -> the three detail keys
- add/delete files, reset upload -> listRoot('my') + detail('my', id)
- file-details status -> detail keyed off the **request** `scanId`, not the response
- add/delete note -> note list + scan detail + my list (+ shared scan keys)
- every scan-review mutation -> `reviewKeys.credits()`

### Hooks

```tsx
useScanList({ view, filters?, enabled?, pollWhileProcessing? })  // -> Paginated<Scan>
useScan({ view, scanId, enabled? })                              // -> Scan
useScanUsers('pending' | 'reviewed', enabled?)                   // -> ScanUser[]
useScanUserGroups(enabled?)                                      // -> UserGroup[]
useLoginMutation()            // -> AuthSession; clears the query cache on settle
useRestoreSessionMutation()   // -> AuthSession from a refresh token
useApiClient()                // the ApiClient, for endpoints you add
```

`useScanList` keeps the previous page visible while the next loads
(`placeholderData: keepPreviousData`) and re-polls every `PROCESSING_POLL_MS`
(5000) while any row is `processing` — server-side render and de-identify finish
seconds after the upload, so without it a new scan sits on "Processing" forever.

Endpoint functions (usable directly if you need them outside a hook):
`login`, `getCurrentUser`, `getScanList`, `getScanById`, `getScanUsers`,
`getScanUserGroups`, `scanListPath(view)`, `scanDetailPath(view, id)`.

**Route paths per view** (note the missing `/get` on the expert details — that is
the server's shape, not a typo):

| view              | list                             | detail                          |
| ----------------- | -------------------------------- | ------------------------------- |
| `my`              | `/api/scan/list`                 | `/api/scan/:id/get`             |
| `pending`         | `/api/scan/pending/list`         | `/api/scan/pending/:id/get`     |
| `reviewed`        | `/api/scan/reviewed/list`        | `/api/scan/reviewed/:id/get`    |
| `expert`          | `/api/scan/expert/list`          | `/api/scan/expert/:id`          |
| `expert-reviewed` | `/api/scan/expert/reviewed/list` | `/api/scan/expert/reviewed/:id` |

### Types and schemas

```ts
Paginated<T> = { items: T[]; page; limit; totalItems; totalPages }
// no sortBy / sortOrder / expired — the legacy Items<T> declared them and the
// server sends none of them.
paginatedSchema(itemSchema)
```

Scan domain: `Scan` / `scanSchema`, `ScanReview`, `ScanFinding`, `ScanFormResponse`,
`ScanFormFieldPayload`, `ScanLog`, `FileDetail`, `EmbeddedScanNote`, `ScanNote`,
`ScanNoteList`, `ScanTypeRef`, `ScanUser`, `AiScanQuality`, `CompetencyMeasure`.

Common: `UserBasic`, `MediaFile`, `ScanGroupRef`, `UserGroup`, `FileStatusValue`,
plus helpers `userDisplayName(user)` and `isPendingFilePlaceholder(file)`.

Auth: `AuthSession`, `AuthUser`, `AuthRole`, `LoginPayload`, plus
`hasPermission(user, required)` and `hasAnyPermission(user, required)`.

Status: `ScanStatus`, `SCAN_STATUSES` (7 values), `SCAN_STATUS_LABEL`,
`scanStatusTone`, `StatusTone`, `hasProcessingScan`, `uploadOutcomeFor`,
`UploadOutcome`, `PROCESSING_POLL_MS`, `FileStatus`, `FILE_STATUSES`.

Upload: `sanitizeFilename`, `buildScanFilekey`, `extractFilekey`,
`putToPresignedUrl(url, blob, contentType, signal)` (returns `{ etag }`; bypasses
the API client because S3 rejects the Authorization header and sends no envelope).

### Wire drifts already handled — do not "fix" these

These were found by diffing the legacy Zod objects (which were never parsed)
against live responses. Each one would throw on first render with parsing on.

1. `scan.groups[]` is `{_id, name}` on **list** routes and `{id, name}` on
   **detail** routes. `scanGroupRefSchema` normalises both to `{id, name}`.
2. `reviewDetails` is **never sent** by any scan route, including the reviewed
   ones. Use `scan.review`.
3. `notes[].user` is modelled as `string | UserBasic`: it is populated on the
   routes observed, but the list mapper can emit a bare ObjectId.
4. Many "optional string" fields arrive as explicit `null`: `externalPatientId`,
   `processingError`, `acquisitionPointId`, `reviewText`, `stripeCustomerId`.
5. Form answer values are `string | number | boolean | string[] | null`, not
   `string`. Narrowing them breaks checkbox and number round-trips.
6. `files[].url` is nullable: the detail route substitutes the `pendingFiles`
   snapshot with ids `pending-0…` and null urls when a scan has no File docs.
   Detect with `isPendingFilePlaceholder(file)`.
7. Media URLs are presigned and **expire** — never persist them.
8. `GET /api/scan/:scanId/notes` is `{totalItems, items}` with no page/limit/
   totalPages. It has its own type, `ScanNoteList`. It is not `Paginated<T>`.

### Auth surface, including one real surprise

- `POST /api/login` takes **`userEmail`** (username or email) and `password`. The
  `eulaAgreement` checkbox on the legacy form was client-side only.
- **There is no bearer-authenticated "current user" route.** `GET /api/me` looks
  like one but is a refresh-token exchange: it reads `?refreshToken=`, ignores the
  Authorization header, **rotates** the stored refresh token and returns a fresh
  token pair. That is why session restore is a mutation, not a query, and why the
  response must be persisted.
- `login` returns `token` (the 7-day bearer the app uses), plus `accessToken`
  (15m), `refreshToken` (30d) and their TTL strings.
- **Auth routes are rate limited to 20 requests per 15 minutes per IP**, and both
  `/api/login` and `/api/me` count against it (`authRateLimit`). A burst of
  sign-ins while testing will start returning 429 with
  `RateLimit-Reset` seconds remaining. Reuse a session rather than signing in
  per test.
- `user.role.permissions` drives every server guard. Observed scan permissions:
  `view:scan`, `read:scan`, `create:scan`, `edit:scan`, `delete:scan`,
  `view:scan:pending[:group]`, `view:scan:reviewed[:group]`,
  `view:scan:pending:expert[:group]`, `view:scan:reviewed:expert[:group]`,
  `create:scan:review`, `create|read|delete:scan:note`.

### What exists, and where to add more

All of the surfaces below are implemented; the barrel
`packages/api-client/src/index.ts` is the authoritative list of exports.

| File family                                                                           | Covers                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `schemas/scan.ts`, `endpoints/scan.ts`, `react/use-scans.ts`                          | the five scan list views + detail                     |
| `schemas/shared-scan*.ts`, `endpoints/shared-scan-list.ts`, `endpoints/scan-share.ts` | shared scans: list, detail, create/delete share       |
| `schemas/scan-review-submit.ts`, `endpoints/scan-review-submit.ts`                    | POST /api/scan/:id/review                             |
| `schemas/scan-review-credits.ts`, `endpoints/scan-review-credits.ts`                  | the expert-review credit economy (/api/scan-review/*) |
| `endpoints/scan-note.ts`, `react/use-scan-notes.ts`                                   | scan notes (read + add; DELETE is not wired)          |
| `schemas/scan-type.ts`, `schemas/scan-type-filter.ts`, `endpoints/scan-type*.ts`      | scan types, findings, filter options                  |
| `schemas/scan-payloads.ts`, `endpoints/scan-write.ts`, `endpoints/scan-upload.ts`     | create scan, file status, presign + multipart         |

To add a domain: one schema file, one endpoint file, one hooks file, one export
block in the barrel. **Do not widen a file that models a different route
family.** `scan-review-submit` and `scan-review-credits` are separate for exactly
that reason — an earlier pass had two competing `scanReviewResultSchema`
definitions, one of which would have thrown on the real POST response because it
typed `scan` as a string where the submit route returns an object.

Known legacy defects to **not** reproduce:

- `exportGroupsUserScans` sent `type`; the server wants **`format`** (`'xlsx'|'csv'`).
  A CSV request always produced xlsx.
- `GET /api/scan-review/credits/groups` is not a registered route and 404s. The
  real one is `GET /api/scan-review/groups`, returning `{groupId, groupName, credits}[]`.
- `purchaseCredits` typed `accountType` and `accountId` optional; the server
  **requires** both.
- `createSharedScan` is typed as returning one `SharedScan`; it actually returns
  `{sharedScans, duplicateEmails, notFoundEmails}`. Surface the last two in the UI.
- The function named `uploadInit` pointed at the **v2** route while `uploadChunk`
  and `uploadComplete` pointed at the legacy ones. Name the new ones
  `multipartUploadInit` / `multipartUploadPart` / `multipartUploadComplete`.

---

## 5. Routing

`apps/web/src/app/router.tsx`:

```
/login                          LoginPage (public)
  └─ <RequireAuth>              redirects to /login?from=<path> when signed out
       └─ /  <AppShell>         sidebar + topbar, content in <Outlet/>
            ├─ index            VaultIndexRedirect -> first permitted surface
            ├─ ...scanVaultRoutes   the six Scan Vault tab paths
            ├─ ...featureRoutes     scan detail + create-scan
            └─ *                NotFoundPage (inside the shell)
```

The catch-all lives INSIDE the shell on purpose, so an unknown URL from a
signed-out visitor goes through RequireAuth to /login and back rather than
dead-ending on a 404 they cannot act on.

### The two mounting points

They are separate so parallel edits land in different files:

- **`apps/web/src/app/scan-vault-routes.tsx`** owns the six Scan Vault tab paths
  and their permission gates. Swapping the page behind a tab is one line there.
  Paths, permissions and titles all come from
  `features/scan-list/scan-list-views.ts`, so the router, the sidebar and the
  in-page tab bar cannot disagree about a URL.
- **`apps/web/src/routes/feature-routes.tsx`** is where every OTHER feature
  surface registers.

The registered URLs are:

```
/scans/my                       /scans/my/:scanId
/scans/shared                   /scans/shared/:shareId
/scans/group/unreviewed         /scans/group/unreviewed/:scanId
/scans/group/reviewed           /scans/group/reviewed/:scanId
/scans/expert/unreviewed        /scans/expert/unreviewed/:scanId
/scans/expert/reviewed          /scans/expert/reviewed/:scanId
/scans/create                   the create-scan wizard
/scans, /scans/group, /scans/expert   redirect to the tab's first surface
```

Note there is no `/scans/pending`, `/scans/reviewed` or `/scans/expert-reviewed`:
those are view _ids_, not paths. Build links from `SCAN_VAULT_PATH` and the
builders in `features/scan-detail/scan-detail-links.ts` rather than by hand.

### Adding a route

**`apps/web/src/routes/feature-routes.tsx` is the only file you edit to add one.**

```tsx
import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/auth/require-auth';
import { ScanExportPage } from '@/features/scan-export/scan-export-page';

export const featureRoutes: RouteObject[] = [
  {
    element: <RequirePermission required="view:scan:pending" />,
    children: [{ path: 'scans/export', element: <ScanExportPage /> }],
  },
];
```

- Paths are **relative** to `/` — write `'scans/export'`, not `'/scans/export'`.
- A session is guaranteed inside; `useAuth().user` is non-null.
- Gate with `<RequirePermission required={…} />` as a pathless layout route rather
  than checking permissions inline. It accepts a string or an array (all must
  match) and an optional `fallback`. **The default is the 403 page, not a
  redirect** — a silent bounce to the index hides the reason and looks like a
  broken link, so the fallback page names the missing permission.
- The shell owns the page `<h1>` (the topbar renders the section name). A feature
  page renders its own `<h2>`; rendering an `<h1>` produces two on the page.
- Keep the array flat, one import per feature area, so four agents editing it in
  parallel produce separable diffs.

URL state for tables: `nuqs` is installed in `apps/web`. The legacy list pages put
`keyword`, `page` (1-based), `limit`, `sort` (JSON) and `filters` (JSON) in the
query string, and reset `pageIndex` to 0 when the keyword or filters change but not
when sorting changes. `@tanstack/react-table` is installed too.

---

## 6. Auth context

`apps/web/src/auth/auth-context.tsx`. Already mounted.

```tsx
const {
  status, // 'restoring' | 'authenticated' | 'anonymous'
  user, // AuthUser | null
  token, // string | null — the client reads this itself, you rarely need it
  signIn, // (payload: LoginPayload) => Promise<AuthUser>; throws ApiError
  signOut, // () => void — clears storage and the query cache
  can, // (permission: string | string[]) => boolean, ALL must match
  canAny, // (permissions: string[]) => boolean, ANY matches
} = useAuth();
```

- The session lives in `localStorage['sector.session']` through
  `createSessionStore()`. **One writer.** Do not touch localStorage for auth
  yourself and do not read `localStorage['token']` (the legacy key) — it is unused.
  The single exception is `app/storage-migration.ts`, which renames the
  pre-Sector `scanvault.session` key once, in `main.tsx`, before the first
  render and therefore before anything can read it. It is not a second writer
  at runtime, and it is the only code that may ever be one.
- `read()` **validates** against `authSessionSchema` rather than casting, so its
  `AuthSession | null` is true for every caller and no consumer has to re-check
  the parts it touches. A stored value that does not parse is removed and the
  user is signed out, not handed through half-formed.
- On boot, if a refresh token is stored, `status` is `'restoring'` while
  `GET /api/me` runs. `RequireAuth` renders skeletons during that window, so a
  deep link does not flash the login page.
- **Any 401 from any request clears the session**, via the `onUnauthorized`
  callback wired in `apps/web/src/lib/api.ts`. The transport never navigates
  itself; `RequireAuth` does the redirect once `status` flips to `'anonymous'`.
- `signIn` throws an `ApiError` on bad credentials. `error.message` is the server
  message and `error.fieldErrors()` maps validation details onto field names — see
  `LoginPage` for the pattern.

---

## 7. Conventions

- Kebab-case file names, descriptive and long enough to be greppable.
- Comments explain **why**, not what. Non-obvious server behaviour gets a comment
  at the point of use.
- Never reproduce the legacy toast-inside-a-hook pattern; messaging lives at the
  call site.
- Before opening a PR: `pnpm -w typecheck && pnpm -w test && pnpm -w lint`.
- After adding or changing a response schema, also run
  `SECTOR_DEMO_PASSWORD='…' pnpm --filter @sector/api-client test:live`.
