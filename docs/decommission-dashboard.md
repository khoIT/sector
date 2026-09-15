# Decommissioning the dashboard

What `gusi_web_dashboard` stops serving, in what order, and where every URL it served goes
instead. Everything below the marker is generated from the router's own route map; this half is
written by hand.

## Cutover decisions this depends on

| Decision | Answer | Recorded in |
| --- | --- | --- |
| Does Sector read a runtime flag service? | **No** — permanently and explicitly, rather than by drift | [`feature-flags-decision.md`](./feature-flags-decision.md) |
| Do signed-in users keep their session? | **Yes** — same-origin handoff, no re-authentication | [`session-handoff.md`](./session-handoff.md) |

The same-origin decision is what makes the forwarding table below work at all. `LegacyRedirect` is
a client-side React Router component, so a `/dashboard/*` bookmark only reaches it if the browser
already loaded Sector's bundle — which only happens if Sector serves the origin those bookmarks,
links and notification emails point at. Standing Sector up on a second hostname would silently turn
every row in that table into a 404 and sign every user out at the same moment.

## Order of switch-off

Decommission runs *after* the redirect map is live, never before it. A retired surface that 404s
instead of explaining itself is the failure this document exists to prevent.

1. **Deploy Sector to the dashboard's origin**, redirect map mounted. Nothing is switched off yet:
   both apps' URLs resolve and the handoff adopts live sessions.
2. **Internal rollout** — GUSI staff only. Walk all four roles in two locales on the deployed
   build.
3. **One pilot group** — a real cohort with real assignments. This is the step that surfaces the
   two things a staging pass cannot: a classroom signing in from behind one NAT, and one person on
   a second device.
4. **All users.**
5. **Stop minting dashboard URLs.** Confirm no live email template still emits a `:3000` path.
6. **Switch the dashboard off**, leaving the redirect map serving its URLs.
7. **Retire the dashboard's infrastructure** last, once a full assignment cycle has passed with no
   forwarded URL reported broken.

Steps 1–4 are reversible at the DNS layer. Step 6 is the first irreversible one.

## Rollback

Point the origin back at the dashboard. That is why step 6 is late and step 7 is last: while the
dashboard still exists, cutover is a routing change rather than a migration.

What rollback does **not** recover is a session. `migrateLegacyDashboardSession` removes the
dashboard's `token` and `user` keys once it has adopted them, so a user who signed into Sector and
is then sent back signs in once more. That is a deliberate trade — leaving the keys in place would
mean two stores drifting apart — and it is a one-time cost per user, not a data loss.

## Still open before this can run

- **The OIDC IAM role.** `.github/workflows/deploy.yml` names `SectorS3GithubRole`, a placeholder.
  A GitHub OIDC trust policy is scoped to a single repository, so the dashboard's
  `ScanhubS3GithubRole` does not trust this one. Someone with AWS access must provision the role
  and register `PROD_AWS_ACCOUNT_ID`, `PROD_AWS_REGION`, `PROD_AWS_BUCKET_NAME`,
  `PROD_AWS_CLOUDFRONT_DISTRIBUTION_ID` and `PROD_VITE_API_URL`. Until then the pipeline is
  validated but has never run.
- **Whether Sector takes over the dashboard's bucket and CloudFront distribution or gets its own.**
  The same-origin decision constrains this: whatever serves the origin at step 1 is what the
  distribution must point at.
- **Flag decisions for `features/{courses,home,gallery}`**, left open in
  `feature-flags-decision.md` for whoever finishes those surfaces.

<!-- BEGIN generated from apps/web/src/app/legacy-route-map.ts — run `pnpm docs:legacy-routes`; do not edit below this line -->

Every URL `gusi_web_dashboard` served, and what Sector does with it. The router mounts the
same table, so a legacy bookmark, an emailed scan link or a saved tab lands where the rows
below say.

## Kept at the same path

`/login`, `/forgot-password`, `/forgot-password/verify`, `/forgot-password/reset` and
`/group-invitation-confirmation` are served by Sector at the paths the dashboard used, because
the API's own emails link to them.

## Forwarded (38)

| Dashboard | Was | Sector | Note |
| --- | --- | --- | --- |
| `/dashboard` | the dashboard home | `/` | The home screen replaces it; until that lands, / forwards to the first permitted list. |
| `/dashboard/account` | account tabs: profile, security, billing, payment methods, settings | `/profile` | Profile carries name, photo, password, notification preferences and account deletion; the billing tabs are commerce. |
| `/dashboard/settings` | settings: language, theme, devices, notification channels, group notifications | `/profile` | Language and theme are in the shell; per-group scan notifications are on the profile; push devices had 4 documents against 3,152 users. |
| `/dashboard/not-authorized` | the 403 page | `/` | Sector renders its 403 in place, naming the missing permission. |
| `/dashboard/scans` | the scans layout | `/scans/my` |  |
| `/dashboard/scans/my-scans` | My Scans | `/scans/my` |  |
| `/dashboard/scans/my-scans/create` | the create-scan wizard | `/scans/create` |  |
| `/dashboard/scans/my-scans/:scanId` | my scan detail — the path the API writes into every scan notification | `/scans/my/:scanId` | These links are in inboxes and histories; they outlive the app that minted them. |
| `/dashboard/scans/my-scans/:scanId/upload-file` | the add-files page for an existing scan | `/scans/my/:scanId` | Adding files happens on the scan itself. |
| `/dashboard/scans/shared-scans` | Shared Scans | `/scans/shared` |  |
| `/dashboard/scans/shared-scans/:scanId` | a shared scan | `/scans/shared/:scanId` |  |
| `/dashboard/scans/pending-scans` | the group review queue | `/scans/group/unreviewed` |  |
| `/dashboard/scans/pending-scans/:scanId` | a queued group scan | `/scans/group/unreviewed/:scanId` |  |
| `/dashboard/scans/reviewed-scans` | reviewed group scans | `/scans/group/reviewed` |  |
| `/dashboard/scans/reviewed-scans/:scanId` | a reviewed group scan | `/scans/group/reviewed/:scanId` |  |
| `/dashboard/scans/expert-scans` | the expert review queue | `/scans/expert/unreviewed` |  |
| `/dashboard/scans/expert-scans/:scanId` | a queued expert scan | `/scans/expert/unreviewed/:scanId` |  |
| `/dashboard/scans/expert-reviewed-scans` | reviewed expert scans | `/scans/expert/reviewed` |  |
| `/dashboard/scans/expert-reviewed-scans/:scanId` | a reviewed expert scan | `/scans/expert/reviewed/:scanId` |  |
| `/dashboard/scans/scan-vault` | the "Scan Vault" file-library tab | `/scans/my` | Unreachable in the dashboard too: no menu entry pointed at it. |
| `/dashboard/dicom-upload` | DICOM upload as a separate page (no menu entry) | `/scans/create` | DICOM files are accepted by the create-scan flow; a second upload page is not rebuilt. |
| `/dashboard/my-courses` | My Courses | `/learn/courses` |  |
| `/dashboard/my-courses/:courseId/list` | a course outline | `/learn/courses/:courseId` |  |
| `/dashboard/my-courses/:courseId` | a course | `/learn/courses/:courseId` |  |
| `/dashboard/my-courses/:courseId/lessons/:lessonId` | a lesson | `/learn/courses/:courseId/:lessonId` | One route serves every item; the server-resolved outline knows where the lesson sits. |
| `/dashboard/my-courses/:courseId/lessons/:lessonId/topics/:topicId` | a topic | `/learn/courses/:courseId/:topicId` |  |
| `/dashboard/my-courses/:courseId/lessons/:lessonId/topics/:topicId/quizzes/:quizId` | a quiz inside a topic | `/learn/courses/:courseId/:quizId` |  |
| `/dashboard/my-courses/:courseId/lessons/:lessonId/quizzes/:quizId` | a quiz inside a lesson | `/learn/courses/:courseId/:quizId` |  |
| `/dashboard/my-courses/:courseId/quizzes/:quizId` | a quiz at the course root | `/learn/courses/:courseId/:quizId` | The fourth nesting shape, course > topic > quiz, had no route at all in the dashboard; here it is the same route as every other item. |
| `/dashboard/question-banks` | Question Banks | `/learn/question-banks` |  |
| `/dashboard/question-banks/:slug` | a question bank | `/learn/question-banks/:slug` |  |
| `/dashboard/pathology-gallery` | the pathology gallery | `/learn/gallery` |  |
| `/dashboard/sage-ai` | the Sage AI tutor frame | `/learn/sage` |  |
| `/dashboard/manage-group` | Groups (manage group) | `/administer/groups` |  |
| `/dashboard/manage-group/:groupId/learners` | a group’s learners | `/administer/groups/:groupId/members` | One members surface for every role; the columns follow the role. |
| `/dashboard/manage-group/:groupId/assignments` | a group’s assignments | `/administer/groups/:groupId/assignments` |  |
| `/dashboard/manage-group-v1` | the previous groups screen | `/administer/groups` | A dead route: no menu entry pointed at it. |
| `/dashboard/manage-group-v2` | the other previous groups screen | `/administer/groups` | A dead route: no menu entry pointed at it. |

## Retired (19)

A bookmark to any of these lands on a page that names the reason and links to the nearest
surface that works. The evidence for each decision is the note.

| Dashboard | Was | Reason | Sends to | Evidence |
| --- | --- | --- | --- | --- |
| `/dashboard/certificates` | course certificates | Certificates | `/learn/courses` | CERTIFICATE_DOWNLOAD_MAINTENANCE is a hard-coded true; every row action returns null today. |
| `/certificates/:id` | the certificate link in old completion emails | Certificates | `/learn/courses` | Never existed as a page; the dashboard already redirected it. |
| `/dashboard/orders` | orders | Commerce | `/scans/create` | Every commerce flag is off, the storefront routes are commented out and the checkout submit handler is commented out; 0 orders, 0 subscriptions, 0 payment methods locally. Money flows through scan-review credits, which are bought from the create-scan flow. |
| `/dashboard/payment-methods` | payment methods | Commerce | `/scans/create` | Every commerce flag is off, the storefront routes are commented out and the checkout submit handler is commented out; 0 orders, 0 subscriptions, 0 payment methods locally. Money flows through scan-review credits, which are bought from the create-scan flow. |
| `/dashboard/checkout` | checkout | Commerce | `/scans/create` | The live checkout took a card number and did nothing: no order, no error, no navigation. |
| `/dashboard/thank-you` | the post-checkout page | Commerce | `/scans/create` | Every commerce flag is off, the storefront routes are commented out and the checkout submit handler is commented out; 0 orders, 0 subscriptions, 0 payment methods locally. Money flows through scan-review credits, which are bought from the create-scan flow. |
| `/store-listing/checkout` | the storefront checkout | Commerce | `/scans/create` | Every commerce flag is off, the storefront routes are commented out and the checkout submit handler is commented out; 0 orders, 0 subscriptions, 0 payment methods locally. Money flows through scan-review credits, which are bought from the create-scan flow. |
| `/store-listing/thank-you` | the storefront thank-you page | Commerce | `/scans/create` | Every commerce flag is off, the storefront routes are commented out and the checkout submit handler is commented out; 0 orders, 0 subscriptions, 0 payment methods locally. Money flows through scan-review credits, which are bought from the create-scan flow. |
| `/dashboard/referrals` | referrals | Referrals | `/` | 0 referral documents against 3,152 users, and the route let any signed-in user read another user’s referral list with email addresses. |
| `/dashboard/fellowship` | fellowship (v1) | Fellowship v1 | `/learn/courses` | Frozen since 2 Jul 2025; superseded by 57 v2 endpoints no React calls; /api/schedule-slots, which this UI calls, is not mounted, so scheduling 404s. |
| `/dashboard/fellowship/mentee` | the mentee view of fellowship (v1) | Fellowship v1 | `/learn/courses` | See /dashboard/fellowship. |
| `/dashboard/knowledge-challenge` | Rapid Review: knowledge challenge | Rapid Review | `/learn/question-banks` | A sandboxed iframe onto a third-party Reflex app, flag off, identity asserted by an unsigned query string. Not GUSI code. |
| `/dashboard/interpretation-challenge` | Rapid Review: interpretation challenge | Rapid Review | `/learn/question-banks` | See /dashboard/knowledge-challenge. |
| `/dashboard/resources` | resources | Resources | `/learn/courses` | A three-line ComingSoon stub with no menu entry and no inbound link. |
| `/dashboard/notifications` | the in-app notification centre | In-app notifications | `/` | Four notification documents against 3,152 users; every notification that matters is an email the API already sends. |
| `/dashboard/notifications/:id` | one in-app notification | In-app notifications | `/` | See /dashboard/notifications. |
| `/register` | self-service registration | Self-service registration | `/login` | Accounts are minted by the WooCommerce webhook and by group invitations; the register flow ends in the same OTP mail the recovery flow uses. |
| `/register/verify` | registration OTP | Self-service registration | `/login` | The second step of the registration flow retired with /register. |
| `/switch-user` | administrator impersonation by token | Switch user | `/login` | Console-driven: the token is minted by POST /api/switch-user/generate-token from the internal console, which has not been ported. |
