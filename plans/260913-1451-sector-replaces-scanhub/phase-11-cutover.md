---
phase: 11
title: "Cutover"
status: in-progress
priority: P1
effort: "8 days"
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
---

# Phase 11: Cutover

## Overview

Make Sector the thing users land on, and retire `gusi_web_dashboard`. Nothing here is
new product — it is the work that decides whether the previous ten phases reach anyone.

## Related code files

- Create: `apps/web/src/app/legacy-route-map.ts` — every :3000 path → its Sector path
- Create: `.github/workflows/deploy.yml` — S3 sync + CloudFront invalidation, the same
  shape `gusi_web_dashboard` already uses
- Create: `docs/decommission-dashboard.md` — what is switched off, in what order
- Modify: `apps/web/src/app/router.tsx` — mount the redirect map
- Modify (API, small): the two auth items below

## Implementation steps

1. **Route map.** Walk every route in the dashboard and give it a destination or a
   reason. A learner's bookmark must not 404. This is also the honest inventory of what
   was dropped — it belongs in the decommission doc, not in someone's memory.
2. **Sessions.** The dashboard stores `token` + `user` in `localStorage`; Sector uses
   its own key. Decide handoff (same origin) or re-authentication (different origin),
   and if it is re-auth, say so in the launch note rather than letting users discover it.

   **Decided: same-origin handoff, no re-authentication.** Established from
   `LegacyRedirect`'s own mechanics rather than assumed — it is client-side React Router,
   so step 1's redirect map only works at all if Sector serves the dashboard's origin.
   Built in `storage-migration.ts` (`migrateLegacyDashboardSession`), 5 tests, and
   written up with its limits in `docs/session-handoff.md`.
3. **Two auth defects that get worse when Sector is the only door.** *(~1d, API)*
   - **One refresh token per user, globally** — a second device invalidates the first.
   - **`GET /api/me` sits inside the 20-per-15-min-per-IP auth limiter** and Sector calls
     it on every cold boot, so a classroom behind one NAT can exhaust the sign-in budget
     in twenty page loads. Pull this forward to Phase 3 if a classroom pilot is scheduled
     before cutover.
4. **Feature flags.** GrowthBook is the runtime authority and nothing in the stack calls
   `setAttributes`, so any targeting rule added later would silently not apply. Code
   declares **24** flags (recounted from `FEATURE_FLAGS` — the 22 quoted here originally
   was wrong), GrowthBook serves 18, 13 match. Either Sector reads GrowthBook
   properly — with attributes — or it reads none at all and the drop decisions become
   permanent. Decide explicitly; do not inherit the drift.

   **Decided: Sector reads no runtime flag service**, permanently and explicitly.
   Recorded with per-flag reasoning, the measured counts and the cost of the alternative
   in `docs/feature-flags-decision.md`. Flags belonging to `features/{courses,home,gallery}`
   are deliberately left open there for whoever finishes those surfaces.
5. **i18n completeness gate** in CI: a key present in `en.json` and missing elsewhere
   fails the build, so the tail cannot rot after launch.
6. **Deploy pipeline**, then a staged rollout: internal, then one pilot group, then all.
7. **Decommission** the dashboard behind the redirect map, not before it.

## Tests / validation

- Every dashboard route resolves in Sector or is listed as retired with a reason.
- A dashboard bookmark and a dashboard-era session both behave as documented.
- Full pass by all four demo roles on the deployed build, in two locales.

## Success criteria

- [x] No :3000 URL 404s after cutover — `legacy-route-map.ts` covers all 57 dashboard
      routes (38 forwarded, 19 retired), mounted at `router.tsx:94-96` for both
      `${root}/*` and bare `${root}`, 68 tests. The engineering is done; the criterion
      itself can only be *observed* after step 6.
- [x] Every retired surface is named in the decommission doc with the evidence — all 19
      carry an evidence note, and the table is **generated** from the route map, so the
      doc cannot claim a destination the router does not have.
- [x] A second device does not sign the first one out — the single `users.refreshToken`
      field is replaced by a `refresh-token` collection (unique `tokenHash`,
      `{user, createdAt}` index, TTL on `expiresAt`), with a documented legacy fallback.
- [x] A classroom on one IP can all sign in — `meRateLimit` (300 / 15 min / IP) is wired
      to `GET /me` at `auth.route.ts:12`, off the 20-per-15-min auth budget.
- [x] Every locale is complete, enforced in CI — `locale-completeness-gate.test.ts` plus
      a baseline of the 74 pre-existing gaps, and `deploy.yml` runs `pnpm run test`
      before it will build. A now-translated baseline entry also fails, so exemptions
      cannot go stale.
- [ ] Sector deploys from a branch push, like the repo it replaces — **the pipeline is
      built and validated but has never run.** `deploy.yml` does lint/typecheck → test →
      build → OIDC → `s3 sync --delete` → CloudFront invalidation. Blocked on infra, not
      code: `SectorS3GithubRole` is a placeholder name, and a GitHub OIDC trust policy is
      scoped to one repository, so the dashboard's role does not trust this one. Needs
      that role provisioned and five `PROD_*` secrets registered.

## State — 2026-09-14

Five of six criteria met. The phase stays `in-progress` on two things, **neither of
which is code**:

1. **AWS provisioning** — the OIDC role and secrets above. Until then the deploy
   pipeline cannot be exercised.
2. **The rollout and decommission acts themselves** — steps 6 and 7 are an ordered
   sequence of operational decisions, now written down in
   `docs/decommission-dashboard.md` ("Order of switch-off"), which previously existed
   nowhere. Also open there: whether Sector takes over the dashboard's bucket and
   CloudFront distribution or gets its own, which the same-origin decision constrains.

## Risk / rollback

Rollback is DNS and routing: point users back at the dashboard while it still exists,
which is why decommission is the last step and not the first. The real risk is
discovering at step 1 that a surface nobody listed is load-bearing for some group —
which is an argument for writing the route map early, in parallel with Phase 4, rather
than here.
