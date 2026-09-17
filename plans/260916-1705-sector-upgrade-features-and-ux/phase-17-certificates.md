---
phase: 17
title: "Certificates"
status: pending
priority: P2
effort: "2d + external"
dependencies: [2]
---

# Phase 17: Certificates

## Overview

Show a certificate card on the merged course page for completed courses and
let the learner download it. The API already has the routes
(`/api/certificates/user-certificates`, `generate-certificate`,
`send-certificate`, `by-ref/:refModel`) and a maintenance switch
(`src/config/certificate-maintenance.ts` on the API and the same file in the
legacy web app, hard-coded on); 2,860 completers hold a certificate record
with no file. Sector today only shows an "unavailable" note driven by
`VITE_CERTIFICATES_UNAVAILABLE`.

## Gate

**The maintenance owner (CTP-399 / CTP-834) flips the switch and generation
is verified on staging.** Step 1 is a verification, not an assumption: call
`generate-certificate` for one completed enrolment on staging with a test
account and confirm a file is produced and downloadable. If generation is
broken, this phase becomes an API fix ticket first.

## Requirements

**Functional**

- Course page (phase 2), completed course: a certificate card with
  "Download certificate" (and "Email me a copy" if `send-certificate` works).
- If a record exists without a file, the card offers "Generate" once, then
  download; errors are shown plainly.
- Not completed → no card. Maintenance on → the existing unavailable note.
- My Courses list card: a small certificate glyph on completed rows linking to
  the course page.

**Non-functional**

- Feature-detect through the API's maintenance response, not a Vite env var:
  replace `VITE_CERTIFICATES_UNAVAILABLE` with a call to the user-certificates
  route; a 503/flag payload keeps the note, a 404 hides the card. Remove the
  env var from `netlify.toml`/docs when done.
- Schemas + fidelity decision (`proves: certificates` and
  `usercoursecertificates` on the mirror; check both collections exist there).
- Strings `courses.certificate.*` in seven locales.

## Architecture

```
API   GET  /api/certificates/user-certificates?courseId=   (exists; verify it filters by course)
      POST /api/certificates/generate-certificate            (exists; authUser + permission set —
                                                              verify a plain subscriber holds it)
      POST /api/certificates/send-certificate                (exists)
      certificate-maintenance.ts                              switch → 503 { maintenance: true }

api-client   endpoints/certificates.ts   listMyCertificates(courseId), generateCertificate(courseId),
                                          sendCertificate(id)   + schemas/certificate.ts + fidelity

web   features/courses/landing/certificate-card.tsx   NEW; mounted by course-landing-page.tsx
      features/courses/my-courses/course-card.tsx     glyph on completed
```

## Related Code Files

- API side — Read/verify: `src/app/certificate/certificate.route.ts`,
  `certificate.controller.ts`, `src/config/certificate-maintenance.ts`,
  `src/database/user-course-certificate/README.md`; Modify only if
  verification finds the permission set excludes subscribers or the
  maintenance response is not machine-readable.
- api-client — Create: `packages/api-client/src/endpoints/certificates.ts`,
  `packages/api-client/src/schemas/certificate.ts` (+ tests); Modify:
  `src/index.ts`, `src/fidelity/manifest.ts`.
- web — Create: `apps/web/src/features/courses/landing/certificate-card.tsx`
  (+ test); Modify: `course-landing-page.tsx` (replace the env-var note),
  `apps/web/src/features/courses/my-courses/course-card.tsx`,
  `apps/web/src/i18n/locales/*.json`; Remove the env var from `netlify.toml`
  and `README.md`.
- Legacy reference: `gusi_web_dashboard/src/api/certificate/certificate.api.ts`,
  `pages/dashboard/my-courses/content/_components/course-certificate.tsx`.

## Tests Before

- Web: landing page test pins the unavailable note when the env var is set
  (to be replaced by the maintenance-response test).
- api-client: none exist for certificates; the first tests are "after".

## Refactor

- Env-var gate → API-driven gate; note copy unchanged.

## Tests After

- api-client schema tests against mirror-shaped fixtures; fidelity replay.
- Card: completed + file → Download; record without file → Generate then
  Download; maintenance → note; 404 → nothing.
- My Courses glyph only on completed.

## Implementation Steps

1. Verify on staging with a test account (generate + download); record the
   result and the permission check in `reports/`.
2. api-client endpoints + schemas + fidelity decisions.
3. Certificate card; replace env gate; list glyph; locale keys.
4. Remove `VITE_CERTIFICATES_UNAVAILABLE` from config and docs.
5. Sweep at 390/1440/2200.

## Regression Gate

```
pnpm --filter @sector/api-client test && pnpm fidelity
pnpm --filter @sector/web test -- src/features/courses
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] Generation verified on staging (or an API ticket opened with evidence).
- [ ] Completed course shows the card; download yields a file.
- [ ] Maintenance state drives the note from the API, not a build-time var.
- [ ] Fidelity decisions for both certificate schemas.
- [ ] No horizontal scroll at 390px on the course page with the card.

## Risk Assessment

- **Flag never flips** → card stays hidden; the honest note remains; no dead
  button shipped.
- **2,860 record-without-file learners** hit Generate at once → the API
  already rate-limits per user; confirm during verification.

## Security & Privacy Considerations

- Certificates carry the learner's name; routes are `authUser` and scoped to
  the caller's records. Verify `generate-certificate` cannot be called for
  another user's enrolment.
