# Sector port — remaining work after phases 1–10

**Date:** 2026-09-14 · **Source:** five read-only audit sweeps + a completeness critic (workflow `wf_1f3efb6f-23c`), verified against `feat/sector` at `83971b5` and the API worktree on `feat/sector-api`. Generated from the agents' structured returns; wording is theirs, grouping is the controller's.

**Since the audit ran:** `fix/sector-home-dashboards` and `fix/sector-gallery` merged into `feat/sector` (`7e8edb3`); typecheck and lint clean; 1,220 tests pass (ui 127 / api-client 221 / web 872). Items below that named those two branches as unmerged are now closed and marked.

**Totals:** 105 items — 23 blocker, 55 significant, 27 minor; plus 10 critic findings. By owner: 40 engineering, 26 other team, 39 user decision, 0 unknown.


## Blockers (23)

### scanvault has no git remote at all, so deploy.yml can never fire

*phase11 · needs: other-team*

`git remote -v` in /Users/lap16299/Documents/code/gusi-lms/scanvault returns nothing — the repo is local-only. .github/workflows/deploy.yml triggers on `push: branches: [main]`, which requires a GitHub-hosted origin. Success criterion "Sector deploys from a branch push, like the repo it replaces" cannot be true until the repo is created and pushed under the gusi-dcm org. (Memory note also records that gh CLI cannot see the org.)

**Evidence:** ``git remote -v` (empty) in /Users/lap16299/Documents/code/gusi-lms/scanvault; .github/workflows/deploy.yml:8-12`

### The two API auth fixes exist only on local, unpushed branches — never merged, never deployed

*phase11 · needs: engineering*

Both defects are genuinely fixed with tests in the api worktree on feat/sector-api: 982d03d7 + 50e7a7a5 + 514a632e (per-session refreshtokens collection, legacy users.refreshToken fallback, revocation on password change/delete) and ae125a28 (meRateLimit, 300/15min, pulls GET /me off authRateLimit's 20/15min/IP). But in the API repo `git branch -r --contains ae125a28` returns nothing, feat/sector-api has no upstream, and it is 30 commits ahead of origin/main (last origin/main commit 641c38d0, 2026-09-10). Criteria "A second device does not sign the first one out" and "A classroom on one IP can all sign in" are unmet against any deployed API.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/gusi_nodejs_api: `git branch -r --contains ae125a28` empty; `git rev-list --count origin/main..feat/sector-api` = 30; `git for-each-ref refs/heads/ --format='%(upstream:short)'` blank for all feat/sector-* branches`

### AWS IAM role SectorS3GithubRole, the S3 bucket, the CloudFront distribution and five GitHub secrets do not exist

*phase11 · needs: other-team*

deploy.yml assumes `arn:aws:iam::${{ secrets.PROD_AWS_ACCOUNT_ID }}:role/SectorS3GithubRole` plus PROD_AWS_REGION, PROD_AWS_BUCKET_NAME, PROD_AWS_CLOUDFRONT_DISTRIBUTION_ID and PROD_VITE_API_URL. The workflow's own comment concedes this is unprovisioned: "whoever provisions this repo's bucket and distribution should register secrets under these same names." No terraform, no infra doc, no provisioning ticket anywhere in the repo (grep for SectorS3GithubRole outside plans/ finds nothing).

**Evidence:** `.github/workflows/deploy.yml:128-141; grep -rniI 'SectorS3GithubRole' outside plans/ returns nothing`

### deploy.yml lives only on feat/sector; main is 155 commits behind and contains none of the app

*phase11 · needs: engineering*

The workflow triggers exclusively on push to `main`, but `git ls-tree main --name-only` shows no .github directory, and `git rev-list --count main..feat/sector` = 155. main's newest commit is 566cf3e "docs: plan Sector..." — plan documents only. Even with a remote and AWS provisioned, nothing deploys until feat/sector (plus the two unmerged fix branches) merges to main, and that merge is itself ungated because no PR workflow exists.

**Evidence:** ``git ls-tree main --name-only` (no .github); `git rev-list --count main..feat/sector` = 155; `git log -1 main` = 566cf3e`

### Six Phase-4 "must-builds" are recorded as permanently dropped by Phase 11 — which record is true?

*decisions · needs: user-decision*

plan.md:33 elevated six items from arguable to must-build in Phase 4 (mark complete/incomplete, edit a submitted expert review, request expert review on an existing scan, AI Review Generator, reset-upload recovery, add/delete files after submit), and Phase 4 is marked **Done**. But no `ai-review.ts`, `expert-review-request.ts` or `scan-file-delete.ts` exists under `packages/api-client/src/endpoints/`, README.md:279 says "the AI review panel [is] not ported", and `docs/feature-flags-decision.md:78-79` records `scan-review-generator` and `scan-vault-scan-details-page-add-file` as "Off — dropped", "a fixed, permanent outcome". The `/add-files` endpoint exists but is called only by create-scan draft recovery, never from `features/scan-detail`. Either the programme-acceptance claim or the flag doc is wrong; the parity audit raises the same thing as "post-submit editing in scope?".

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/plan.md:33 vs docs/feature-flags-decision.md:78-79; README.md:279; plans/reports/from-parity-audit-to-backlog-260913-0640-scan-surface-gaps-vs-dashboard-report.md:148`

### AWS: provision the OIDC IAM role and decide whether Sector gets its own bucket/distribution

*decisions · needs: other-team*

`SectorS3GithubRole` in `deploy.yml` is a placeholder name. Someone with AWS access must provision a role trusting scanvault's GitHub OIDC, register the four `PROD_AWS_*` + `PROD_VITE_API_URL` secrets, and decide whether Sector gets its own S3 bucket/CloudFront distribution or eventually takes over the dashboard's. Nothing in Phase 11 can actually deploy until this lands.

**Evidence:** `plans/reports/fullstack-developer-260914-0127-phase-11-cutover-flags-i18n-deploy-session-report.md:164-170`

### Which ScanType generation the pathology gallery relation points at — v2 as backfilled, or the live v6 lineage

*decisions · needs: user-decision*

The backfill wrote v2 scan-type ids onto 1,288 of 1,305 gallery rows across 13 categories, inheriting the legacy display heuristic `categoryVersions.find(v => v.version === 2)`. But `scantypes` runs to v6 across two organisations and live `scans` reference v6 names (Vascular v6, Cardiac/Echo v6, OB 2nd/3rd v4, MSK split into MSK-Shoulder/Knee at v3+), so the new relation can never join to a scan's own scanType and binds the gallery to an org-specific v2 lineage. A display heuristic is now stored data and the backbone of the ontology work; the script has run on the local mirror only, so deciding before a production run avoids a second write (it also overwrites `updatedAt` irreversibly — B2).

**Evidence:** `plans/reports/code-reviewer-260914-0516-phase-09-gallery-taxonomy-assignments-sage-review-report.md:131 and :212`

### feat/sector-api exists only on this machine — no remote branch, no PR, 22 commits

*api · needs: engineering*

`git rev-parse feat/sector-api@{upstream}` returns nothing, and `git branch -r --contains` is empty for every one of its commits (090b2751, 58d3b5a4, 654eff0d, 62accade, 7a392336, 98736b80, 32e177a6, 75aeae17). The whole API-side dependency of Sector — 37 files, +2868/-140 — is unpushed local work in a scratchpad worktree. Nothing upstream knows it exists. Same for all six merged sub-branches (feat/sector-auth-sessions, -course-outline, -course-version-guards, -group-member-search, -local-media, -pathology-taxonomy) and fix/sector-pathology-backfill.

**Evidence:** `/private/tmp/claude-501/-Users-lap16299-Documents-code-gusi-lms/ec189ad1-d628-4150-9456-6330d395431a/scratchpad/wt/api @ feat/sector-api (090b2751); git branch -a shows no remotes/origin/*sector* ref`

### feat/sector-api is stacked on 8 unpushed commits of another developer's CTP-1119 work

*api · needs: other-team*

Base 6efbbfc0 (branch feat/ctp-1119-reviewer-access-control) is itself on no remote: `git rev-list --count origin/main..6efbbfc0` = 8, `git branch -r --contains 6efbbfc0` is empty. Those 8 commits are scan-scoping/file-count work (6efbbfc0, 7fe7ac45, cf2e3e25, 1badf13c, a4bb8f7a, 81aace78, 894927a9, 8f300aa6). A PR opened from feat/sector-api against origin/main would carry that developer's unreviewed work too. The Sector commits must be rebased onto a real remote base, or the CTP-1119 branch must land first.

**Evidence:** `wt/api: git rev-list --left-right --count origin/main...6efbbfc0 → 0	8`

### New endpoint GET /v2/learners/courses/:courseId/outline — the Sector course runner does not work without it

*api · needs: other-team*

Added by 98736b80 (route, controller, schema, two new helpers: learners.outline.helper.ts +287, learners.outlinecontent.helper.ts +118). The Sector client calls it from course-runner-page.tsx, outline-sidebar.tsx, quiz-view.tsx, course-read-only.tsx via packages/api-client/src/endpoints/course.ts. Until this merges, those screens get 404 against any deployed API.

**Evidence:** `wt/api src/app/lms/learners/learners.route.ts:12 (commit 98736b80); scanvault feat/sector:packages/api-client/src/schemas/course-outline.ts`

### Pathology gallery scanTypeId relation + query filter — the Sector gallery sends a param the deployed API ignores

*api · needs: other-team*

58d3b5a4 adds `scanTypeId` to the PathologyGallery model, an index {scanTypeId:1,status:1}, create/update/list schema fields, and rewrites GET /categories to source the bar from the real relation. The Sector client already sends `scanTypeId` and omits `category` when it has one (pathologyGalleryListParams). Against an API without this, `scanTypeId` is dropped and no `category` is sent either, so the grid returns every published item unfiltered on every category click.

**Evidence:** `wt/api src/database/pathology-gallery/pathology-gallery.model.ts:47 + src/app/pathology-gallery/pathology-gallery.controller.ts:168; scanvault fix/sector-gallery:packages/api-client/src/endpoints/pathology.ts:30-38`

### fix/sector-pathology-backfill is NOT merged into feat/sector-api — running the migration as-merged rewrites updatedAt on ~1,288 rows

*api · needs: engineering*

`git merge-base --is-ancestor fix/sector-pathology-backfill feat/sector-api` fails; it is the only sector branch not merged. Its single commit ad2cd09f adds `{ timestamps: false }` to setScanTypeIdForCategory. Without it, Mongoose appends updatedAt to the $set, so the backfill replaces every pathology item's last-edited date (some from 2022) with the run date, and again on every re-run. The scanTypeId write is reversible with one $unset; the dates are not. Must merge before anyone runs the script anywhere.

**Evidence:** `wt/api fix/sector-pathology-backfill ad2cd09f → src/database/pathology-gallery/pathology-gallery.service.ts:141`

### Migration script scripts/db/backfill-pathology-scan-type.ts must be run by the API team — it refuses to run anywhere but localhost

*api · needs: other-team*

New 155-line script (090b2751). assertLocalMongoUri() throws on any host that is not localhost/127.0.0.1 and on anything containing 'mongodb.net'. So it cannot be pointed at staging or production by the Sector side at all; the API team must run an equivalent against their own environments, or the script needs a sanctioned staging mode. Until it runs, every pathology item has scanTypeId null and the new category bar shows only unmapped `id: null` rows.

**Evidence:** `wt/api scripts/db/backfill-pathology-scan-type.ts:44-63 (assertLocalMongoUri, ALLOWED_HOSTS)`

### New refreshtokens collection replaces the single users.refreshToken field — schema change plus a lazy data migration

*api · needs: other-team*

982d03d7/50a7e5a/654eff0d add src/database/refresh-token/{model,service,type}, register RefreshToken in src/database/index.ts, and switch login, verify-OTP, social login, loginConsole, switch-user and /me onto per-session documents. Three indexes including a TTL index on expiresAt. No migration script: userService.resolveRefreshToken falls back to the legacy field once, migrates it, then clears it. Cap of 10 sessions per user with oldest-first eviction. This is a new collection in production and needs DBA/ops awareness (TTL monitor, index build), not just a code merge.

**Evidence:** `wt/api src/database/refresh-token/refresh-token.model.ts:50-56 (indexes); src/database/user/user.service.ts:626-650 (resolveRefreshToken)`

### Security finding 1 (course-version routes unguarded) is FIXED only on the local branch — proven exploitable in production today

*api · needs: other-team*

Report states a learner account holding no course permission published a course version on the mirror: HTTP 200, draft→published, isActive→true. Fix is 62accade, merged into feat/sector-api, which is unpushed. Until that merges, any authenticated learner in production can publish, unpublish, activate or reassign course versions. The report's second open question — whether anyone wants a production audit of what was published or reassigned by accounts lacking the permission — is unanswered and needs a production read nobody has authorised.

**Evidence:** `plans/reports/from-sector-port-to-api-team-260914-0031-incidental-security-findings-report.md §1`

### Security finding 6 (legacy refresh token survived every revocation path) is FIXED only on the local branch

*api · needs: other-team*

Deterministic, no race: token leaks → user resets password → reset deletes zero session rows because none exists yet → attacker replays the legacy users.refreshToken and gets a fresh 30-day session. Fixed by 514a632e (revokeAllSessions clears the legacy field too) plus issueIfAbsent for the concurrent-tab migration. Four regression tests added (me-legacy-session-revocation, me-legacy-concurrent-migration, me-multi-session, get-by-refresh-token-legacy-fallback), which the report says fail against pre-fix source. All unpushed.

**Evidence:** `wt/api src/database/user/user.service.ts:652-659 (revokeAllSessions); tests/functional/auth/me-legacy-session-revocation.test.ts`

### Security finding 10/9/8 — unscoped group-assignment and dashboard reads — reported, NOT fixed anywhere

*api · needs: other-team*

GET /api/group-assignment trusts the caller's groupId: a minted subscriber token leading no group got 200 and 8,720 assignment rows with real student names and emails. GET /api/group-assignment/learners has no assertLeadsGroup at all and returns learner emails; subscriber holds read:group-assignment. checkUserAccess short-circuits on its self-check so any signed-in user reads any group's dashboard aggregates. Confirmed untouched: the feat/sector-api diff touches no dashboard, group-assignment or scan file. The only mitigation built is client-side and sits on the unmerged fix/sector-home-dashboards.

**Evidence:** `wt/api src/app/group-assignment/group-assignment.route.ts:34; git diff --name-only 6efbbfc0...feat/sector-api contains no group-assignment or dashboard file`

### Security finding 3 — four unscoped scan routes — reported, NOT fixed, and Sector is the first client to call them from learner screens

*api · needs: other-team*

POST/DELETE /api/scan/:id/tags require only edit:scan, which every role in the mirror holds including subscriber, with no ownership check. POST /api/scan-review/request-expert carries no withPermission at all and debits a review credit. scan-reset.controller.ts has no ownership check and zeroes fileCount (491 resettable scans in the mirror). DELETE /api/scan/:id/files has no ownership check and hard-deletes File documents. All four are wrapped by the Sector client and reachable from normal learner UI; the client gates on ownership, the server does not.

**Evidence:** `scanvault feat/sector:packages/api-client/src/endpoints/scan-tags.ts:30,41, scan-review-credits.ts:35, scan-write.ts:100-106; report §3`

### Security finding 2 — PUT /api/users/:id/password appears to store the password unhashed — reported, NOT fixed, and the Sector branch edits that exact function without fixing it

*api · needs: other-team*

updateUserPassword still passes body.password straight into userService.updateById, a findOneAndUpdate; the bcrypt hook is userSchema.pre('save') and does not run on a query update. The sibling PUT /api/users/:id hashes explicitly first. The Sector branch added revokeAllSessions three lines below that call and left the hashing alone — so the merge touches the function without closing it. Report asks for a production count of non-$2/non-$P$ password prefixes before anyone assumes it never fired.

**Evidence:** `wt/api src/app/user/user.controller.ts:529-531 (unhashed) vs :536 (new revokeAllSessions)`

### README documents the whole local stack as :3100 → :5001; :3100 actually proxies to :5003

*ops · needs: engineering*

README.md:5, :25, :35, :49, :87 and :164-165 all state the app talks to the legacy API on :5001 against gusi_dev, and that :5001/:3100 are 'untouched' by the mirror work. Verified live: the vite process serving :3100 (PID 90948, launched from scanvault) carries SECTOR_API_ORIGIN=http://localhost:5003, and :5003 (PID 84693) is an API started from the scratchpad worktree wt/api on branch feat/sector-api against mongodb://localhost:27017/gusi_dev. The :5001 instance (PID 17525) is the developer's own gusi_nodejs_api checkout on feat/ctp-1119-reviewer-access-control. A new developer following README gets :5001, which lacks Sector's routes.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/README.md:5,25,35,49,87,164-165; apps/web/vite.config.ts:18; ps PID 90948 SECTOR_API_ORIGIN=http://localhost:5003; ps PID 84693 HTTP_PORT=5003 MONGODB_URI=...gusi_dev`

### Sector hard-depends on the unmerged API branch feat/sector-api, named in no doc in the repo

*ops · needs: engineering*

packages/api-client/src/endpoints/course.ts:68 calls GET /api/v2/learners/courses/:courseId/outline. That route is added only on feat/sector-api (git diff 6efbbfc0..feat/sector-api adds `router.get('/courses/:courseId/outline', ...)` to src/app/lms/learners/learners.route.ts); it does not exist on the :5001 branch feat/ctp-1119-reviewer-access-control. The same branch carries the rewritten pathology-gallery controller, the /me rate-limit fix, the course-version guards and refresh-token sessions. `git grep feat/sector-api` across README.md, CONTRACTS.md, docs/ and the plan returns nothing — it appears only inside plans/reports/*.md. Nobody reading the repo learns which API branch to run.

**Evidence:** `packages/api-client/src/endpoints/course.ts:68; gusi_nodejs_api `git diff 6efbbfc0..feat/sector-api -- src/app/lms/learners/learners.route.ts`; `git grep -n feat/sector-api -- README.md docs plans` → reports only`

### Nothing in the repo starts any API or database instance; the :5003 process exists in no tracked file

*ops · needs: engineering*

Root package.json scripts are dev/build/typecheck/lint/test/format/fidelity/docs:legacy-routes — none bring the stack up. The only tracked shell script is scripts/data/restore-prod-mirror.sh (a restore, not a start). `git grep 5003` across the repo matches one line in plans/reports/fullstack-developer-260914-0046-...-report.md:127, and there :5003 means something different (a per-worktree API against gusi_prod_mirror), not today's gusi_dev instance. README's only API start instructions are a copy-paste env block for :5002 (README.md:167-173). The :5003 process was started by hand and dies with the terminal.

**Evidence:** `package.json scripts block; `git ls-files | grep -E '\.sh$|docker-compose'` → scripts/data/restore-prod-mirror.sh only; `git grep -n 5003` → plans/reports/fullstack-developer-260914-0046-phase-09-gallery-assignments-sage-report.md:127`

### The scanvault repo has no git remote at all — 155 commits exist only on this laptop

*ops · needs: other-team*

`git config --get-regexp '^remote\.'` exits 1 (no remote configured). The only remote-tracking ref is a stale refs/remotes/origin-local/feat/sector at a4da385. feat/sector is 155 commits ahead of main (`git rev-list --left-right --count main...feat/sector` → 0 155). Phase 11's success criterion 'Sector deploys from a branch push, like the repo it replaces' cannot be met, and the entire programme has no off-machine copy.

**Evidence:** ``git config --get-regexp '^remote\.'` → exit 1; `git for-each-ref refs/remotes` → refs/remotes/origin-local/feat/sector a4da385; `git rev-list --left-right --count main...feat/sector` → 0 155`


## Significant (55)

### The i18n completeness gate only runs after merge to main — there is no PR CI

*phase11 · needs: engineering*

`find .github -type f` returns exactly one file, deploy.yml, whose `test` job runs `pnpm run test` (the gate, apps/web/src/i18n/locale-completeness-gate.test.ts, is an ordinary vitest file picked up by turbo). Because the only trigger is `push: branches: [main]`, a PR adding an untranslated en.json key is never blocked; the gate fails the deploy run after the change has already landed on main. "Enforced in CI" is true only in the weakest sense.

**Evidence:** `.github/workflows/deploy.yml:8-12 and :46-79; `find .github -type f` lists only deploy.yml`

### Locales are not complete: 444 gaps are permanently excused by the gate's baseline

*phase11 · needs: user-decision*

locale-completeness-baseline.json excuses 74 keys in each of de, es, fil, fr, it, pt — 444 total excused translations. The gate enforces no *new* rot (and fails if a baselined key gets translated without trimming the baseline), but success criterion "Every locale is complete" is false today and no one owns closing the 74. The gate's own comment says the baseline "is meant to shrink" with no plan attached.

**Evidence:** `apps/web/src/i18n/locale-completeness-baseline.json (74 keys × 6 locales = 444); apps/web/src/i18n/locale-completeness-gate.test.ts:12-26`

### Step 6's staged rollout (internal → pilot group → all) has no mechanism and no plan

*phase11 · needs: user-decision*

deploy.yml declares one environment and syncs the whole bundle to one bucket with `--delete` plus a `/*` CloudFront invalidation — an all-at-once swap. There is no cohort gate, and docs/feature-flags-decision.md deliberately makes Sector read no runtime flag service, so no targeting mechanism exists to stage with either. grep for 'staged rollout|pilot group|rollout' across docs/ and .github/ finds only the plan text itself; plan.md:80 confirms "staged rollout and decommission remain".

**Evidence:** `.github/workflows/deploy.yml:143-152; docs/feature-flags-decision.md:3-21; plans/260913-1451-sector-replaces-scanhub/plan.md:80`

### Step 7 not started: the dashboard is not decommissioned, and the decommission doc has no switch-off order

*phase11 · needs: engineering*

phase-11-cutover.md:22 specifies docs/decommission-dashboard.md as "what is switched off, in what order". The file that exists is a generated route inventory with exactly three sections — `## Kept at the same path`, `## Forwarded (38)`, `## Retired (19)`. No sequence, no owner, no dashboard-side shutdown steps (S3/CloudFront teardown, DNS swap, rollback trigger). The route-map half of step 7 is done; the decommission half is a title only.

**Evidence:** ``grep -n '^#' docs/decommission-dashboard.md` → lines 1, 8, 14, 57 only; plans/260913-1451-sector-replaces-scanhub/phase-11-cutover.md:22,48`

### Two fix branches that repair surfaces cutover ships are still unmerged into feat/sector — **CLOSED by the merges above**

*phase11 · needs: engineering*

fix/sector-home-dashboards is 5 commits ahead (a78b3a3 send every full-access role to the administrator home; b6341fb scope the group snapshot; cdcf2ee do not ask for a group's courses the viewer cannot read; 415984d make the cold-load sweep assert each role's own dashboard). fix/sector-gallery is 4 ahead (a01d324 recover the gallery from a category the server no longer returns; 7939c06 remove the assignments surface that never rendered). The home screen is what `/dashboard` redirects to per the route map, so cutover ships known-broken role homes until these merge.

**Evidence:** ``git rev-list --count feat/sector..fix/sector-home-dashboards` = 5; `git rev-list --count feat/sector..fix/sector-gallery` = 4`

### The phase's own validation — four demo roles on the deployed build, in two locales — has no locale dimension and no deployed target

*phase11 · needs: engineering*

scripts/check/sweep-routes.json carries only a `role` field (learner, leader, reviewer, admin) with no locale/language entries, so the "in two locales" half of the Tests/validation line is uncovered by the only sweep that exists. cold-load-sweep.mjs also defaults to SECTOR_WEB_ORIGIN=http://localhost:3101 / SECTOR_API_ORIGIN=http://localhost:5002 — the local mirror stack, not a deployed build, which cannot exist yet given the deploy blockers above.

**Evidence:** `scripts/check/sweep-routes.json (role only, no locale key); scripts/check/cold-load-sweep.mjs:35-36; plans/260913-1451-sector-replaces-scanhub/phase-11-cutover.md:54`

### FAST/EFAST scan-type mapping — the `FAST` type or the separate `eFAST` one

*decisions · needs: user-decision*

Two gallery items (`eFAST Anatomy`, `eFAST Pathology`) map to no scan type and ship today as an `id: null` category tab. Escalated as a clinician's call by the plan and by both phase-09 reports; an `eFAST v6` scan type exists (`6a75600020e8f010851b642e`) and was deliberately not touched. Still unanswered — the code comment states it explicitly.

**Evidence:** `packages/api-client/src/schemas/pathology.ts:25; plans/reports/fullstack-developer-260914-0046-phase-09-gallery-assignments-sage-report.md:153; plans/reports/code-reviewer-260914-0516-...-review-report.md:211; plans/260913-1451-sector-replaces-scanhub/phase-09-assignments-gallery-and-sage.md:49`

### Rapid Reviews disposition — drop the 15 items or keep them as a non-scan-type category

*decisions · needs: user-decision*

The retired third-party product's 15 gallery items have no scan type by design and currently render as an `id: null` tab with a full count. The plan says they "want their own answer (drop, or a category that is not a scan type)". Note the review's warning: the moment either unmapped category is retired or remapped, every existing `?category=` bookmark hits the empty-grid defect (partly mitigated on the unmerged `fix/sector-gallery`).

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/phase-09-assignments-gallery-and-sage.md:49-51; plans/reports/fullstack-developer-260914-0046-phase-09-gallery-assignments-sage-report.md:155; plans/reports/code-reviewer-260914-0516-...-review-report.md:89`

### Should a plain `administrator` be able to read and manage a group they do not lead?

*decisions · needs: user-decision*

`administrator` does not bypass `assertLeadsGroup` — only Superadmin holds `admin:full-access` — so adding a course to a non-led group returns 403 and the Courses tab is visible but non-functional, and the administrator home shows no course card at all because the group's course list is leader-only server-side. Raised independently by two reviewers as the same question. The unmerged `fix/sector-home-dashboards` (cdcf2ee) only stops the client asking; the authorization policy is unanswered.

**Evidence:** `plans/reports/code-reviewer-260914-0147-group-admin-blocker-remediation-report.md:202-206; plans/reports/code-reviewer-260914-0515-phase-10-home-screen-blocker-remediation-report.md:177-179`

### Is `scan reviewer` meant to hold `edit:group`, `edit:group-member` and `delete:group-member`?

*decisions · needs: user-decision*

Confirmed against the mirror that the role does hold all three, so scan reviewers currently get the group settings tab and full member management in Sector. Both reviewers label it a product decision, not an engineering one; nothing has changed it.

**Evidence:** `plans/reports/code-reviewer-260914-0147-group-export-surface-and-form-layer-adversarial-review-report.md:392-394; plans/reports/code-reviewer-260914-0147-group-admin-blocker-remediation-report.md:198-200`

### Five group export routes carry `authUser` only — is the hardcoded scoping flag meant to be flippable?

*decisions · needs: user-decision*

`GET /report/:groupId`, `POST /export-scans/:groupId`, `POST /export-user-scans/:groupId`, `POST /export-course-progress`, `POST /export-course-data/:groupId` have no `withPermission`. They return member lists, scan activity and course progress — real user PII and patient-adjacent data. Scoping holds today only because a hardcoded flag stays true; the finding explicitly asks whether that flag is meant to be flippable and whether a permission gate belongs behind it.

**Evidence:** `plans/reports/from-sector-port-to-api-team-260914-0031-incidental-security-findings-report.md:144-150 and :213; plans/reports/group-export-surface-and-form-layer-260914-0110-phase-08b-report.md:145-147`

### Is the missing course-permission vocabulary (`publish:course` etc.) wanted, or is `edit:course` the intended gate?

*decisions · needs: user-decision*

The eight commented-out guards on `course-meta-version.route.ts` named permissions that do not exist in `config/permissions.ts`. The triage fix deliberately used the smallest existing pair rather than inventing a permission model. If publish/archive/approve/reassign are meant to be assignable separately, they need adding to `config/permissions.ts` and to a role, and the guards should name them. Raised in two reports.

**Evidence:** `plans/reports/from-triage-to-fix-260914-0016-course-version-routes-unguarded-report.md:85-90; plans/reports/from-sector-port-to-api-team-260914-0031-incidental-security-findings-report.md:27 and :207`

### Does anyone want a production audit of what was published, archived or reassigned by unauthorised accounts?

*decisions · needs: user-decision*

The course-version guards were never live (they would not compile), so any authenticated learner could publish or archive a course version, approve one, or reassign learners between versions — demonstrated at HTTP 200 against a restored production copy. Version documents carry `publishedBy` and the approval history, so the question is answerable with a read-only Atlas query, but someone has to decide it is wanted. Raised in two reports.

**Evidence:** `plans/reports/from-triage-to-fix-260914-0016-course-version-routes-unguarded-report.md:88-90; plans/reports/from-sector-port-to-api-team-260914-0031-incidental-security-findings-report.md:208`

### Two customer-visible behaviour changes ride with the refresh-token revocation fix and need sign-off

*decisions · needs: user-decision*

Explicitly headed "FIXED, needs sign-off". (1) `/api/me` can now return 401 where it returned 200 when a session is revoked mid-request — Sector handles it, but the deployed mobile client's behaviour is unknown and is in no cloned repo. (2) `PUT /api/users/:id` now signs a user out when an admin edits their password or moves them off active status, which it previously did not.

**Evidence:** `plans/reports/from-sector-port-to-api-team-260914-0031-incidental-security-findings-report.md:108 and :127-137`

### Confirm the home-screen scope cut with Liesl: no member table, no per-member drill, no assignment progress

*decisions · needs: user-decision*

Phase 10 cut 14 endpoints to 8 and 242 i18n keys to ~50 by dropping the group member table, the per-member drill and assignment progress. The reviewer calls the accounting honest but the cut a product-scope decision, and asks whether it has been confirmed that group leaders do not need the per-member view on the home screen.

**Evidence:** `plans/reports/code-reviewer-260914-0515-phase-10-home-screen-role-dashboards-adversarial-review-report.md:349-352`

### Assignments shipped read-only — confirm the cut or scope the write half

*decisions · needs: user-decision*

The legacy assignments console is ~1,742 lines (page + 4 dialogs); Phase 9 shipped list + filters only, because porting the write half meant modelling course/lesson/topic/quiz content pickers and bulk assignment. The implementer asks for confirmation; the reviewer notes the write half now exists on the group-admin side, which weakens the original scope-cut rationale.

**Evidence:** `plans/reports/fullstack-developer-260914-0046-phase-09-gallery-assignments-sage-report.md:162-168; plans/reports/code-reviewer-260914-0516-phase-09-gallery-taxonomy-assignments-sage-review-report.md:215`

### Which of the seven locales actually have real users?

*decisions · needs: user-decision*

Raised in three reports and in plan.md. Translating create-scan, scan-detail and the home screen is only worth it for locales that have learners, and the programme acceptance criterion ("no surface ships hard-coded English while the shell offers seven languages") plus the new CI i18n gate (baseline=74) hard-code the seven-locale assumption until someone answers.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/plan.md:126; plans/reports/from-brainstorm-to-plan-260913-1451-...-report.md:164; plans/reports/from-parity-audit-to-backlog-260913-0640-...-report.md:152`

### Feature flags: courses/home/gallery deliberately left undecided, and production GrowthBook state never verified

*decisions · needs: user-decision*

`docs/feature-flags-decision.md:82` leaves `course_new-ui-v2_all`, `course_new-ui-v3_all` and `my-course-temporary-view-mode` "Not decided here" for whoever finishes those surfaces — those surfaces have now shipped (Phases 6, 7, 9, 10 all Done), so the decision is due. Separately, plan.md's nine drop decisions rest on a production GrowthBook state nobody has read; the doc measured the client key's served set (24 declared / 18 served / 13 matching) but not the production rules.

**Evidence:** `docs/feature-flags-decision.md:82; plans/reports/fullstack-developer-260914-0127-phase-11-cutover-flags-i18n-deploy-session-report.md:172-174; plans/260913-1451-sector-replaces-scanhub/plan.md:124`

### Is the immutable-snapshot write fix funded and assigned, and is it CTP-1016?

*decisions · needs: user-decision*

Raised identically in plan.md and two source reports. The Phase 6 read seam works against today's pointer structure and can swap data source later with no client change, but learner progress keeps corrupting until the write fix is done. Nobody has confirmed funding, assignee, or the ticket id.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/plan.md:120; plans/reports/from-brainstorm-to-plan-260913-1451-...-report.md:161; plans/reports/from-module-study-to-port-plan-260913-0640-...-report.md:342`

### Who owns `CERTIFICATE_DOWNLOAD_MAINTENANCE` / CTP-399?

*decisions · needs: other-team*

The flag is true and every certificate row action returns null, so course completion has no payoff anywhere. Raised in three reports as something worth knowing before the course track spends 23 days — that spend has now happened (Phases 6 and 7 Done) and the question is still open, so cutover would ship a completable course with no certificate.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/plan.md:128; plans/reports/from-module-study-to-port-plan-260913-0640-...-report.md:314 and :353`

### Where does `gusi_scanhub_console` live?

*decisions · needs: other-team*

The internal admin console is the one repo in the stack nobody on this team has ever seen. Every authoring claim in the source reports is inferred from the API contract, never observed, which means no authoring complaint can currently be reproduced in a repo this team owns. Raised in three places, unanswered.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/plan.md:130; plans/reports/from-module-study-to-port-plan-260913-0640-...-report.md:97 and :355`

### Is "Sector" the public name or the internal one? Trademark and domain search not done

*decisions · needs: user-decision*

Phase 1 shipped the rename (name, mark, nav, storage keys, `LOG_SOURCE`) on the stated reasoning that it is cheapest now and more expensive every week. The plan states plainly that the trademark and domain search is not done and is not something the plan can do. Cutover makes the name user-facing.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/plan.md:132; plans/reports/from-brainstorm-to-plan-260913-1451-...-report.md:170`

### Does DICOM upload survive as a surface, and should `create:dicom-ingestion` stay granted to every role?

*decisions · needs: user-decision*

The pipeline makes an OpenAI vision call per DICOM and the permission is granted to every role — a cost and authorization question in one. Sector's DICOM viewer is a placeholder today (README.md:266 "labels DICOM files but does not render them"), so whether to build it or retire it is unresolved scope.

**Evidence:** `plans/reports/from-module-study-to-port-plan-260913-0640-rest-of-scanhub-into-scanvault-report.md:347; README.md:266`

### Is the expired-course renewal flow meant to work at all? It takes a card number and does nothing

*decisions · needs: user-decision*

Verbatim from the module study: the renewal flow collects a card number and performs no action. That is a live payment-adjacent surface on the dashboard Sector is replacing, and the decommission decision (port, fix, or retire with a message) has no answer.

**Evidence:** `plans/reports/from-module-study-to-port-plan-260913-0640-rest-of-scanhub-into-scanvault-report.md:349`

### Group Administration is gated on the group-queue permission; the surface needs its own permission

*decisions · needs: user-decision*

The nav entry is gated by reference on a scan-queue permission because no seeded role carries any group-management string — "right about who, wrong about why". The reviewer's explicit ask is to give the surface its own permission before group data goes behind it. Phases 8, 8b and 9 have since put group member lists, exports and assignments behind that same gate.

**Evidence:** `plans/reports/from-plan-to-implementation-260913-1624-sector-phase-01-name-mark-nav-and-storage-report.md:73-76`

### Who owns the group-scoping API tickets — the API repo, or does Sector defend client-side?

*decisions · needs: other-team*

Three reports converge on the same unowned work: `PUT`/`DELETE /api/group-members/:id` are unscoped (so `expiresAt` preservation is a client-side mitigation of a server bug — a second client or a direct call still clears it, live on 500 rows), `GET /api/group-assignment` is unscoped, and `/group-assignment/learners` is directly callable for a group the caller does not lead. One reviewer asks whether there is a CTP epic (CTP-307) these belong to.

**Evidence:** `plans/reports/code-reviewer-260914-0147-group-admin-blocker-remediation-report.md:191-194; plans/reports/code-reviewer-260914-0147-group-export-...-adversarial-review-report.md:395-400; plans/reports/code-reviewer-260914-0515-phase-10-...-adversarial-review-report.md:346`

### Behaviour change needing sign-off: GET /api/me can now return 401 where it returned 200

*api · needs: user-decision*

auth.controller.ts getCurrentUser: when rotate() fails and refreshTokenService.isLive(session.id) is false, it throws HttpError(401, 'Session is no longer valid'). Triggers when a password reset/change or account deletion lands mid-request. Sector drops its session on any 401 so it is safe there; the deployed mobile client's behaviour is unknown and its source is not in any repo cloned here. Flagged as customer-visible in the handoff report.

**Evidence:** `wt/api src/app/auth/auth.controller.ts:524-528 (commit 514a632e)`

### Behaviour change needing sign-off: PUT /api/users/:id now signs a user out when an admin edits their password or status

*api · needs: user-decision*

user.controller.ts updateUserById now calls userService.revokeAllSessions when `bodyParse.password` is set or `body.status !== UserStatus.ACTIVE`. Previously this route left sessions alone while the dedicated password route also did not — so admins currently get no sign-out from either. After the merge, an admin editing a user in the console silently terminates that user's sessions on every device. Customer-visible; per the report this wants a decision before production.

**Evidence:** `wt/api src/app/user/user.controller.ts:485-493`

### Behaviour change needing sign-off: password reset, self-service password change, and account deletion now revoke all sessions

*api · needs: user-decision*

Four new revokeAllSessions call sites: auth.controller.ts resetPassword (:808), account.controller.ts updatePassword (:262) and deleteAccount (:300), user.controller.ts updateUserPassword (:536) and deleteUserById (:651). Today a user who changes their own password stays signed in everywhere; afterwards they are signed out of every device including the one they are holding. Correct security posture, but it changes what learners experience and support will field the calls.

**Evidence:** `wt/api src/app/account/account.controller.ts:262 and src/app/auth/auth.controller.ts:808 (commit 514a632e)`

### Behaviour change needing sign-off: GET /api/me rate limit loosened from 20 to 300 per 15 min per IP

*api · needs: user-decision*

ae125a28 moves /me off the shared authRateLimit (20/15min, which also guards /login against password guessing) onto a new meRateLimit at max 300. Rationale in the code: a classroom of devices behind one NAT burned the shared budget on ordinary page loads and was then locked out of signing in. This is a real production abuse-surface change on an unauthenticated-by-header endpoint that accepts a refresh token, and it should be an explicit decision rather than a side effect of the Sector port.

**Evidence:** `wt/api src/middlewares/rate-limit.middleware.ts:29-48 and src/app/auth/auth.route.ts:12`

### Behaviour change needing sign-off: eight course-version routes now 403 for callers that previously got 200

*api · needs: user-decision*

62accade replaces commented-out guards with withPermission on publish, archive, restore, set-default, /:versionId/:status (approve), /course/:courseId/user-group, assign/user-course, assign/users, migrate/:userCourseId. Verified the chosen permissions exist in src/config/permissions.ts (edit:course, course:full-access, read:course, edit:user-course); the originally-intended ones (publish:course, archive:course, restore:course, approve:course, manage:course, assign:course, migrate:course) do not exist and never did. Sector calls none of these routes — the blast radius is entirely the existing web dashboard/admin console, which is not being tested here. Open question from the report: add the missing vocabulary properly, or is edit:course/course:full-access the intended long-term gate?

**Evidence:** `wt/api src/app/course-meta-version/course-meta-version.route.ts:45-88; src/config/permissions.ts:95-99,145-149`

### Security finding 5 — live refresh tokens are written to access logs — reported, NOT fixed

*api · needs: other-team*

GET /api/me takes the refresh token as a query parameter and src/server.ts:39 runs morgan('tiny'), which logs :url; Sentry captures request URLs too. Observed directly in the report. Rotation limits each logged token to one use, except legacy tokens which stay valid until migrated. Two cheap mitigations proposed and not built: a morgan :url token stripping refreshToken, and a Sentry beforeSend scrubbing the query string. Confirmed untouched — server.ts is not in the sector diff.

**Evidence:** `wt/api src/server.ts:39 (morgan('tiny')); report §5`

### Security finding 4 — a bcrypt password hash is written into userlogs.details — reported, NOT fixed

*api · needs: other-team*

updateUserById spreads ...bodyParse into the audit log details, which includes the new password hash when one was set. Audit logs are read by more people and retained longer than the user collection. The Sector branch edits the surrounding block (adds credentialChanged/revokeAllSessions immediately above) and leaves the spread intact.

**Evidence:** `wt/api src/app/user/user.controller.ts:497-503 (details: { ...bodyParse, ... })`

### Security finding 7 — POST /api/switch-user has neither authUser nor a rate limit — reported, NOT fixed

*api · needs: other-team*

Gated only by a signed token. Pre-existing and unchanged by Sector work; the report flags it without diagnosing it. Worth noting that the Sector branch does change switchUser's body (it now issues a per-session refresh token, commit 50a7e5a/514a632e) and its test, so the merge lands on an unauthenticated route without adding the guard.

**Evidence:** `wt/api src/app/auth/auth.route.ts:28 — router.post('/switch-user', authController.switchUser)`

### API-side resume-pointer fix was never made: the outline endpoint hands out unopenable resume targets

*api · needs: engineering*

resolveOutline picks resume as the first non-completed leaf without filtering items carrying a blockedReason, so it can point at a quiz with zero published questions. The Sector client was made defensive instead, and the remediation report states plainly the API fix was skipped because editing wt/api restarts the shared :5002. Any other consumer of this new endpoint gets the bad pointer. This is not on any branch at all — it still has to be written.

**Evidence:** `wt/api src/app/lms/learners/helpers/learners.outline.helper.ts:274-277; plans/reports/code-reviewer-260914-0102-sector-course-read-seam-blocker-remediation-report.md:99`

### Pre-existing learner access gap documented on the branch but left as an unfiled server ticket

*api · needs: other-team*

The new learners README records that endpoints 4, 6, 7 and 8 share validateLearnersCourseAccess, which checks neither GroupMember.expiresAt nor role — so an expired group member can still read course content and track progress through those four, while endpoint 3 correctly rejects them. Documented by 7a392336 as 'tracked as its own server ticket'; no such ticket is referenced anywhere in the worktree or the reports. The new outline endpoint inherits this rule (it calls validateAndFetchCourseData).

**Evidence:** `wt/api src/app/lms/learners/README.md:13-19; src/app/lms/learners/learners.controller.ts:270`

### Group-member keyword search fix — small, must merge, Sector degrades quietly without it

*api · needs: other-team*

32e177a6 replaces a three-line comment with `dbQuery.keyword = query.keyword` in manager.controller.ts getGroupMembers. Until it lands, a group leader's or scan reviewer's member search on GET /api/groups/manage/member/:groupId silently returns page one unfiltered rather than erroring. The Sector client already sends the param unconditionally and documents the caveat, so it needs no client change — but the failure mode is a wrong result, not a visible break, which makes it easy to ship and forget.

**Evidence:** `wt/api src/app/group/manager/manager.controller.ts:1127-1132; scanvault feat/sector:packages/api-client/src/endpoints/group-member.ts:14-25`

### Route collision: two routes claim `administer/groups/:groupId/assignments`, phase 9's AssignmentsSurface is unreachable dead code — **CLOSED by the merges above**

*code · needs: engineering*

Still present on feat/sector. `groups-links.ts:63` and `assignments-links.ts:25` both export a constant named `GROUP_ASSIGNMENTS_ROUTE_PATH` with the identical value. `groups-routes.tsx:66` mounts `GroupAssignmentsPanel` at it; `assignments-routes.tsx:23` mounts `AssignmentsSurface` at it. In `feature-routes.tsx`, `...groupsRoutes` is spread at line 41 and `...assignmentsRoutes` at line 45, so equal specificity resolves to the group-admin panel and phase 9's surface never renders (the phase-09 review confirmed this in a browser as leader@sector.test). Dead: 283 lines under apps/web/src/features/assignments/, plus packages/api-client/src/{endpoints/assignment.ts (44), schemas/assignment.ts (91), react/use-assignments.ts (16)} = 434 lines, plus a 24-key `assignments` i18n namespace translated into all 7 locales (168 strings) for a surface nobody can reach. Nothing catches it: there is no route-path uniqueness test on feat/sector, and scripts/check/sweep-routes.json asserts only the word "Assignments" on that path, which the wrong surface also renders. The fix (`refactor(web,api-client): remove the assignments surface that never rendered`, 7939c06) exists ONLY on the unmerged fix/sector-gallery.

**Evidence:** `apps/web/src/features/groups/groups-routes.tsx:66 and apps/web/src/features/assignments/assignments-routes.tsx:23 (same path); apps/web/src/routes/feature-routes.tsx:41,45; fix on fix/sector-gallery commit 7939c06`

### Hard-coded English in 61 of 82 components across create-scan, scan-detail, account and scan-list — invisible to the i18n gate

*code · needs: engineering*

Verified by counting .tsx files (excluding tests) that never import `useTranslation`: create-scan 24/27, scan-detail 18/22, account 6/9, scan-list 13/24. The phase 5-10 surfaces are clean by contrast (courses 1/14, groups 1/14, home 1/7, gallery 1/5, question-banks 1/6). 79 English string literals sit in JSX attributes alone (title=/label=/placeholder=/description=/aria-label=), e.g. scan-type-picker.tsx:67,77,78 ("Find a scan type", "No scan type matches that"), password-form.tsx:52,67,81 ("Current password"...), study-summary.tsx:67,68,87 ("The study", "Exam type", "Clinical note"), scan-media-stage.tsx:35,36,45,46,92, not-found-page.tsx:17, route-error-page.tsx:28, forbidden-page.tsx:36. These never enter en.json, so `locale-completeness-gate.test.ts` — which only diffs en.json against the other six files — cannot see them. Neither README.md "Known gaps" nor CONTRACTS.md mentions i18n at all (grep for translat|i18n|locale returns nothing in either). This is materially larger than the 74-key baselined gap and is undocumented.

**Evidence:** `apps/web/src/features/create-scan/components/scan-type-picker.tsx:67,77,78; apps/web/src/features/account/password-form.tsx:52,67,81; apps/web/src/features/scan-detail/components/scan-media-stage.tsx:35-46`

### 444 untranslated keys still baselined: the app shell and scan list are English-only in all six non-English locales

*code · needs: user-decision*

Computed directly off the committed files: en.json has 649 leaf keys; de/es/fil/fr/it/pt each have 575, each missing the identical 74 keys, all excused in `locale-completeness-baseline.json` (74 per locale x 6 = 444). The gap is not in a back corner — it is the shell and the primary surface: nav (5 keys incl. `nav.primary`, `nav.skipToContent`), account menu (6 incl. `account.signOut`), sign-out dialog (4), scan-list row (21), toolbar (8 incl. `toolbar.searchMyScans`), columns (5), pagination (2), and `language.change` — the label on the language switcher itself. Spot-checked: `es` returns undefined for all eight sampled keys, so a Spanish user gets English chrome. Phase 11's success criterion "Every locale is complete, enforced in CI" is half-met: the gate is enforced, completeness is not. The baseline is designed to shrink but nothing on feat/sector schedules the work; only fix/sector-home-dashboards (unmerged) trims it, by 2 keys per locale.

**Evidence:** `apps/web/src/i18n/locale-completeness-baseline.json (74 entries x 6 locales); apps/web/src/i18n/locale-completeness-gate.test.ts:20-27`

### Gallery sticks on a permanent skeleton grid when the URL names a category the server no longer returns — **CLOSED by the merges above**

*code · needs: engineering*

On feat/sector, `gallery-page.tsx:39-41` sets `canFetchList = Boolean(params.category) && categoriesQuery.isSuccess && Boolean(selectedCategory)`, and `category-bar.tsx:34` only auto-selects `categories[0]` when `!selected`. So a bookmarked or shared `?category=<name>` that no longer resolves leaves `selected` non-empty, `selectedCategory` undefined, `canFetchList` false — and gallery-page.tsx:75-82 then renders 20 skeleton tiles forever, with no error state, no empty state and no highlighted tab. The category names are explicitly unstable: the fix branch's own note names `FAST/EFAST` and `Rapid Reviews` as production categories awaiting a rename-or-retire decision. Fixed only on the unmerged fix/sector-gallery (new `gallery-selection.ts` with `categoryToSelect`, which falls back to `categories[0]` when the URL name is unknown).

**Evidence:** `apps/web/src/features/gallery/gallery-page.tsx:39-41,75-82 and category-bar.tsx:32-39; fix at fix/sector-gallery:apps/web/src/features/gallery/gallery-selection.ts`

### The fidelity replay — the mechanism that proves schemas against real data — never runs in CI

*code · needs: engineering*

`packages/api-client/package.json` defines test as `vitest run --exclude "**/live-api-shape-check.test.ts" --exclude "**/*.fidelity.test.ts"`, so the root `pnpm run test` that deploy.yml's `test` job runs explicitly skips every fidelity suite. `pnpm fidelity` (turbo task with `passThroughEnv` for SECTOR_MIRROR_*) appears nowhere in .github/workflows/deploy.yml. On top of that, the two route-replay suites are `describe.skipIf(!enabled)` where `enabled = Boolean(SECRET) && await reachable()` — without SECTOR_MIRROR_JWT_SECRET and a mirror API on :5002 they skip and the run still reports a pass. So the schema-fidelity guarantee is a local-laptop-only artifact; nothing on the merge or deploy path enforces it.

**Evidence:** `packages/api-client/package.json test script; .github/workflows/deploy.yml (no fidelity step); packages/api-client/src/fidelity/routes.fidelity.test.ts:64,110`

### deploy.yml gates nothing before merge — it triggers only on push to main, and main is 155 commits behind

*code · needs: engineering*

.github/workflows/deploy.yml has `on: push: branches: [main]` and no `pull_request` trigger. So lint, typecheck and test — which is where the phase-11 i18n completeness gate was deliberately wired ("no separate CI job needed since it's an ordinary vitest file") — run only AFTER a merge to main, never on a PR into feat/sector. `git rev-list --count main..feat/sector` is 155, and main's tip (566cf3e) is a docs-only commit predating the app, so the workflow has never executed once. Every phase of this programme has merged with zero automated gating.

**Evidence:** `.github/workflows/deploy.yml:8-11; git rev-list --count main..feat/sector = 155; main tip 566cf3e`

### gusi_dev has not had the pathology scanTypeId backfill: 0 of 1305 rows (mirror has 1288)

*ops · needs: engineering*

Counted read-only: gusi_dev.pathologygalleries total=1305 withScanTypeId=0; gusi_prod_mirror total=1305 withScanTypeId=1288. Consequence for anyone developing against :3100 (now gusi_dev via :5003): pathologyGalleryService.getPublishedScanTypeIds() returns empty, so GET /api/pathology-gallery/categories returns every category through the unmapped branch — id:null, imageUrl:null. The gallery renders with no scan-type thumbnails and the relation-backed filter path is never exercised, so gallery work looks broken (or falsely 'legacy-shaped') on :3100 and correct only on :3101. The migration script defaults to gusi_prod_mirror and no doc says to run it against gusi_dev.

**Evidence:** `mongosh countDocuments on gusi_dev/gusi_prod_mirror pathologygalleries; wt/api/src/database/pathology-gallery/pathology-gallery.service.ts:94-123; wt/api/scripts/db/backfill-pathology-scan-type.ts:25 (defaults to gusi_prod_mirror)`

### Re-running restore-prod-mirror.sh silently reverts the pathology backfill and the seeded accounts

*ops · needs: engineering*

The script restores dump-prod-content with --drop, and dump-prod-content/gusi/ contains pathologygalleries.bson — so a rebuild wipes the 1288 backfilled scanTypeId values. It then restores users with --drop from dump-local-gusi-dev-260912/gusi_dev/users.bson, wiping the four @sector.test accounts. README.md:190-193 tells you to re-seed the accounts after a rebuild but never mentions re-running the backfill, so the mirror quietly regresses to the pre-migration shape the fidelity target is supposed to prove against.

**Evidence:** `scripts/data/restore-prod-mirror.sh:39,47,67,75; ls /Users/lap16299/Documents/code/gusi-lms/dump-prod-content/gusi/pathologygalleries.bson; README.md:190-193`

### Committed sweep-routes.json embeds a mirror-only user id, so the sweep cannot run against gusi_dev

*ops · needs: engineering*

scripts/check/sweep-routes.json contains /learn/course-progress/6aa68680341eed9251900a2e/681a4b63779a0d9e6c9cc55b. That _id exists in gusi_prod_mirror (1 match) and not in gusi_dev (0 matches) — seed-test-accounts.ts mints different ids per database (dev learner is 6aa68681341eed9251900a32). README.md:132-135 claims only sweep-ids.json is database-specific and 'cannot be committed', which is wrong: the committed route list is mirror-specific too. Now that :3100 serves gusi_dev, a sweep pointed at it fails on that route for reasons unrelated to the code under test.

**Evidence:** `scripts/check/sweep-routes.json (course-progress entry); mongosh users._id 6aa68680341eed9251900a2e → gusi_dev 0, gusi_prod_mirror 1; README.md:132-135`

### README's claim that sweep-routes.json covers every built route is false and nothing enforces it

*ops · needs: engineering*

README.md:133 says the shipped route list 'covers every route built so far'. Routes declared in the app but absent from sweep-routes.json: /forgot-password/verify, /forgot-password/reset, /scans/shared/:shareId (SHARED_SCAN_DETAIL_ROUTE_PATH), /administer/groups/:groupId/courses, /administer/groups/:groupId/exports, /administer/groups/:groupId/settings. `git grep -l sweep-routes` matches only scripts/check/cold-load-sweep.mjs — no test ties the list to the router, so the gap cannot fail a gate.

**Evidence:** `README.md:133; apps/web/src/features/groups/groups-links.ts:60,66,69; apps/web/src/features/scan-detail (SHARED_SCAN_DETAIL_ROUTE_PATH); scripts/check/sweep-routes.json; `git grep -l sweep-routes` → 1 file`

### `pnpm dev` — the single documented command — cannot be pointed at :5003

*ops · needs: engineering*

README.md:41-47 presents `pnpm dev` as the one command. turbo.json declares passThroughEnv only on the `fidelity` task (turbo.json:33), and the file's own comment records that Turbo filters the child environment so an exported variable never reaches the task. SECTOR_API_ORIGIN is therefore stripped for `dev`, leaving vite.config.ts:18's default of :5001. This is why the live :3100 instance was started as `pnpm --filter @sector/web exec vite --port 3100 --strictPort` (PID 90914), bypassing Turbo entirely — the documented path and the working path have diverged.

**Evidence:** `turbo.json:28-37 (passThroughEnv on fidelity only, with the filtering comment); apps/web/vite.config.ts:18; ps PID 90914 command bypasses turbo; README.md:41-47`

### Two built fix branches are recorded nowhere outside the worktree list — **CLOSED by the merges above**

*ops · needs: engineering*

fix/sector-gallery (77143fd) and fix/sector-home-dashboards (b701cd5) have live worktrees and commits but are not merged into feat/sector. `git grep -n 'fix/sector-gallery\|fix/sector-home-dashboards' -- README.md docs plans` returns nothing — not in plan.md, not in phase-11, not in any report. The only record that they exist is `git worktree list` on this machine, which is also the machine with no remote.

**Evidence:** ``git worktree list` → wt/fix-gallery 77143fd [fix/sector-gallery], wt/fix-home-dashboards b701cd5 [fix/sector-home-dashboards]; `git grep` across README.md/docs/plans → no match`

### .github/deploy.yml fires only on push to main, and .github does not exist on main

*ops · needs: engineering*

deploy.yml:8-11 triggers on push to main only, with a comment asserting 'this repo has only a main branch' — there are 20 local branches. `git ls-tree -r main -- .github` is empty, so the workflow is not on the branch that triggers it, and main is 155 commits behind feat/sector. There is no pull_request or feature-branch workflow, so none of the 155 commits has ever run lint/typecheck/test in CI — including the i18n completeness gate that phase-11 step 5 claims is enforced 'in CI'.

**Evidence:** `.github/workflows/deploy.yml:1-11 and :72-78; `git ls-tree -r --name-only main -- .github` → empty; `git rev-list --left-right --count main...feat/sector` → 0 155`

### deploy.yml references an AWS role and secrets nobody has provisioned

*ops · needs: other-team*

The deploy job assumes arn:aws:iam::${{ secrets.PROD_AWS_ACCOUNT_ID }}:role/SectorS3GithubRole and reuses PROD_AWS_REGION / PROD_AWS_BUCKET_NAME / PROD_AWS_CLOUDFRONT_DISTRIBUTION_ID plus PROD_VITE_API_URL. The workflow's own comment says 'whoever provisions this repo's bucket and distribution should register secrets under these same names', i.e. it is written against infrastructure that does not yet exist. Nothing in docs/ or the plan tracks who is provisioning the Sector bucket, distribution and OIDC role, and phase-11's staged rollout depends on it.

**Evidence:** `.github/workflows/deploy.yml (Configure AWS credentials step, role-to-assume SectorS3GithubRole; preceding comment on PROD_AWS_* secret names)`

### scanvault/docs/ holds three cutover memos, is linked from nothing, and has no architecture or local-setup doc

*ops · needs: engineering*

docs/ contains only decommission-dashboard.md, feature-flags-decision.md and session-handoff.md. `grep -n 'docs/' README.md CONTRACTS.md` returns no matches — neither entry-point document references the folder. There is no system-architecture.md, local-setup doc, roadmap or codebase-summary despite gusi-lms/CLAUDE.md's stated docs convention, so the only description of the local stack is the README section that is now wrong.

**Evidence:** `ls /Users/lap16299/Documents/code/gusi-lms/scanvault/docs/; `grep -n 'docs/' README.md CONTRACTS.md` → no matches`

### API-side Sector work runs from worktrees under a session-scoped /private/tmp scratchpad

*ops · needs: engineering*

The :5003 instance serving :3100 runs with PWD=/private/tmp/claude-501/-Users-lap16299-Documents-code-gusi-lms/ec189ad1-d628-4150-9456-6330d395431a/scratchpad/wt/api, and so do :5002 (PID 17176) and the api-pathology instance. The branches themselves live in gusi_nodejs_api/.git and survive, but every checkout, node_modules tree and running process sits under a path containing a session UUID in /private/tmp. Nothing documents how to recreate these checkouts, and the path is not reproducible for another person or another session.

**Evidence:** `ps PID 84693 / 17176 PWD=/private/tmp/claude-501/.../ec189ad1-d628-4150-9456-6330d395431a/scratchpad/wt/api; `git worktree list` in gusi_nodejs_api`

### Parent gusi-lms/docs/local-setup-lms.md port table knows nothing about the Sector stack

*ops · needs: engineering*

The 'Ports' table lists 3000 (dashboard), 3002 (console), 5001 (API), 27017, 9000/9001. No 3100, 3101, 5002 or 5003, and `grep -n '3100\|3101\|5002\|5003\|gusi_prod_mirror' docs/local-setup-lms.md` returns nothing. gusi-lms/CLAUDE.md points newcomers at this file as the 'verified local setup, traps, blockers' doc, so it now under-describes the machine by three services and one database.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/docs/local-setup-lms.md:445-452; grep for 3100/3101/5002/5003/gusi_prod_mirror in that file → no matches`

### Parent gusi-lms/CLAUDE.md never mentions scanvault or Sector

*ops · needs: engineering*

`grep -n 'scanvault\|Sector\|sector' /Users/lap16299/Documents/code/gusi-lms/CLAUDE.md` returns nothing. Its 'Cloned repos' section names only gusi_nodejs_api and gusi_web_dashboard. The parent README does list scanvault/ (line 14), but CLAUDE.md is the always-loaded instruction file, so anyone (or any agent) working from the parent folder is never told the third repo exists, which ports it uses, or that the API must be on feat/sector-api.

**Evidence:** `grep on /Users/lap16299/Documents/code/gusi-lms/CLAUDE.md → no match for scanvault/Sector; /Users/lap16299/Documents/code/gusi-lms/README.md:13-17 does list it`


## Minor (27)

### Three course-UI flags are still marked "Not decided here" although features/courses has since shipped

*phase11 · needs: engineering*

docs/feature-flags-decision.md scopes itself to features/{scan-list,scan-detail,create-scan,account,groups} and leaves course_new-ui-v2_all, course_new-ui-v3_all and my-course-temporary-view-mode undecided because "features/courses is being built in a parallel, in-flight phase". That phase has landed — apps/web/src/features/ now contains courses, home, gallery, sage, assignments, question-banks, quiz (commit 77b7839 "merge: the course runner, taking a course end to end"). Since Sector reads no flag service, every undecided flag is silently resolving to whatever was built; the doc's stated purpose was to stop exactly that drift.

**Evidence:** `docs/feature-flags-decision.md:60-64 and the final table row; `ls apps/web/src/features/` shows courses/home/gallery/sage/assignments/question-banks/quiz; feat/sector commit 77b7839`

### /dashboard/not-found is missing from the legacy route map, violating the map's own stated rule

*phase11 · needs: engineering*

The dashboard routed `/dashboard/not-found` (App.tsx:187, DashboardNotFoundPage). legacy-route-map.ts has no row for it (grep 'not-found' returns nothing), so it falls through /dashboard/* → resolveLegacyPath → `unknown` → NotFoundPage. The map documents `unknown` as reserved for "anything the dashboard did not route either", so this path breaks the invariant the map claims and the generated decommission doc is silently short one row. Behaviourally benign (a 404 page 404s), but it means the inventory is not actually exhaustive.

**Evidence:** `gusi_web_dashboard/src/App.tsx:187; grep 'not-found' apps/web/src/app/legacy-route-map.ts → no match; legacy-route-map.ts resolveLegacyPath doc comment`

### Route map and generated decommission doc still say the home screen has not landed

*phase11 · needs: engineering*

The `/dashboard` row's note reads "The home screen replaces it; until that lands, / forwards to the first permitted list." That is stale: router.tsx mounts `{ index: true, element: <HomeRoute /> }` and home-route.tsx resolves the role's dashboard with no redirect (FirstPermittedRedirect is now used only for the /scans/group and /scans/expert parents in scan-vault-routes.tsx:94,97). Because docs/decommission-dashboard.md is generated from this file, the stale sentence is reproduced at docs line 17 and will ship in the decommission record.

**Evidence:** `apps/web/src/app/legacy-route-map.ts ~line 312 note; docs/decommission-dashboard.md:17; apps/web/src/app/router.tsx:87 and apps/web/src/features/home/home-route.tsx:12-16`

### Is self-service registration still wanted, or are all real accounts minted by the WooCommerce webhook?

*decisions · needs: user-decision*

0 referrals against 3,152 users points at the webhook. If registration is dead, the register surface is a delete, not a port — a scope decision that changes what Phase 11's decommission list says about `/register`.

**Evidence:** `plans/reports/from-module-study-to-port-plan-260913-0640-rest-of-scanhub-into-scanvault-report.md:343`

### Is Insights confirmed as the dashboard replacement, and on what timeline?

*decisions · needs: user-decision*

The whole home-screen investment (Phase 10, 22 days, the largest line in the plan) and the decommission sequencing assume an answer here. Unanswered since the module study.

**Evidence:** `plans/reports/from-module-study-to-port-plan-260913-0640-rest-of-scanhub-into-scanvault-report.md:352`

### Is reset-upload meant to be a learner action at all?

*decisions · needs: user-decision*

The API logs reset-upload as an admin action and checks no ownership, yet Phase 4 shipped it as learner recovery (`packages/api-client/src/endpoints/scan-reset-upload.ts` exists). Whether the capability belongs to learners is a product/authorization call the security report leaves open.

**Evidence:** `plans/reports/from-sector-port-to-api-team-260914-0031-incidental-security-findings-report.md:215`

### Sage has no entitlement check — any signed-in user gets the tutor frame

*decisions · needs: user-decision*

`SageFrame` renders for any signed-in user; `if (!user)` only covers the pre-session-restore instant. The legacy nav entry carries no permissions and no feature flag (unlike its sibling Interpretation Challenge, which does), so the port is faithful — but if an entitlement was ever expected commercially, it never existed on either side and would have to be created.

**Evidence:** `plans/reports/code-reviewer-260914-0516-phase-09-gallery-taxonomy-assignments-sage-review-report.md:189`

### Required scan findings: advisory (as built) or blocking submit (as the original)?

*decisions · needs: user-decision*

The original hard-blocks submit; Sector warns in three places and lets it through, so the port accepts studies the original rejects. Phase 4 records this under "Deliberately still open" with "revisit only if a clinician asks" — meaning no clinician has been asked. A clinical call parked as a design call.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/phase-04-scan-surfaces-to-parity.md:57-61; plans/reports/from-parity-audit-to-backlog-260913-0640-...-report.md:147`

### OTP: stop answering 400 for an unknown address, and where do staging OTP emails go?

*decisions · needs: user-decision*

The send-otp route answers 400 for an unknown address (account enumeration on the wire); Sector's client hides it but the API does not. Separately, the whole lockout path was proven only through local Mailpit — nobody has said where OTP mail goes in staging, so the Phase 3 fix is unproven anywhere but a laptop.

**Evidence:** `plans/reports/from-plan-to-implementation-260913-2001-sector-phase-03-close-the-lockout-report.md:73-75`

### Data governance: is an anonymised fixture dump acceptable for CI, and who grants staging S3 access?

*decisions · needs: other-team*

Fidelity runs against a local production mirror carrying real PII; the proposal is an anonymised dump (no users, no notes text) for CI, which needs a privacy sign-off nobody has given. Separately, real media playback has never been proven once because nobody has granted staging S3 access. Both block moving verification off one developer's machine.

**Evidence:** `plans/reports/from-plan-to-implementation-260913-1905-sector-phase-02-real-data-proven-report.md:117 and :121`

### Per-group notification card sits behind `edit:group` — move it out for leaders, or is the account-wide card enough?

*decisions · needs: user-decision*

Group leaders without `edit:group` cannot reach the per-group notification card at all. The reviewer asks whether it should move out from behind the permission, or whether the account-wide card makes the tab's card redundant. A product call on who controls group notifications.

**Evidence:** `plans/reports/code-reviewer-260914-0147-group-export-surface-and-form-layer-adversarial-review-report.md:402-404`

### Is a module/topic assignment picker in near-term scope? 96% of real assignments are module/topic

*decisions · needs: user-decision*

Mirror counts: module 4,265, topic 4,092, course 376, quiz 1. The group assignment form takes only a pasted course id, so the overwhelming majority of real assignments cannot be created in Sector. The reviewer's framing: if a picker is not coming soon, the empty-state copy needs changing now. (Related: no course-catalog picker exists anywhere in Sector — exports and group-courses both take a raw pasted course id.)

**Evidence:** `plans/reports/code-reviewer-260914-0147-group-export-surface-and-form-layer-adversarial-review-report.md:400-401; plans/reports/group-export-surface-and-form-layer-260914-0110-phase-08b-report.md:147-150`

### Administrator's group picker auto-selects the first of the first 100 groups — open on nothing, or order by size/activity?

*decisions · needs: user-decision*

In the mirror that first group is an empty fixtures group, so an administrator's home opens on meaningless data. The remediation report asks whether it should open on nothing until a group is chosen, or order by size or recent activity. A UX call left on the unmerged `fix/sector-home-dashboards`.

**Evidence:** `plans/reports/code-reviewer-260914-0515-phase-10-home-screen-blocker-remediation-report.md:180-182`

### Who operates the 57 `/api/v2/fellowship-*` endpoints?

*decisions · needs: other-team*

Suspected to be the external Applovin app. It matters for the decommission list: if an external consumer depends on them, they are not Sector's to retire, and nobody has confirmed the owner.

**Evidence:** `plans/reports/from-module-study-to-port-plan-260913-0640-rest-of-scanhub-into-scanvault-report.md:351`

### get-media-files.ts rewrite touches the production media path to add a dev-only MinIO branch

*api · needs: other-team*

75aeae17 rewrites the shared getMediaFiles to route through signMediaUrl, gated on `process.env.NODE_ENV === 'development' && Boolean(process.env.S3_ENDPOINT)`. The gate looks correct and mirrors lib/s3.ts, but this is the function behind every media URL the API returns, changed solely so Sector could be exercised locally. It carries no test in the diff. If the API team prefers not to take a local-dev affordance into a hot production path, it is the one change on the branch that could be dropped without breaking Sector in a deployed environment.

**Evidence:** `wt/api src/utils/get-media-files.ts:13-18 (useLocalObjectStore)`

### GET /api/pathology-gallery/categories gains a 5-minute in-process cache — editor-visible latency change

*api · needs: user-decision*

The rewritten endpoint caches its response in a module-level variable for CATEGORIES_CACHE_TTL_MS. Consequence, stated in the code: a category a content editor just published can take up to five minutes to appear. That is a content-operations behaviour change, and with multiple API processes the staleness is per-process, so editors can see the bar flip between old and new on refresh. Worth confirming with whoever manages gallery content.

**Evidence:** `wt/api src/app/pathology-gallery/pathology-gallery.controller.ts:57-62 (CATEGORIES_CACHE_TTL_MS, categoriesCache)`

### Security finding 11 — Referrals surface carries an enumerable PII leak; closing it depends on a deletion decision nobody has made

*api · needs: user-decision*

Report records 0 referral documents against 3,152 users and recommends deleting the surface rather than porting it, which also closes the leak. Deleting an API surface is not a Sector-side call. No branch touches it.

**Evidence:** `plans/reports/from-sector-port-to-api-team-260914-0031-incidental-security-findings-report.md §11`

### HTML entities in course content titles render literally — legacy's decode helper was not ported

*code · needs: engineering*

gusi_web_dashboard has `formatLessonTitle`/`formatTopicTitle`/`formatQuizTitle` in src/pages/dashboard/my-courses/util.ts:536-546, each `title.replace(/&amp;/g, '&').trim()`, called from course-sidebar-v2/v3, topic-details, quiz-details and content-title. Sector has no equivalent: `git grep` for a decode helper or `replace(/&` across apps/ and packages/ returns nothing. 12 render sites emit the raw string: courses/my-courses/course-card.tsx:36, expired-courses-section.tsx:36, outline/course-outline-item-row.tsx:64, runner/course-runner-page.tsx:110, runner/outline-sidebar.tsx:91,112, runner/quiz-view.tsx:192, groups/forms/group-courses-panel.tsx:134, home/my-learning-panel.tsx:207,229. Affected records on the local mirror (gusi_prod_mirror), all live (deletedAt null): 5 v2lessons ("Renal &amp; Bladder PreCourse", "Skin &amp; Soft Tissue PreCourse", "Invoices &amp; Estimates", "Additional Materials &amp; Tutorials", "OB 2nd &amp; 3rd Trimesters"), 1 v2topic ("OB 1st Tri Case &amp; Literature (Fundamentals)"), 1 v2quiz ("Skin &amp; Soft Tissue PreCourse Quiz") = 7. Separately, 3 course titles carry raw `<br>` tags (2 in courses, 1 in v2courses) which render literally in Sector — legacy's helper did not strip those either, so that part is parity, not regression.

**Evidence:** `gusi_web_dashboard/src/pages/dashboard/my-courses/util.ts:536-546 vs no equivalent in scanvault; apps/web/src/features/courses/runner/outline-sidebar.tsx:91`

### README "Known gaps" carries a false claim about multipart upload, and an imprecise one about scan tags

*code · needs: engineering*

README.md:275-276 states "Multipart upload is wired in the client but unused — the wizard always uses the single-shot presigned PUT, so there is no resume after a network drop." This is wrong. `use-create-scan-draft.ts:304` calls `uploadScanObject`, which at multipart-upload.ts:80-84 routes anything above `MULTIPART_THRESHOLD` (16 MiB, line 33) to `uploadInParts`; the hook holds a `sessionsRef` (lines 255, 315-317, 325) and persists each accepted part via `putDraftSession`, so resume IS implemented. Both the code and the README bullet landed in the same commit (56fb230), so the bullet was never true. Same bullet block, README.md:277: "Note deletion, scan tags and the AI review panel are not ported" — note deletion is correct (scan-note.ts exports only `getScanNotes`/`addScanNote`) and the AI panel is correct, but scan tags ARE ported: `addScanTag`/`removeScanTag` exist and are consumed through `useAddScanTag`/`useRemoveScanTag` in scan-list/rows/use-scan-completion-tag.ts. This is the document a cutover reader will trust for what is and is not done.

**Evidence:** `README.md:275-277 vs apps/web/src/features/create-scan/model/use-create-scan-draft.ts:304 and packages/api-client/src/multipart-upload.ts:80-84`

### Dead unbuilt-surface scaffolding: the table is empty but the page and route generator remain

*code · needs: engineering*

`apps/web/src/routes/unbuilt-surfaces.ts:48` is `export const UNBUILT_SURFACES: Readonly<Record<string, UnbuiltSurface>> = {};` — every row (courses, question-banks, group-administration) has graduated to a real page. `unbuilt-surface-routes.tsx` therefore maps over an empty object and contributes zero routes, yet is still imported and spread at feature-routes.tsx:47, and `unbuilt-surface-page.tsx` (38 lines, including 2 more hard-coded English strings) is still referenced by it. ~100 lines of scaffolding plus the `UnbuiltSurface` type and its doc comment now describe a mechanism with no instances.

**Evidence:** `apps/web/src/routes/unbuilt-surfaces.ts:48; apps/web/src/routes/unbuilt-surface-routes.tsx:22; apps/web/src/routes/feature-routes.tsx:47`

### AI scan-review data is parsed into the schema for 388 production scans but rendered nowhere

*code · needs: user-decision*

`packages/api-client/src/schemas/scan.ts:315-316` parse `aiScanQuality` and `aiScanQualityMd` onto every scan, and `aiScanQualitySchema` (scan.ts:159-173) is exported from the package index (index.ts:142,159) and listed in the fidelity manifest's `proves` (manifest.ts:85). No component in apps/web/src reads either field — grep for `aiScanQuality|AiScanQuality` outside packages/ and tests returns nothing. On the local mirror, 388 of 31,487 scans carry a non-empty `aiScanQualityMd`, so this is real content a reviewer saw in the dashboard and will not see in Sector. README.md:277 names it as a known gap, correctly; the leftover is that the parsing and fidelity cost is being paid for a surface that does not exist.

**Evidence:** `packages/api-client/src/schemas/scan.ts:315-316; no reader in apps/web/src; mirror query: 388 of 31487 scans with aiScanQualityMd`

### Parent docs/system-architecture.md still carries the flag count Sector's own doc proved wrong

*ops · needs: engineering*

system-architecture.md:72 reads 'Code declares 22 flags, GrowthBook serves 18, only 13 match.' scanvault/docs/feature-flags-decision.md measured FEATURE_FLAGS directly on 2026-09-14 and found 24 declared, explicitly naming docs/system-architecture.md in the parent folder as the source of the wrong number. The parent doc was never corrected, so the stale figure is still the one anyone reads first — and phase-11-cutover.md:40 repeats '22 flags' as well.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/docs/system-architecture.md:72; scanvault/docs/feature-flags-decision.md ('Declared: 24, not 22' section); plans/260913-1451-sector-replaces-scanhub/phase-11-cutover.md:40`

### plan.md front-matter says status: pending and branch: main while ten of eleven phases are done on feat/sector

*ops · needs: engineering*

plans/260913-1451-sector-replaces-scanhub/plan.md:4 reads `status: pending` and :6 reads `branch: "main"`. The body's phase table is accurate (1-10 Done, 11 In progress), and every other plan under plans/ carries `status: completed`, so the convention exists and only the live programme is out of sync. Any tooling that lists plans by front-matter shows the active 126-day programme as not started, against the wrong branch.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/plan.md:4,6 vs its Phases table; plans/260912-*/plan.md and 260913-0524-*/plan.md all `status: completed``

### Phase files use three different status vocabularies for the same state

*ops · needs: engineering*

Phases 1,2,3,4,5,6,8,9 declare `status: completed`; phases 7 and 10 declare `status: done`; phase 11 declares `status: in-progress`. Same meaning, three spellings, in one plan directory — anything parsing the front-matter (the plans kanban) will bucket them inconsistently.

**Evidence:** `plans/260913-1451-sector-replaces-scanhub/phase-07-taking-a-course.md:4 and phase-10-the-home-screen.md:4 (`done`) vs phase-01..06,08,09 (`completed`)`

### Generated decommission doc and its source still say the home screen has not landed

*ops · needs: engineering*

apps/web/src/app/legacy-route-map.ts:93 carries the note 'The home screen replaces it; until that lands, / forwards to the first permitted list', and docs/decommission-dashboard.md:18 reproduces it verbatim (the doc is generated from that map by `pnpm docs:legacy-routes`, with a test asserting they match). Phase 10 is Done and apps/web/src/app/router.tsx:88 mounts `{ index: true, element: <HomeRoute /> }` — there is no redirect. The test enforces that the two stay identical, not that either is true, so the stale sentence will survive every gate.

**Evidence:** `apps/web/src/app/legacy-route-map.ts:93; docs/decommission-dashboard.md:18; apps/web/src/app/router.tsx:88`

### README's 'Layout of the app' lists 3 feature directories; 12 exist

*ops · needs: engineering*

README.md:251-256 shows features/ as scan-list, scan-detail, create-scan. apps/web/src/features/ now contains account, assignments, courses, create-scan, gallery, groups, home, question-banks, quiz, sage, scan-detail, scan-list. Nine directories built across phases 3 and 5-10 are invisible to anyone orienting from the README.

**Evidence:** `README.md:251-256; `ls apps/web/src/features/` → 12 entries`

### README's 'Known gaps' still says multipart upload is wired but unused

*ops · needs: engineering*

README.md:275-276 states the wizard 'always uses the single-shot presigned PUT, so there is no resume after a network drop'. Multipart is in use: apps/web/src/features/create-scan/model/use-create-scan-draft.ts passes `session`/`onSession` into uploadScanObject and persists resume points via putDraftSession on every accepted part (see the comment at :301, 'a resumed multipart upload ignores it and keeps writing to the object its session already opened'), backed by packages/api-client/src/multipart-upload.ts and draft-blob-store.ts. The other Known gaps entries (DICOM placeholder, organization forms not rendered) still hold.

**Evidence:** `README.md:275-276; apps/web/src/features/create-scan/model/use-create-scan-draft.ts:301,315-322; packages/api-client/src/multipart-upload.ts:127,179,218`


## Critic pass — what the sweeps missed or got wrong

### Retiring /switch-user breaks the WooCommerce purchase→app sign-in handoff; the decommission doc's evidence for retiring it is incomplete
*blocker · needs: engineering*

The API mints `${CLIENT_BASE_URL}/switch-user?token=<5-min JWT>` from TWO places, not one. `src/app/webhook/wordpress.controller.ts:158-160` builds it as `redirectLink` inside `wordpressUserLogin`, mounted live at `POST /webhooks/wordpress/login` (webhook.route.ts:53 → wordpress.route.ts:17). That is the WordPress/WooCommerce store's single-sign-on handoff for purchasers — and memory records that essentially all real accounts are minted by that webhook, making it the main door, not an admin nicety. Sector retires `/switch-user` (legacy-route-map.ts:436-439, `retired('switch-user', SECTOR_PATH.login)`) and shows copy naming an "internal console" — which is the wrong message for a paying customer. Because docs/session-handoff.md:5 establishes that Sector takes over the dashboard's origin, CLIENT_BASE_URL resolves to Sector after cutover. The shipped decommission record's Evidence column says only "the token is minted by POST /api/switch-user/generate-token from the internal console" — true but incomplete, and the omission is what makes the retirement look safe. No sweep touched the WordPress webhook.

**Evidence:** `/private/tmp/claude-501/-Users-lap16299-Documents-code-gusi-lms/ec189ad1-d628-4150-9456-6330d395431a/scratchpad/wt/api/src/app/webhook/wordpress.controller.ts:158-160; wordpress.route.ts:17; /Users/lap16299/Documents/code/gusi-lms/scanvault/apps/web/src/app/legacy-route-map.ts:436-439; docs/decommission-dashboard.md (Retired row `/switch-user`)`

### deploy.yml's `aws s3 sync --delete` deletes the mobile apps' deep-link association files and the Firebase push service worker
*blocker · needs: engineering*

Sector's deploy job runs `aws s3 sync apps/web/dist/ s3://${{ secrets.PROD_AWS_BUCKET_NAME }}/ --delete` with no `--exclude`, and `apps/web/public/` contains exactly one file (favicon.svg). The dashboard's bucket holds `.well-known/apple-app-site-association` (claiming `"paths": ["*"]` for `DN5M2G3SP9.com.gusi.student.gusiStudent`) and `.well-known/assetlinks.json` (all URLs for `com.gusi.student.gusi_student`), plus `firebase-messaging-sw.js`. The dashboard's own ci.yml treats these as load-bearing: it hard-fails the build when they are missing, uploads them with explicit `--content-type application/json`, verifies the service worker has no unresolved `__VITE_FIREBASE_` placeholders, and deliberately syncs the rest WITHOUT `--delete` and WITH `--exclude ".well-known/*"`. Sector's workflow reproduces none of that while its header comment claims "Same shape as gusi_web_dashboard's ci.yml". Since same-origin cutover is the documented plan (docs/session-handoff.md:5), first deploy silently kills iOS Universal Links and Android App Links for the shipped mobile apps. The 57-row decommission inventory is route-shaped and has no row for `.well-known`.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/.github/workflows/deploy.yml (Deploy to S3 step); /Users/lap16299/Documents/code/gusi-lms/gusi_web_dashboard/.github/workflows/ci.yml (Deploy to S3 step, `--exclude ".well-known/*"`); gusi_web_dashboard/public/.well-known/apple-app-site-association; scanvault/apps/web/public/ (favicon.svg only)`

### The provisioning ask omits the SPA 403/404→index.html fallback, without which every legacy redirect and deep link 404s
*significant · needs: other-team*

Sector's entire legacy-URL promise is client-side: `LegacyRedirect` is a React Router component that resolves `/dashboard/*` against legacy-route-map.ts, so the browser must first load Sector's bundle at that path. On S3+CloudFront that requires a custom error response mapping 403/404 → `/index.html` with status 200. deploy.yml's provisioning comment asks only that "whoever provisions this repo's bucket and distribution should register secrets under these same names" — bucket, distribution, OIDC role, five secrets. It says nothing about the error-response mapping, nor about the `.well-known` content-type handling the dashboard encodes in its workflow. If the open decision "does Sector get its own bucket/distribution" resolves to yes, the success criterion "No :3000 URL 404s after cutover" fails on the first deep link — including `/login` — and nothing in the repo would have told the provisioner.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/.github/workflows/deploy.yml (Configure AWS credentials comment block); apps/web/src/app/legacy-redirect.tsx; docs/session-handoff.md:5-15`

### Observability and analytics drop to zero at cutover and appear in no drop list
*significant · needs: user-decision*

Verified by grep across apps/ and packages/: Sector has no Sentry, no Google Analytics, no Umami, no Canny, and no Firebase — apps/web/package.json carries none of those dependencies, and the only Stripe references are server-hosted checkout URLs. The dashboard's ci.yml injects VITE_SENTRY_DSN + SENTRY_AUTH_TOKEN, VITE_GA_TRACKING_ID, VITE_UMAMI_WEBSITE_ID and VITE_CANNY_APP_ID on every build; Sector's deploy.yml sets exactly one build var (VITE_API_BASE_URL). So from the moment of the swap there is no frontend exception reporting and no usage telemetry — during precisely the staged rollout (internal → pilot → all) that is supposed to be judged on how it goes, and with no way to detect a regression that does not produce a support ticket. The decommission doc inventories routes only, so a dropped cross-cutting integration has no row anywhere.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/apps/web/package.json; scanvault/.github/workflows/deploy.yml (Build step env); /Users/lap16299/Documents/code/gusi-lms/gusi_web_dashboard/.github/workflows/ci.yml (Set environment variables based on branch)`

### The repo Sector replaces already has PR CI and three deploy branches; Sector dropped both while claiming parity of shape
*significant · needs: engineering*

gusi_web_dashboard has TWO workflows: ci.yml (push to main/staging/dev) and pr-ci.yml, which runs lint, typecheck and test on `pull_request` into main and staging. Sector copied only the deploy half and its comment asserts "Same shape as gusi_web_dashboard's ci.yml" and "this repo has only a `main` branch" (there are 20 local branches). Two consequences the sweeps framed only as "no PR CI": the port regressed a gate the predecessor repo already had, and because the dashboard deploys staging and dev from their own branches while Sector declares one environment, there is no staging target to run step 6's internal/pilot stages against — the missing rollout mechanism is not just unbuilt, the workflow actively documents a single-branch assumption that forecloses it.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/gusi_web_dashboard/.github/workflows/pr-ci.yml:1-8; gusi_web_dashboard/.github/workflows/ci.yml:4-10; /Users/lap16299/Documents/code/gusi-lms/scanvault/.github/workflows/deploy.yml:3-11`

### media-proxy-url.ts asserts a production CORS requirement from staging-only evidence that the dashboard's live download contradicts
*significant · needs: engineering*

The module header states the distribution serves NO CORS headers, that Download "fails honestly" in a built bundle, and that "Production needs a CORS policy on the distribution, or a streaming route on the API" — explicitly "Verified against the staging distribution". But gusi_web_dashboard/src/lib/file-utils.ts:189 performs the identical cross-origin `fetch(file.url)` on the same signed CloudFront URLs, and `useZipDownload` is wired into the row actions of all six live scan lists (my-scans, shared-scans, pending-scans, reviewed-scans, expert-scans, expert-reviewed-scans). So either production already serves CORS — in which case the stated to-do is false and will generate an unnecessary infra ticket — or the dashboard's Download has been silently broken in production on every scan list. One `curl -H 'Origin: …' -I` against a production signed URL settles it; nobody has run it. Worse, Sector's dev-only proxy means no local run or cold-load sweep can ever surface the answer: the one environment where this is testable is the one where it is masked.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/apps/web/src/lib/media-proxy-url.ts:1-29 and :82-86; /Users/lap16299/Documents/code/gusi-lms/gusi_web_dashboard/src/lib/file-utils.ts:166-202; gusi_web_dashboard/src/pages/dashboard/scans/*/components/data-table-row-actions.tsx`

### Two more URLs the API mints into emails today are missing from the route map, on top of /dashboard/not-found
*minor · needs: engineering*

`resolveLegacyPath` iterates compiled exact patterns and falls through to `{ kind: 'unknown' }` → generic NotFoundPage. Missing rows: (1) `/dashboard/fellowship/:enrollmentId`, emailed as `dashboardUrl` from fellowship-enrollment.controller.ts:207 and :400 — the map has `/dashboard/fellowship` and `/dashboard/fellowship/mentee` only; (2) `/dashboard/fellowships/:fellowshipId` (plural), the "View Fellowship Dashboard" button in mentor-assignment.eta:78. Both bypass the fellowship retired-surface explainer and land on a bare 404, which is the exact outcome the map exists to prevent. I independently diffed every `<Route path=…>` in gusi_web_dashboard/src/App.tsx against the map and found no other missing rows, so the inventory's gaps are these two plus the already-reported `/dashboard/not-found` — the map is short three rows, not one.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/apps/web/src/app/legacy-route-map.ts:382-391 and resolveLegacyPath; wt/api/src/app/v2/fellowship/enrollment/fellowship-enrollment.controller.ts:207,400; wt/api/src/lib/mail/templates/mentor-assignment.eta:78`

### The shipped route map promises an add-files capability that no Sector code implements and the flag doc permanently dropped
*minor · needs: engineering*

docs/decommission-dashboard.md forwards `/dashboard/scans/my-scans/:scanId/upload-file` → `/scans/my/:scanId` with the note "Adding files happens on the scan itself." Verified false: `addScanFiles` is imported only by apps/web/src/features/create-scan/model/submit-draft.ts (draft recovery after a partial submit); nothing under apps/web/src/features/scan-detail references it. The sweeps raised the add-file contradiction as plan.md-vs-feature-flags-decision.md; this is the third artifact in it and the only one a user actually collides with — an old bookmark forwards to a page whose accompanying note tells them to do something the page cannot do. It also means the generated decommission record ships a factual claim about capability, not just about routing.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/docs/decommission-dashboard.md (Forwarded row `/dashboard/scans/my-scans/:scanId/upload-file`); apps/web/src/features/create-scan/model/submit-draft.ts:2,308; grep of apps/web/src/features/scan-detail for addScanFiles returns nothing`

### Correction: fix/sector-gallery is 5 commits ahead at fab145a (not 4 at 77143fd); both outstanding branches are 0 behind and merge cleanly, and two other fix branches are already merged
*minor · needs: engineering*

`git rev-list --count feat/sector..fix/sector-gallery` = 5: the sweeps missed `7dfab50 test(api-client): pin the assignments read to the group-scoped route` and the merge `fab145a`, and named a stale tip. Both outstanding branches are 0 commits BEHIND feat/sector, so each is a fast-forward, and `git merge-tree --write-tree fix/sector-gallery fix/sector-home-dashboards` exits 0 with no conflict despite both touching all seven locale JSONs, packages/api-client/src/fidelity/manifest.ts and index.ts — so the two can land in either order with no merge work. That materially lowers the cost the sweeps attached to these items. Separately, `git worktree list` shows four fix branches, not two: fix/sector-course-shapes and fix/sector-group-admin are already ancestors of feat/sector, so the ops finding that these branches are "recorded nowhere outside the worktree list" covers four branches of which only two are actually outstanding.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault: git log --oneline feat/sector..fix/sector-gallery; git merge-tree --write-tree fix/sector-gallery fix/sector-home-dashboards (exit 0); git worktree list`

### Correction: the dashboard→Sector session handoff IS built and documented; the real undocumented drop is Google/Apple sign-in, and it is near-empty
*minor · needs: engineering*

I checked whether storage-migration.ts only covers Sector's own `scanvault.` → `sector.` rename, which would have signed every user out at cutover. It does not: `migrateLegacyDashboardSession` (storage-migration.ts:140-170) reads the dashboard's bare `token` and `user` keys, validates them against authSessionSchema and writes `sector.session`, and docs/session-handoff.md documents both the same-origin premise and the re-auth fallback. That hypothesis is dead. What IS undocumented: Sector's login page offers no social sign-in, while the dashboard has Google and Apple via `signInWithPopup` → `POST /api/social-login` (src/pages/(auth)/login/page.tsx:96,110). The decommission inventory is route-shaped, so a dropped auth *method* on a kept route (`/login`) has no row anywhere. I sized it before reporting: gusi_prod_mirror.users has 1 non-empty googleId and 0 appleId against 3,155 users — so this is a documentation gap, not a migration risk, and should not be escalated beyond a line in the decommission doc.

**Evidence:** `/Users/lap16299/Documents/code/gusi-lms/scanvault/apps/web/src/app/storage-migration.ts:140-170; docs/session-handoff.md:50-60; /Users/lap16299/Documents/code/gusi-lms/gusi_web_dashboard/src/pages/(auth)/login/page.tsx:96,110; mongosh gusi_prod_mirror users count (googleId=1, appleId=0, total=3155)`


## Unresolved questions (decisions a human must make)

- **Locales are not complete: 444 gaps are permanently excused by the gate's baseline** — locale-completeness-baseline.json excuses 74 keys in each of de, es, fil, fr, it, pt — 444 total excused translations. The gate enforces no *new* rot (and fails if a baselined key gets translated without trimming the bas…
- **Step 6's staged rollout (internal → pilot group → all) has no mechanism and no plan** — deploy.yml declares one environment and syncs the whole bundle to one bucket with `--delete` plus a `/*` CloudFront invalidation — an all-at-once swap. There is no cohort gate, and docs/feature-flags-decision.md delibera…
- **Six Phase-4 "must-builds" are recorded as permanently dropped by Phase 11 — which record is true?** — plan.md:33 elevated six items from arguable to must-build in Phase 4 (mark complete/incomplete, edit a submitted expert review, request expert review on an existing scan, AI Review Generator, reset-upload recovery, add/d…
- **Which ScanType generation the pathology gallery relation points at — v2 as backfilled, or the live v6 lineage** — The backfill wrote v2 scan-type ids onto 1,288 of 1,305 gallery rows across 13 categories, inheriting the legacy display heuristic `categoryVersions.find(v => v.version === 2)`. But `scantypes` runs to v6 across two orga…
- **FAST/EFAST scan-type mapping — the `FAST` type or the separate `eFAST` one** — Two gallery items (`eFAST Anatomy`, `eFAST Pathology`) map to no scan type and ship today as an `id: null` category tab. Escalated as a clinician's call by the plan and by both phase-09 reports; an `eFAST v6` scan type e…
- **Rapid Reviews disposition — drop the 15 items or keep them as a non-scan-type category** — The retired third-party product's 15 gallery items have no scan type by design and currently render as an `id: null` tab with a full count. The plan says they "want their own answer (drop, or a category that is not a sca…
- **Should a plain `administrator` be able to read and manage a group they do not lead?** — `administrator` does not bypass `assertLeadsGroup` — only Superadmin holds `admin:full-access` — so adding a course to a non-led group returns 403 and the Courses tab is visible but non-functional, and the administrator…
- **Is `scan reviewer` meant to hold `edit:group`, `edit:group-member` and `delete:group-member`?** — Confirmed against the mirror that the role does hold all three, so scan reviewers currently get the group settings tab and full member management in Sector. Both reviewers label it a product decision, not an engineering…
- **Five group export routes carry `authUser` only — is the hardcoded scoping flag meant to be flippable?** — `GET /report/:groupId`, `POST /export-scans/:groupId`, `POST /export-user-scans/:groupId`, `POST /export-course-progress`, `POST /export-course-data/:groupId` have no `withPermission`. They return member lists, scan acti…
- **Is the missing course-permission vocabulary (`publish:course` etc.) wanted, or is `edit:course` the intended gate?** — The eight commented-out guards on `course-meta-version.route.ts` named permissions that do not exist in `config/permissions.ts`. The triage fix deliberately used the smallest existing pair rather than inventing a permiss…
- **Does anyone want a production audit of what was published, archived or reassigned by unauthorised accounts?** — The course-version guards were never live (they would not compile), so any authenticated learner could publish or archive a course version, approve one, or reassign learners between versions — demonstrated at HTTP 200 ag…
- **Two customer-visible behaviour changes ride with the refresh-token revocation fix and need sign-off** — Explicitly headed "FIXED, needs sign-off". (1) `/api/me` can now return 401 where it returned 200 when a session is revoked mid-request — Sector handles it, but the deployed mobile client's behaviour is unknown and is in…
- **Confirm the home-screen scope cut with Liesl: no member table, no per-member drill, no assignment progress** — Phase 10 cut 14 endpoints to 8 and 242 i18n keys to ~50 by dropping the group member table, the per-member drill and assignment progress. The reviewer calls the accounting honest but the cut a product-scope decision, and…
- **Assignments shipped read-only — confirm the cut or scope the write half** — The legacy assignments console is ~1,742 lines (page + 4 dialogs); Phase 9 shipped list + filters only, because porting the write half meant modelling course/lesson/topic/quiz content pickers and bulk assignment. The imp…
- **Which of the seven locales actually have real users?** — Raised in three reports and in plan.md. Translating create-scan, scan-detail and the home screen is only worth it for locales that have learners, and the programme acceptance criterion ("no surface ships hard-coded Engli…
- **Feature flags: courses/home/gallery deliberately left undecided, and production GrowthBook state never verified** — `docs/feature-flags-decision.md:82` leaves `course_new-ui-v2_all`, `course_new-ui-v3_all` and `my-course-temporary-view-mode` "Not decided here" for whoever finishes those surfaces — those surfaces have now shipped (Phas…
- **Is the immutable-snapshot write fix funded and assigned, and is it CTP-1016?** — Raised identically in plan.md and two source reports. The Phase 6 read seam works against today's pointer structure and can swap data source later with no client change, but learner progress keeps corrupting until the wr…
- **Is "Sector" the public name or the internal one? Trademark and domain search not done** — Phase 1 shipped the rename (name, mark, nav, storage keys, `LOG_SOURCE`) on the stated reasoning that it is cheapest now and more expensive every week. The plan states plainly that the trademark and domain search is not…
- **Does DICOM upload survive as a surface, and should `create:dicom-ingestion` stay granted to every role?** — The pipeline makes an OpenAI vision call per DICOM and the permission is granted to every role — a cost and authorization question in one. Sector's DICOM viewer is a placeholder today (README.md:266 "labels DICOM files b…
- **Is the expired-course renewal flow meant to work at all? It takes a card number and does nothing** — Verbatim from the module study: the renewal flow collects a card number and performs no action. That is a live payment-adjacent surface on the dashboard Sector is replacing, and the decommission decision (port, fix, or r…
- **Group Administration is gated on the group-queue permission; the surface needs its own permission** — The nav entry is gated by reference on a scan-queue permission because no seeded role carries any group-management string — "right about who, wrong about why". The reviewer's explicit ask is to give the surface its own p…
- **Is self-service registration still wanted, or are all real accounts minted by the WooCommerce webhook?** — 0 referrals against 3,152 users points at the webhook. If registration is dead, the register surface is a delete, not a port — a scope decision that changes what Phase 11's decommission list says about `/register`.…
- **Is Insights confirmed as the dashboard replacement, and on what timeline?** — The whole home-screen investment (Phase 10, 22 days, the largest line in the plan) and the decommission sequencing assume an answer here. Unanswered since the module study.…
- **Is reset-upload meant to be a learner action at all?** — The API logs reset-upload as an admin action and checks no ownership, yet Phase 4 shipped it as learner recovery (`packages/api-client/src/endpoints/scan-reset-upload.ts` exists). Whether the capability belongs to learne…
- **Sage has no entitlement check — any signed-in user gets the tutor frame** — `SageFrame` renders for any signed-in user; `if (!user)` only covers the pre-session-restore instant. The legacy nav entry carries no permissions and no feature flag (unlike its sibling Interpretation Challenge, which do…
- **Required scan findings: advisory (as built) or blocking submit (as the original)?** — The original hard-blocks submit; Sector warns in three places and lets it through, so the port accepts studies the original rejects. Phase 4 records this under "Deliberately still open" with "revisit only if a clinician…
- **OTP: stop answering 400 for an unknown address, and where do staging OTP emails go?** — The send-otp route answers 400 for an unknown address (account enumeration on the wire); Sector's client hides it but the API does not. Separately, the whole lockout path was proven only through local Mailpit — nobody ha…
- **Per-group notification card sits behind `edit:group` — move it out for leaders, or is the account-wide card enough?** — Group leaders without `edit:group` cannot reach the per-group notification card at all. The reviewer asks whether it should move out from behind the permission, or whether the account-wide card makes the tab's card redun…
- **Is a module/topic assignment picker in near-term scope? 96% of real assignments are module/topic** — Mirror counts: module 4,265, topic 4,092, course 376, quiz 1. The group assignment form takes only a pasted course id, so the overwhelming majority of real assignments cannot be created in Sector. The reviewer's framing:…
- **Administrator's group picker auto-selects the first of the first 100 groups — open on nothing, or order by size/activity?** — In the mirror that first group is an empty fixtures group, so an administrator's home opens on meaningless data. The remediation report asks whether it should open on nothing until a group is chosen, or order by size or…
- **Behaviour change needing sign-off: GET /api/me can now return 401 where it returned 200** — auth.controller.ts getCurrentUser: when rotate() fails and refreshTokenService.isLive(session.id) is false, it throws HttpError(401, 'Session is no longer valid'). Triggers when a password reset/change or account deletio…
- **Behaviour change needing sign-off: PUT /api/users/:id now signs a user out when an admin edits their password or status** — user.controller.ts updateUserById now calls userService.revokeAllSessions when `bodyParse.password` is set or `body.status !== UserStatus.ACTIVE`. Previously this route left sessions alone while the dedicated password ro…
- **Behaviour change needing sign-off: password reset, self-service password change, and account deletion now revoke all sessions** — Four new revokeAllSessions call sites: auth.controller.ts resetPassword (:808), account.controller.ts updatePassword (:262) and deleteAccount (:300), user.controller.ts updateUserPassword (:536) and deleteUserById (:651)…
- **Behaviour change needing sign-off: GET /api/me rate limit loosened from 20 to 300 per 15 min per IP** — ae125a28 moves /me off the shared authRateLimit (20/15min, which also guards /login against password guessing) onto a new meRateLimit at max 300. Rationale in the code: a classroom of devices behind one NAT burned the sh…
- **Behaviour change needing sign-off: eight course-version routes now 403 for callers that previously got 200** — 62accade replaces commented-out guards with withPermission on publish, archive, restore, set-default, /:versionId/:status (approve), /course/:courseId/user-group, assign/user-course, assign/users, migrate/:userCourseId.…
- **GET /api/pathology-gallery/categories gains a 5-minute in-process cache — editor-visible latency change** — The rewritten endpoint caches its response in a module-level variable for CATEGORIES_CACHE_TTL_MS. Consequence, stated in the code: a category a content editor just published can take up to five minutes to appear. That i…
- **Security finding 11 — Referrals surface carries an enumerable PII leak; closing it depends on a deletion decision nobody has made** — Report records 0 referral documents against 3,152 users and recommends deleting the surface rather than porting it, which also closes the leak. Deleting an API surface is not a Sector-side call. No branch touches it.…
- **444 untranslated keys still baselined: the app shell and scan list are English-only in all six non-English locales** — Computed directly off the committed files: en.json has 649 leaf keys; de/es/fil/fr/it/pt each have 575, each missing the identical 74 keys, all excused in `locale-completeness-baseline.json` (74 per locale x 6 = 444). Th…
- **AI scan-review data is parsed into the schema for 388 production scans but rendered nowhere** — `packages/api-client/src/schemas/scan.ts:315-316` parse `aiScanQuality` and `aiScanQualityMd` onto every scan, and `aiScanQualitySchema` (scan.ts:159-173) is exported from the package index (index.ts:142,159) and listed…