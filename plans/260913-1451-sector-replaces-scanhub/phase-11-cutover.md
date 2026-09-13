---
phase: 11
title: "Cutover"
status: pending
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
3. **Two auth defects that get worse when Sector is the only door.** *(~1d, API)*
   - **One refresh token per user, globally** — a second device invalidates the first.
   - **`GET /api/me` sits inside the 20-per-15-min-per-IP auth limiter** and Sector calls
     it on every cold boot, so a classroom behind one NAT can exhaust the sign-in budget
     in twenty page loads. Pull this forward to Phase 3 if a classroom pilot is scheduled
     before cutover.
4. **Feature flags.** GrowthBook is the runtime authority and nothing in the stack calls
   `setAttributes`, so any targeting rule added later would silently not apply. Code
   declares 22 flags, GrowthBook serves 18, 13 match. Either Sector reads GrowthBook
   properly — with attributes — or it reads none at all and the drop decisions become
   permanent. Decide explicitly; do not inherit the drift.
5. **i18n completeness gate** in CI: a key present in `en.json` and missing elsewhere
   fails the build, so the tail cannot rot after launch.
6. **Deploy pipeline**, then a staged rollout: internal, then one pilot group, then all.
7. **Decommission** the dashboard behind the redirect map, not before it.

## Tests / validation

- Every dashboard route resolves in Sector or is listed as retired with a reason.
- A dashboard bookmark and a dashboard-era session both behave as documented.
- Full pass by all four demo roles on the deployed build, in two locales.

## Success criteria

- [ ] No :3000 URL 404s after cutover
- [ ] Every retired surface is named in the decommission doc with the evidence
- [ ] A second device does not sign the first one out
- [ ] A classroom on one IP can all sign in
- [ ] Every locale is complete, enforced in CI
- [ ] Sector deploys from a branch push, like the repo it replaces

## Risk / rollback

Rollback is DNS and routing: point users back at the dashboard while it still exists,
which is why decommission is the last step and not the first. The real risk is
discovering at step 1 that a surface nobody listed is load-bearing for some group —
which is an argument for writing the route map early, in parallel with Phase 4, rather
than here.
