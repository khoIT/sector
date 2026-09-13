# Feature flags at cutover

## Decision: Sector reads no runtime flag service

Sector has no GrowthBook client, no `@growthbook/*` dependency and calls no flag API —
today, by omission, not by a change made here. This document makes that permanent and
explicit rather than leaving it as drift, and records the decision the port made for
every flag the dashboard declared.

### Why, not just "because it's already true"

GrowthBook is the runtime authority: a flag not read from it cannot be turned on
without a redeploy, and the payload backing it (`cdn.growthbook.io`) can change without
Sector's code changing at all. Reading it partially — wiring the client but never
calling `setAttributes` — is worse than not reading it: a targeting or percentage
rollout rule added later in the GrowthBook console would silently not apply, and
nobody would notice until asking why a rule that works in the dashboard does nothing in
Sector. The dashboard is already in exactly that state (see "Numbers, measured" below).
Reading none at all is the only version of this that is honest about what Sector
actually does.

### Numbers, measured — not the ones quoted going in

The task handoff quoted "code declares 22 flags, GrowthBook serves 18, 13 match,"
sourced from `docs/system-architecture.md` in the parent folder. Measuring directly:

- **Declared: 24, not 22.** `gusi_web_dashboard/src/config/features.ts`'s
  `FEATURE_FLAGS` object has 24 entries, each a unique string value (counted by
  parsing the object literal, not by re-reading the prose describing it).
- **Served: 18.** Confirmed live: fetched `cdn.growthbook.io/api/features/<client key>`
  using the real `VITE_GROWTHBOOK_CLIENT_KEY` from `gusi_web_dashboard/.env` (not
  committed; a client-side SDK key, meant to be public in a shipped bundle, so reading
  it for this check is not a credential exposure) on 2026-09-14. This one was already
  right.
- **Match: 13.** Computed as the intersection of the two sets above. Also already
  right, and robust to the declared-count correction: matching is set intersection,
  not a function of the total declared.

So the flag-drift picture is slightly worse than quoted (24 declared vs. 22), but the
GrowthBook-side numbers hold up. Treat this the same way the i18n baseline in
`apps/web/src/i18n/locale-completeness-baseline.json` was corrected: measured, and
named, rather than carried forward from an earlier report.

### The 5 GrowthBook flags nothing in the dashboard reads

`api_scan_create-scan_save-to-group_all`, `scan-vault-legacy-archive-notice`,
`scan-vault-new-alert-message`, `scan-vault-old-alert-message`,
`scan-vault-old-scan-vault` are served but read by nothing in `gusi_web_dashboard`.
Sector reads none of them either. If a consumer in another repo (the console?) depends
on these, that is unaffected by this decision — Sector was never that consumer.

## The port's decision, per flag

Sector has no flag client, so every one of these is a **fixed, permanent outcome**
baked into what was actually built — not a flag anyone can flip. "On" means the
behaviour the flag used to gate is simply how Sector works; "Off" means it is not
built, backed by a file-level check, not a guess.

Scoped to what exists in Sector today (`features/{scan-list,scan-detail,create-scan,
account,groups}`). Flags whose surface belongs to `features/{courses,home,gallery}` —
owned by parallel, in-flight work — are left for whoever finishes that surface to
decide against this same table, not decided here.

| Flag (GrowthBook key)                                                                                                              | Dashboard purpose                                             | Sector outcome                               | Evidence                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scans_new_ui_v2`                                                                                                                  | the reviewer queue UI rewrite                                 | **On, permanently** — it is the only UI      | Sector has one scan-list implementation, not two                                                                                                                                                                             |
| `scan-vault-create-scan-v2`                                                                                                        | the 4-step create-scan wizard                                 | **On, permanently** — it is the only wizard  | `features/create-scan/create-scan-page.tsx`                                                                                                                                                                                  |
| `scans_study_create_scan_v2`                                                                                                       | persisting a draft across reload                              | **On, permanently**                          | `features/create-scan/model/draft-storage.ts`, `use-create-scan-draft.ts`                                                                                                                                                    |
| `scans_create-scan-with-group-selection_all`                                                                                       | attributing a study to one of the learner's groups            | **On, permanently**                          | `features/create-scan/components/group-routing-panel.tsx`                                                                                                                                                                    |
| `scan-vault-upload-concurrency`                                                                                                    | parallel (vs. one-at-a-time) uploads                          | **On, permanently**                          | `use-create-scan-draft.ts`'s concurrency-limited queue                                                                                                                                                                       |
| `scan-vault-upload-retry-all`                                                                                                      | one control that retries every failed file                    | **On, permanently**                          | `components/files-panel.tsx`'s "retry all" action                                                                                                                                                                            |
| `export-group-scans`                                                                                                               | exporting a group's scan list                                 | **On, permanently**                          | `features/groups/exports/`                                                                                                                                                                                                   |
| `login-feature-design`                                                                                                             | a login page redesign                                         | **On, permanently** — one design, no toggle  | `auth/login-page.tsx`                                                                                                                                                                                                        |
| `profile_extended_information`                                                                                                     | extended profile fields                                       | **On, permanently**                          | `features/account/profile-identity-form.tsx`, `profile-photo.tsx`                                                                                                                                                            |
| `settings_email_notifications`                                                                                                     | per-channel email notification toggles                        | **On, permanently**                          | `features/account/notification-preferences.tsx`                                                                                                                                                                              |
| `settings_push_notifications`                                                                                                      | push notification toggles                                     | **On, permanently**                          | same file — the dashboard split these; Sector's account surface does not                                                                                                                                                     |
| `scans_org-with-forms_all`                                                                                                         | organization-defined dynamic forms in the interpretation step | **Off — dropped**                            | README "Known gaps": forms are parsed, never rendered                                                                                                                                                                        |
| `scan-review-generator`                                                                                                            | AI-generated review draft                                     | **Off — dropped**                            | README "Known gaps": "the AI review panel [is] not ported"                                                                                                                                                                   |
| `scan-vault-scan-details-page-add-file`                                                                                            | adding files to an existing scan after submit                 | **Off — dropped**                            | no add-file entry point anywhere under `features/scan-detail`; `docs/decommission-dashboard.md` retires the dashboard's upload-file page with "adding files happens on the scan itself," which Sector does not yet do either |
| `orders_and_subscriptions`, `order-list-feature`, `subscription-list-feature`, `billing-address-feature`, `payment-method-feature` | commerce (orders, subscriptions, billing, payment methods)    | **Off — out of scope for the whole rewrite** | no Stripe dependency anywhere in `apps/web` or `packages/*`; `docs/decommission-dashboard.md` marks the commerce dashboard tabs `retired: commerce`                                                                          |
| `rapid-review_knowledge-challenge_all`, `rapid-review_interpretation-challenge_all`                                                | the Rapid Review knowledge/interpretation challenges          | **Off — out of scope**                       | `docs/decommission-dashboard.md` marks these `retired: rapid-review`; no rapid-review surface anywhere in `apps/web/src/features`                                                                                            |
| `course_new-ui-v2_all`, `course_new-ui-v3_all`, `my-course-temporary-view-mode`                                                    | course UI variants                                            | **Not decided here**                         | `features/courses` is being built in a parallel, in-flight phase; resolve against this table when that surface ships                                                                                                         |

## What reading GrowthBook properly would actually cost

Written so the next person choosing between "keep reading nothing" and "wire it up
properly" has real numbers instead of inheriting today's drift.

1. **Attribute plumbing.** `setAttributes` needs, at minimum, user id and role —
   Sector's `AuthUser` (`packages/api-client/src/schemas/auth.ts`) already carries both,
   so the data exists; the work is calling `growthbook.setAttributes(...)` once on
   sign-in and again on sign-out (clearing them), and re-checking after any role change
   the same way `gusi_web_dashboard`'s admin-reassignment case does. A day, not a
   sprint — the auth context is already the one place sessions change.
2. **A client and a provider.** `@growthbook/growthbook-react`, a singleton
   (`config/growthbook.ts`'s pattern is fine to copy), `init({streaming: true})` before
   first render, and a `VITE_GROWTHBOOK_CLIENT_KEY` secret per environment — mechanical,
   half a day.
3. **Someone has to own the flag definitions.** Right now nobody reconciles GrowthBook
   against the code that reads it: that is exactly how the dashboard ended up with 5
   orphaned served flags and 11 declared-but-unmatched ones. Wiring Sector up without
   assigning an owner (product? whoever owns the GrowthBook project — Doug Williams'
   remit reads architectural, this reads operational) reproduces the same drift in a
   new codebase within a release or two.
4. **What would have to be true for targeting to work.** A real rule — "10% of
   `group_leader`s," "org X only" — needs `setAttributes` shipped first (todo #1),
   the flag's targeting condition actually configured in the GrowthBook console against
   an attribute Sector actually sends, and a way to verify it applied (the dashboard has
   none today: `enableDevMode` is the only visibility into what a session evaluated to).
   Without that verification step, a misconfigured rule fails silently, which is the
   same failure mode this whole decision exists to avoid.

None of this is hard; it is unbudgeted, and skipping it without deciding to is what
produced the dashboard's numbers above.
