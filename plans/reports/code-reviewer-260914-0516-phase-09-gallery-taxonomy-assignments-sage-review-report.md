# Phase 9 review — pathology gallery, scanTypeId taxonomy, assignments, Sage

Reviewed: `feat/sector` @ `338b420` (web, phase-09 commits `427b46c`, `77f28e0`) and `feat/sector-api` @ `090b2751` (API, commit `58d3b5a4`) in `scratchpad/wt/api`.
Implementer report checked: `plans/reports/fullstack-developer-260914-0046-phase-09-gallery-assignments-sage-report.md`.

## How I verified

- **Mirror** (`gusi_prod_mirror`, localhost:27017, read-only queries via mongoose). Confirmed first that :27017 is the local `mongo-test` container (`hello.hosts = ['localhost:27017']`, rs0), reached through Colima's port-forward — not a tunnel.
- **Migration re-run** against a throwaway copy (`rev_p09_idem`) of `pathologygalleries` + `scantypes` with `scanTypeId` unset, using the real script under Node 22. Dropped afterwards; mirror re-checked unchanged (1305 docs / 1288 mapped).
- **API**: curl against the shared mirror API on :5002 (GET only). It *is* running this phase's controller — `/categories` serves from the relation and `scanTypeId` filtering works (296 Echo, bogus id → 0). The implementer's note that :5002 lacks the code is now stale.
- **Browser**: Playwright against the shared dev server :3101 with minted sessions for `learner@sector.test` (subscriber) and `leader@sector.test`.
- **Schemas**: ran the repo's own `assignmentListResponseSchema` and the `pathologygalleries` fidelity entry.
- Nothing was pointed at `mongodb.net`. No migration was run against anything but localhost.

---

## Blockers

### B1. The assignments surface is dead code — its URL belongs to the group-admin panel

Two route objects declare the identical path `administer/groups/:groupId/assignments`:

- `apps/web/src/features/groups/groups-routes.tsx:68` → `GroupAssignmentsPanel`, under `RequirePermission required="read:group"`, spread into `featureRoutes` at index 41.
- `apps/web/src/features/assignments/assignments-routes.tsx:23` → `AssignmentsSurface`, under `read:group-assignment`, spread at index 45.

Both constants are even named `GROUP_ASSIGNMENTS_ROUTE_PATH` (`groups-links.ts:63`, `assignments-links.ts:63`), same value. Equal specificity → first wins.

Verified in the browser as `leader@sector.test` at `/administer/groups/6a6ae3d759ab84398c7cee4f/assignments`: the page issues `/api/group-assignment/group-courses`, `/learners`, and `/group/:groupId?page=0&limit=20&assignmentType=course`, renders the tab strip plus "New assignment" and "No assignments yet". Those are the group-admin panel's calls. The phase-09 surface would have issued `/api/group-assignment?groupId=…` and rendered a keyword input plus two selects — neither appeared.

So `AssignmentsSurface`, `useGroupAssignments`, `getGroupAssignments`, `schemas/assignment.ts` and the whole `assignments` i18n namespace (×7 locales) are unreachable. `grep` finds no other reference to `AssignmentsSurface`. The legacy `/dashboard/manage-group/:groupId/assignments` redirect (`legacy-route-map.ts:78`) lands on the group-admin panel too, i.e. on the course-only "No assignments yet" bug.

This answers "does this side agree on shape and route": **no** — same URL, different route, different envelope (`{assignments, pagination{total,skip,hasMore}}` vs `paginatedSchema`), different item schema, different hook. The merge-time reconciliation renamed the symbols and de-duplicated the enums but left two components fighting over one URL. Nothing catches it: the cold-load sweep sees a healthy page, and `nav-config.test.ts` does not cover assignments because it has no nav entry.

Fix: decide which surface owns the URL, delete the other, and add a test asserting route-path uniqueness across `featureRoutes`.

### B2. The migration rewrites `updatedAt` on every mapped row, every run — and already has

`setScanTypeIdForCategory` (`pathology-gallery.service.ts`) issues `updateMany(..., { $set: { scanTypeId } })` on a `timestamps: true` schema with no `{ timestamps: false }`. Mongoose adds `$set: { updatedAt: now }`, so every run rewrites all matched documents whether or not the value changed.

Evidence on the mirror — `updatedAt` × mapped:

```
2022-01-24 unmapped 5      2022-02-11 unmapped 7   2022-02-14 unmapped 1
2022-02-15 unmapped 1      2022-02-16 unmapped 2   2022-02-22 unmapped 1
2026-09-13 mapped 1288
```

All 1,288 mapped rows now carry the migration's timestamp; only the 17 deliberately-unmapped rows kept their real content timestamps. Evidence on the copy: after two live runs, 1288/1288 documents had `updatedAt` later than the mirror's, and run 2 still reported `Documents mapped: 1288` (`modifiedCount` is non-zero purely because of the timestamp write).

Consequences: the content "last updated" date of the entire gallery is destroyed and **cannot be restored without a backup** — this is the one genuinely irreversible part of the change. The `scanTypeId` field itself is trivially reversible (`updateMany({}, {$unset:{scanTypeId:''}})` restored 1,288 docs on the copy in one statement), so "reversible without a restore" is true for the relation and false for the timestamps.

Fix before this runs anywhere else: `{ timestamps: false }` on the updateMany, and narrow the filter to `scanTypeId: null` so a re-run is a genuine no-op.

### B3. The read surface targets the unscoped assignment route; PII of every group is readable

`GET /api/group-assignment` (`getGroupAssignments`, `group-assignment.controller.ts:407`) applies `withPermission([READ_GROUP_ASSIGNMENT])` and then filters by whatever `groupId` the caller sends. No membership check, no leadership check, and with no `groupId` it returns every row. The sibling route `GET /api/group-assignment/group/:groupId` (line 285) *does* check active membership unless the caller has full access.

Proven with a minted token for `learner@sector.test` (role `subscriber`, member of `6aa6ee55…` only) against :5002:

- `/api/group-assignment?groupId=6a6ae3d759ab84398c7cee4f` → **HTTP 200**, rows for a group they do not belong to.
- `/api/group-assignment/group/6a6ae3d759ab84398c7cee4f` → **HTTP 403** "You do not have permission to view assignments for this group".
- `/api/group-assignment` with no `groupId` → **HTTP 200**, `total: 8720`, populated `user` objects carrying real student names and emails (`SZimmer628045@student.wmcarey.edu`).

The `roles` collection contradicts the comment in `assignments-routes.tsx` ("a bare subscriber does not [hold `read:group-assignment`]"): `subscriber` holds `read:group-assignment` and `view:group-assignment`; `administrator` and `Superadmin` do not (they rely on `full-access`).

Today the browser path is accidentally blocked by B1 (the `read:group` layout wins; the subscriber sees "Access denied"), so the live exposure is the API, which predates this phase. But the phase chose the unscoped route for a UI whose `groupId` comes straight from the URL. If B1 is fixed by giving this surface the URL, the IDOR becomes reachable in the product for every subscriber. Move this surface onto `/group-assignment/group/:groupId`, and raise the server-side gap separately.

### B4. A row whose learner no longer resolves fails the schema and empties the page

`assignmentSchema` declares `user: userBasicSchema` (non-nullable). Mongoose `populate` yields `null` when the referenced document is missing, and `User` carries `softDeletePlugin`, whose `pre('find')` injects `deletedAt: null` — so a soft-deleted (deactivated) learner populates to `null` in production, not just in a partial mirror.

Ran the repo's own schema over two live responses:

```
rev-ghost-page.json (group 68e4b330…) -> PARSE FAILS: assignments.0.user Expected object, received null (…1,2,…)
rev-page20.json     (group 6a6ae3d7…) -> PARSES OK, 20 rows
```

On the mirror that is 3,955 of 8,720 rows — the largest group — rendering the error EmptyState instead of a table. The group the implementer spot-checked happens to be one where users resolve, which is why "verified against a live mirror response" missed it. `user` must be `.nullable()` with a display fallback (`userDisplayName` also needs a null guard). The group-admin side has the same hole (`z.union([z.string(), userBasicSchema])` rejects null too) — worth telling that phase.

---

## Should fix

### S1. An unknown `?category=` leaves the gallery loading forever

`gallery-page.tsx` computes `canFetchList = category && isSuccess && selectedCategory`. When the URL names a category the server no longer returns, `selectedCategory` is `undefined`, `canFetchList` is false, and the first branch renders 20 skeletons with no empty state and no error. `CategoryBar`'s auto-select effect is guarded on `!selected`, so it does not heal it.

Browser, `/learn/gallery?category=Rapid%20Reviews%20OLD`: `selected tab: []`, `skeleton placeholders: 20`, `cards: 0`, no "no items"/error text. That is defect #1 (unhighlighted category, empty grid) reached through a bookmark. It is not hypothetical: the moment the user maps `FAST/EFAST` or retires `Rapid Reviews`, every existing link to those categories becomes exactly this. Fall back to the first category (or show an empty state naming the missing category) when the URL category is not in the loaded set.

### S2. Re-running the migration silently reverts curator corrections

The `updateMany` matches on `category` alone and overwrites `scanTypeId` unconditionally. On the copy I set one `Echo` item to `Echo v5` (a plausible manual correction), re-ran, and it came back `Echo v2`. Items whose category names no scan type (`FAST/EFAST` → `eFAST v6`) survive, because the category is skipped entirely — but they are still reported as "unmapped, 2 items" afterwards, since the unmapped count is `countDocuments({category})` regardless of `scanTypeId`. Add `scanTypeId: null` to the filter and count what actually changed.

Interrupted runs are fine: I stripped `scanTypeId` from 181 `Lung` docs, re-ran, got 181/181 back.

### S3. The migration cannot be run as documented, and the guard's message will mislead

`src/config/env.ts` `parse`s `AWS_SECRET_MANAGER_KEY` and `AWS_SECRET_MANAGER_REGION` as **required** at import time. The header's documented command (`MONGODB_URI=… npx tsx … --dry-run`) dies with a Zod error before reaching the guard — there is no `.env` in `wt/api`; I had to supply dummy AWS vars to run it at all.

Worse, `secrets.get('MONGODB_URI')` prefers AWS Secrets Manager and only falls back to `process.env.MONGODB_URI`. On a machine with working AWS credentials the `MONGODB_URI` the operator typed is **ignored**, the URI comes from the secret, and the guard refuses a host the operator never typed. That is precisely the confusion that gets a guard commented out. Two concrete improvements: read the URI from `process.env.MONGODB_URI` directly in the script (not through `secrets`), and say so in the refusal message.

On the guard itself — it holds. Verified with a harness copying `assertLocalMongoUri` verbatim:

| URI | Result |
|---|---|
| `mongodb://localhost:27017/gusi_prod_mirror?directConnection=true` | allowed |
| `mongodb://127.0.0.1:27017/…` | allowed |
| `mongodb+srv://…@gusi-cluster-production.6ljc5.mongodb.net/…` | refused (Atlas branch) |
| `mongodb://…@prod-db.internal.example.com:27017/…` | refused (non-local) |
| `mongodb://LOCALHOST:27017/db` | refused (`mongodb:` is not a special scheme, so the host is not lower-cased) |
| `mongodb://[::1]:27017/db` | refused |
| multi-host replica-set form (Atlas or mixed) | **throws `TypeError: Invalid URL`** |

Two notes on the throw. First, the thrown error carries `error.input` = the whole URI, and `main().catch(error => console.error(error))` prints own properties — so running the script with a production replica-set string **prints the password to the console/CI log**. Second, nothing else in the script or the endpoint reaches a host: `connectDB()` re-reads the same 5-minute-cached secret in the same process, so the asserted string and the connected string cannot diverge; the controller never opens a connection of its own. The one bypass the guard cannot see is a local port that forwards elsewhere — Colima already forwards :27017 on this machine, so "localhost" is a network claim, not a database identity. Cheap hardening: assert the database name too.

### S4. Mapping is complete and internally consistent, but pinned to a five-generation-old taxonomy

Every mapped category resolves to an identically-named, active, non-deleted, icon-bearing ScanType — all of them **version 2**:

```
AAA→AAA v2(28)  DVT→DVT v2(73)  Echo→Echo v2(296)  FASH→FASH v2(40)  FAST→FAST v2(143)
GI→GI v2(56)  Gallbladder→Gallbladder v2(135)  Lung→Lung v2(181)  MSK→MSK v2(124)
OB 1st Tri v2(92)  OB 2nd/3rd v2(23)  Renal v2(47)  Soft Tissue v2(50)   = 1288; 0 dangling ids
```

Checked by joining `pathologygalleries.scanTypeId` back to `scantypes` for all 1,305 rows, and by eyeballing individual titles (`Echo / Ascend Aortic Aneurysm / "Asc Aortic Aneurysm1 (> 3cm)"` → `Echo v2`; `MSK / Ankle / "Normal Achilles 1"` → `MSK v2`). Counts reproduce exactly (1288 mapped / 17 unmapped) on an independent copy. No name is ambiguous: there is never more than one live v2 document per name.

But `scantypes` runs to **v6**, across two organisations, and the newest generation renames things: live `scans` reference `Vascular v6` (3,794), `Cardiac / Echo v6` (3,292), `OB 2nd/3rd v4` (3,495), down to v1. `MSK` was split into `MSK - Shoulder/Knee/…` at v3+. So the gallery's new relation can never join to a scan's `scanType`, and it binds the gallery to an org-specific v2 lineage.

"Prefer v2" is inherited faithfully from the legacy read path (`categoryVersions.find(v => v.version === 2) || …`), so this is not a regression in what users see. But that rule was a display heuristic; it is now **stored data** and the backbone of the ontology work. Which generation the gallery should point at is the same class of clinical/product decision that was correctly escalated for `FAST/EFAST` — it just was not escalated for the other thirteen. Flagging, not proposing a remap.

(For the record when the user decides: an `eFAST v6` scan type exists, `6a75600020e8f010851b642e`, org `6a75589d…`. I did not touch it.)

### S5. A category can still vanish silently — the whitelist defect through a different door

`computePathologyCategories` maps distinct ids through `scanTypeService.getById` and then `.filter(scanType => scanType !== null)`. An id that no longer resolves drops the category from the bar entirely, and its items are *not* picked up by `getUnmappedCategoryNames()` (which requires `scanTypeId: null`), so they become unreachable: no button, and the grid only loads for a selected category. That is the same "server returns it, client hides it" failure the relation exists to remove. Today nothing dangles (13/13 resolve) and `getById` happens to ignore `deletedAt`, so a soft-delete does not trigger it — but a hard delete or a bad write does, and no test covers it. Either report unresolvable ids as unmapped entries, or fail loudly.

### S6. The assignments keyword filter can only ever return nothing

`buildFilterQuery` maps `keyword` to `$or: [{title: …}, {description: …}]`, and `groupassignments` documents have neither field (`_id, group, author, assignmentType, contentRefModel, contentId, courseId, lessonId, topicId, user, assignedAt, completedAt, dueDate, status, …`). Confirmed against :5002: `keyword=Pulmonology` — the literal `contentId.title` of the first row in that group — returns `total: 0`. `keyword=a` likewise. The surface's search box is a "clear the table" control. It is also un-debounced, so it fires one request per keystroke.

### S7. 92 KB and 1.8 s per page of 20 assignments, 80% of it never rendered

`GET /api/group-assignment?groupId=…&limit=20` → 92,688 bytes in 1.78 s; `contentId` alone is 73,500 of those bytes (3,675 per row) because the API populates the **entire** content document, including lesson HTML. The table renders `contentId.title` and nothing else. Same class of waste as the serial presigns this phase removed from the gallery. A `select` on the populate path fixes it server-side.

### S8. Two query-key builders produce the same namespace for two incompatible shapes

`assignmentKeys.list(groupId, params)` and `groupKeys.assignments(groupId, params)` both build `['get-group-assignments', groupId, params]`, for responses of different shape (`AssignmentListResponse` vs `Paginated<GroupAssignment>`). Today the `params` objects differ so no cache entry actually collides, and the shared prefix means the create mutation's invalidation reaches both — accidentally correct. It is a live trap for the next person who aligns the params. Give one of them its own root.

---

## Nits

- `getAllSubCategoriesByCategory` still keys on free-text `category` and applies no `status` filter, while the grid filters on `scanTypeId` + `status=published`. Rename a ScanType and the rail silently empties while the grid keeps working; publish state disagrees between rail and grid. The rail also has no error branch — a failed request renders as "only All".
- `usePathologyCategories` sets no `staleTime`, so the bar refetches on every mount (browser: a return visit re-issued `/categories`). Cheap given the server cache, but "cached" is server-side only.
- `computePathologyCategories` has no in-flight dedupe, so N concurrent requests on a cold cache each do the full join + presigns. Trivial at 13 scan types; note it if the set grows.
- Sorting moved from Mongo's `distinct` order to `localeCompare`, so `Gallbladder` now precedes `GI`. Cosmetic, just not mentioned anywhere.
- `getPathologyCategories` takes an unused `req`.
- Pathology `keyword` goes into `$regex` unescaped (pre-existing, untouched).
- Sage: no `sandbox` or `referrerPolicy` on the iframe, and the `loading` overlay has no timeout — if the frame never loads, the overlay covers it forever (the implementer's own sandbox hit exactly that and read it as environmental).

---

## Answers to the specific questions

**Is the mapping correct, not merely complete?** Complete and internally consistent — see S4 for how I checked and for the one judgement embedded in it (v2 out of a v6 lineage) that deserves the user's sign-off.

**Idempotent?** In value, yes. In writes, no — B2. Re-runs also revert manual corrections — S2.

**Interrupted run?** Converges. Verified by stripping 181 rows and re-running: 181/181 restored.

**Reversible without a restore?** The relation, yes — one `$unset` put 1,288 documents back. The `updatedAt` it overwrote, no — B2. Rolling the API code back without the data is safe: the old controller ignores `scanTypeId`.

**Does the guard hold?** Yes for every URI shape I could construct (table in S3). It cannot see a forwarded local port, and the multi-host throw both confuses and leaks the credential — S3.

**Would that error tempt someone to disable the guard?** Yes, but the likelier trigger is the secrets-precedence trap: the documented command does not run, and when it does run on an AWS-configured machine the `MONGODB_URI` the operator typed is ignored and the guard names a host they never chose.

**The gallery's three defects:** none reproduced on the happy path. Cold first visit issues one `/categories` request, auto-selects `AAA` (`aria-selected="true"`), renders 20 real cards, and makes exactly one list request — `?status=published&page=1&limit=20&scanTypeId=67f290f8…`. No unfiltered fetch. Defect #1 does return via a stale URL — S1.

**Does the cache cache?** Yes, server-side, and the functional test proves it (a category published after the first request stays absent until `resetPathologyCategoriesCache()`). Cold path: computed on demand; nothing is cached on error, so a presign failure retries rather than poisoning. No client-side caching beyond a render — S-nit.

**Does an item outside the old 13-name whitelist render?** Yes. There is no whitelist anywhere in the client. All 15 categories render as tabs; clicking `FAST/EFAST` selects it and shows exactly `eFAST Anatomy` and `eFAST Pathology`. Both unmapped categories are reachable with their full counts (`Rapid Reviews` 15, `FAST/EFAST` 2) — all 17 visible, none hidden.

**Sage, unentitled user:** there is no entitlement check. `SageFrame` renders for any signed-in user; `if (!user)` only covers the pre-session-restore instant. The legacy nav entry (`gusi_web_dashboard/src/config/links.ts:141`) carries no `permissions` and no `featureFlag` — unlike its sibling Interpretation Challenge, which does — so the port is faithful and nothing was dropped. If an entitlement was expected, it never existed on either side. Nothing sensitive rides in the frame URL: `?use_iframe&allow_selection=true&user=<userName>` only, no token, no email, no id — the port even adds `encodeURIComponent`, which legacy lacked. `userName` is still an unauthenticated identity assertion the tutor trusts, and it lands in history and `Referer`; pre-existing.

**Assignments, did the merge break either caller?** Not by name: `assignments-surface.tsx` → `useGroupAssignments` and `group-assignments-panel.tsx` → `useAssignmentsForGroup` both resolve, the enums live once in `schemas/assignment.ts` and are re-exported from `schemas/group-assignment.ts`. The break is structural — B1.

**Does this side agree with the group-admin side on shape and route?** No. Different route, envelope, item schema and hook, on the same URL. This side does *not* reproduce the course-only filter — it queries all four `assignmentType`s (mirror: module 4,265, topic 4,092, course 376, quiz 1), which is the correct behaviour of the two. When the other side's filter is fixed, one of the two implementations should simply be deleted.

**Fidelity exceptions:** true, not convenient. I re-ran the replay: `pathologygalleries → GET /api/pathology-gallery item 1305/1305 = 100.00%`. The `.nullish()` justification checks out — 17 documents have no `scanTypeId` key at all (`missingField: 17`, `explicitNull: 0`) while the API sends `null` for them via the schema default, and I confirmed the wire carries the key. `pathologyCategorySchema` genuinely is a per-request join. The assignment exceptions are also genuine (polymorphic `contentId`), **but** the substitute — "verified against a live mirror response" — was one row, of one type, from one group, and it missed B4. The manifest text overstates the coverage.

---

## Recommended actions

1. B1 — resolve the duplicate `administer/groups/:groupId/assignments` route; add a uniqueness test over `featureRoutes`.
2. B2 — `{ timestamps: false }` plus a `scanTypeId: null` filter before the script runs anywhere but a mirror; decide whether the mirror's lost `updatedAt` values matter enough to re-clone.
3. B3 — point the read surface at `/group-assignment/group/:groupId`; correct the false subscriber claim in `assignments-routes.tsx`; raise the unscoped `GET /api/group-assignment` with whoever owns that controller.
4. B4 — make `user` nullable on both assignment schemas and give `userDisplayName` a fallback.
5. S1 — fall back to the first category when the URL names one that no longer exists.
6. S4 — get a decision on the v2 pin alongside the `FAST/EFAST` / `Rapid Reviews` decisions; they are the same question.
7. S3, S5, S6, S7 — as described.

## Plan status

Phase-09 acceptance claims that hold as written: the relation and its index, the cached relation-backed category endpoint, the absence of any client whitelist, the visibility of all 17 unmapped items, the gallery's three defect fixes on the happy path, the seven-locale parity, and the 100% fidelity replay. Claims that do not: "mounted at `/administer/groups/:groupId/assignments`" (B1), "gated correctly" and "a bare subscriber does not [hold the permission]" (B3), and "verified against a live mirror response" for the assignment shape (B4). I did not re-run `typecheck`/`lint`/`test`/`build`: two agents are editing `features/courses/**` and `features/groups/**` right now and the results would not be attributable. Leaving plan-file updates to the lead.

## Unresolved questions

1. `FAST/EFAST` and `Rapid Reviews` — unchanged; still the user's clinical/product call. Untouched here.
2. Which ScanType generation should the gallery relation point at — v2 as ported, or the current live generation with its different names (S4)?
3. Which of the two assignment implementations survives B1, and does the surviving one keep all four assignment types or only course-level?
4. Does production actually contain assignments whose learner is soft-deleted? The mirror's `users` collection is partial, so I could prove the mechanism but not the production frequency (B4).
5. Should the read side stay read-only? The write half now exists on the group-admin side, which weakens the original scope-cut rationale.
