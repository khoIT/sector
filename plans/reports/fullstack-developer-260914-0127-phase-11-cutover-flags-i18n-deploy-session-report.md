# Phase 11 cutover: i18n gate, feature flags, session handoff, deploy pipeline

Worktree: `<scratchpad>/wt/phase-11b`, branch `feat/sector-phase-11b`, based on
`feat/sector` @ `a4da385` (0 behind at final check, no merge needed).

## Scope built

Session handoff, feature flags, i18n completeness gate, deploy pipeline. Left the
route map, the two auth defects, staged rollout and decommission alone per the brief
(already done / owned by other phases).

## 1. i18n completeness gate (built first, per instructions)

- `apps/web/src/i18n/locale-completeness-baseline.json` — per-locale list of
  pre-existing gaps.
- `apps/web/src/i18n/locale-completeness-gate.test.ts` — the gate.

**Measured myself, not trusted:** ran a flatten-and-diff over the actual committed
`en.json` vs. the six other locales. Result: **74** missing/empty keys, and the
identical 74-key set in every one of the six non-English locales (verified set
equality, not just matching counts). This confirms the 74 already asserted in
`locale-key-parity.test.ts`'s comment and rejects the "68" figure — 68 does not match
either file on disk.

Gate behavior:
- Any `en.json` key missing or empty in a locale, and not named in that locale's
  baseline entry, fails with a message naming the locale, the count, and every missing
  key (e.g. `fr is missing 1 key(s) not covered by the baseline: createScan.storageDegradedTitle`).
- A baseline entry that is now actually translated also fails the build (a separate
  "no stale excuses" test) — forces whoever adds a translation to trim the baseline in
  the same PR instead of leaving a dead exemption.
- Two extra hygiene tests: every baseline locale has a matching file, and every
  baselined key actually exists in `en.json` (catches typos/renames in the baseline
  itself).

**Proved it fails, on purpose:** deleted `createScan.storageDegradedTitle` from
`fr.json`, ran the suite, got the exact failure above naming the key and locale, then
restored the file (`git diff` clean afterward). Full run below is with the key back.

Wired into CI via the `test` job in `deploy.yml` (`pnpm run test` runs every vitest
suite in the workspace, this one included) — no separate CI job needed since it's an
ordinary vitest file.

## 2. Feature flags — `docs/feature-flags-decision.md`

**Decision: Sector reads no runtime flag service.** Matches the instructed default;
evidence didn't contradict it (no `@growthbook/*` dependency or import anywhere in
`scanvault`, confirmed by grep across `apps/web/src` and `packages`).

**Verified the quoted numbers myself, per instructions — one was wrong:**
- Declared: **24**, not 22. Parsed `gusi_web_dashboard/src/config/features.ts`'s
  `FEATURE_FLAGS` object directly (24 unique string values, confirmed two ways).
- Served: **18**. Confirmed live — fetched `cdn.growthbook.io/api/features/<client
  key>` using the real `VITE_GROWTHBOOK_CLIENT_KEY` from `gusi_web_dashboard/.env`
  (a client-side SDK key, meant to ship in a public bundle — not a credential
  exposure to read it for this check; never printed or committed). Matches quoted.
- Match: **13**, computed as the set intersection. Matches quoted, and is robust to
  the declared-count correction since it's intersection, not a function of the total.

The doc records a permanent on/off decision for every flag whose surface exists in
Sector today (scan-list, scan-detail, create-scan, account, groups), each backed by a
file that actually exists (e.g. `group-routing-panel.tsx` for group selection,
`notification-preferences.tsx` for the two settings flags) or a named gap
(`README.md`'s "Known gaps" for org-forms and the AI review panel; no Stripe
dependency anywhere for the five commerce flags). Flags belonging to
`features/{courses,home,gallery}` are explicitly left undecided — those are in-flight
in parallel phases and not mine to close out.

Also wrote up, as asked, what reading GrowthBook properly would cost: the
`setAttributes` plumbing (data already exists on `AuthUser`, ~a day of wiring in the
auth context), the client + provider (~half a day), who has to own flag-definition
reconciliation (nobody does today, which is exactly how the dashboard got its 5
orphaned + 11 unmatched flags), and what has to be true before a targeting rule
actually works (attributes shipped, the rule configured against a real one, and some
way to verify it applied — the dashboard has none).

## 3. Session handoff

**Established same-origin from the existing code, not assumed:** `LegacyRedirect`
(`apps/web/src/app/legacy-redirect.tsx`) is a client-side React Router redirect,
mounted at every legacy `/dashboard/*` root. That only ever runs if a browser hitting
one of those paths already loaded Sector's bundle — which only happens if Sector is
served from the same origin the dashboard's links/bookmarks/notification emails point
at. The plan's own rollback note ("DNS and routing: point users back at the
dashboard") says the same thing from the other side. So: same-origin, handoff
implemented, not re-auth.

- `apps/web/src/app/storage-migration.ts`: added `migrateLegacyDashboardSession`,
  called at the end of the existing `migratePersistedStorage()` (still one call site
  in `main.tsx`, unchanged). Reads the dashboard's bare `token` + `user` keys,
  validates the pair against the same `authSessionSchema` a login response is parsed
  with, writes `sector.session` on success, removes the dashboard's two keys. Never
  overwrites an existing `sector.session`. Leaves the pair untouched (not deleted) on
  any parse/schema failure.
- 5 new tests in `storage-migration.test.ts` (successful handoff through the real
  read path, does-not-overwrite-newer-session, orphan token with no user, unparsable
  user JSON, user object that fails the schema). All 20 tests in the file pass.
- `docs/session-handoff.md`: the decision, the evidence, and what it does *not* cover
  — no refresh token (the dashboard never stored one; `authSessionSchema.refreshToken`
  is optional for exactly this reason), no revalidation of an already-expired bearer
  (first 401 clears it the ordinary way), and what to do if the same-origin premise
  turns out wrong (tell users plainly, same requirement as the re-auth path).

## 4. Deploy pipeline — `.github/workflows/deploy.yml`

Matched `gusi_web_dashboard/.github/workflows/ci.yml`'s shape: lint+typecheck → test →
build → OIDC-authenticated S3 sync + CloudFront invalidation. Adapted for the
pnpm/Turborepo monorepo (root `pnpm run <task>` instead of the dashboard's single
package, artifact path `apps/web/dist`). Single environment (production) for now —
this repo currently has only `main`; noted in a comment how to extend to
staging/dev if those branches show up later, rather than building unused branch
conditionals now.

**Secrets — reused, not invented**, same names as the dashboard's workflow:
`PROD_AWS_ACCOUNT_ID`, `PROD_AWS_REGION`, `PROD_AWS_BUCKET_NAME`,
`PROD_AWS_CLOUDFRONT_DISTRIBUTION_ID`, `PROD_VITE_API_URL` (Sector's code reads
`VITE_API_BASE_URL`; mapped from the same secret since both apps point at the same
`gusi_nodejs_api`, not treated as a new secret).

**One thing I did NOT reuse, flagged rather than assumed:** the IAM role name.
Dashboard's workflow assumes `role/ScanhubS3GithubRole`. An OIDC trust policy is
normally scoped to a specific GitHub repo, so that role almost certainly does not
trust `scanvault`'s OIDC token. I used `role/SectorS3GithubRole` (parallel naming) as
a placeholder and this needs a real IAM role provisioned with a trust policy scoped to
this repo before the workflow can actually deploy — this is infra provisioning, not a
secret name, and I didn't want to silently point at a role scoped to a different repo.

Skipped the dashboard's Firebase-service-worker / `.well-known` verification steps and
its `NODE_OPTIONS=--max-old-space-size=4096` (cornerstone/DICOM-viewer workaround) —
neither applies to Sector's build (no Firebase, no cornerstone dependency).

**Validated, did not trigger:** YAML parses (`python3 -c "import yaml; ..."` — parsed
clean, 4 jobs, correct trigger), every `pnpm run <x>` script referenced exists in root
`package.json`, `apps/web/dist` is the real build output path (confirmed via an actual
local build). No workflow run, no push to a deploy-triggering branch.

## Gates

All from repo root, Node 22 (via nvm; default was 24, which the project's own `engines`
field rejects):

- `pnpm -w lint` — pass (ESLint + Prettier, all packages)
- `pnpm -w typecheck` — pass (4 packages)
- `pnpm -w test` — pass, 734 tests in `@sector/web` (includes the 10 new gate tests +
  20 storage-migration tests, 5 new), 200 in `@sector/api-client` (11 skipped, expected
  — live-API suites need a running server), 123 in `@sector/ui`
- `pnpm -w build` — pass, `apps/web/dist` produced
- i18n gate — pass, and proven to fail-then-pass by deleting/restoring a real key

## Files touched

- `apps/web/src/i18n/locale-completeness-baseline.json` (new)
- `apps/web/src/i18n/locale-completeness-gate.test.ts` (new)
- `apps/web/src/app/storage-migration.ts` (modified — added the dashboard handoff)
- `apps/web/src/app/storage-migration.test.ts` (modified — 5 new tests)
- `docs/session-handoff.md` (new)
- `docs/feature-flags-decision.md` (new)
- `.github/workflows/deploy.yml` (new)

4 commits on `feat/sector-phase-11b`, conventional format, no plan/phase identifiers.

## Unresolved questions

1. **IAM role for OIDC.** `SectorS3GithubRole` in `deploy.yml` is a placeholder name.
   Someone with AWS access needs to provision a role trusting `scanvault`'s GitHub
   OIDC and register the four `PROD_AWS_*` + `PROD_VITE_API_URL` secrets (and decide
   whether Sector gets its own bucket/distribution or eventually takes over the
   dashboard's — the phase notes defer that to the staged-rollout phase, which I left
   alone).
2. **Feature-flag decisions for courses/home/gallery** are explicitly left open in
   `feature-flags-decision.md` for whoever finishes those surfaces — flagging so it
   isn't mistaken for an oversight.
3. **`docs/system-architecture.md` in the parent `gusi-lms` folder** still says "22
   flags declared" — outside this repo's scope to fix, but worth a heads-up since it's
   the source of the number this task told me to re-verify.

Status: DONE
Summary: built i18n completeness gate (baseline=74, gate proven to fail/pass on a real key), feature-flag decision doc (Sector reads none; corrected declared count 24 vs quoted 22, verified served=18/match=13 live), same-origin session handoff (established from LegacyRedirect's own mechanics, not assumed) with tests, and the deploy.yml pipeline (dashboard's shape, reused secret names, flagged the one invented value). All gates green on top of feat/sector @ a4da385, no drift to merge.
Concerns/Blockers: IAM role for OIDC needs real provisioning before deploy.yml can actually run; see unresolved questions.
