---
phase: 13
title: "AI review panel"
status: pending
priority: P2
effort: "2d"
dependencies: [9]
---

# Phase 13: AI review panel

## Overview

Render the structured AI review facts that already exist on production
reviews. `scanReviewSchema.reviewFacts` (`packages/api-client/src/schemas/scan.ts`
~line 229) is parsed as opaque `unknown`; the mirror holds an object there on
704 of 15,576 reviews, keyed by section ("Background Section", "Overall
Feedback", …). Nothing in Sector reads it. The generator itself is not a user
action: `POST /scan-review-generator/:scanId/review` and its GET are
API-key routes for an external AI service (`scan-review-generator.md` in the
API), so this phase is read-only rendering plus a documented gap for the
legacy "generate" button.

## Requirements

**Functional**

- On a reviewed scan, an "AI-assisted summary" section shows each fact
  section as a titled block, in the order the object provides, beneath the
  human review and clearly labelled as AI-assisted.
- Visible to whoever can see the review (owner, group leader, reviewer);
  absent when `reviewFacts` is null or not an object.
- The reviewed lists show a small "AI-assisted" marker on rows whose review
  carries facts (the schema comment says this was the intent).
- No "Generate review" button. Document why in the phase report and in
  `docs/feature-flags-decision.md` (`scan-review-generator` row): the
  generator is an API-key service integration, not a learner or reviewer
  capability; reinstating it is a product decision needing an owner.

**Non-functional**

- Step 1 is measurement, read-only on the mirror: shape of `reviewFacts`
  (section names, value types, max length), and how many are strings vs
  nested. Decide the schema from data, not from the legacy component.
- Tighten the Zod type from `unknown` to
  `z.record(z.string(), z.union([z.string(), z.array(z.string())])).nullish()`
  only if the measurement supports it; otherwise keep a permissive shape with
  a renderer that ignores what it cannot show. Fidelity decision: `proves`
  against `scanreviews` in the manifest.
- Sanitise as text; facts are not HTML. Strings via `t()`
  (`scanDetail.aiSummary.*`), seven locales.

## Architecture

```
mirror (read-only)  scanreviews.reviewFacts  ──measure──►  shape decision
                                                                │
api-client  schemas/scan.ts  reviewFacts: tightened schema + fidelity `proves: scanreviews`
                                                                │
web  scan-detail/components/scan-review-summary.tsx
       └── <AiReviewFacts facts={review.reviewFacts}/>   NEW component, ordered sections
     scan-list/rows/list-cells.tsx  + "AI-assisted" badge when facts present
```

## Related Code Files

- Measure (read-only): `mongosh gusi_prod_mirror` aggregate over
  `scanreviews` with `reviewFacts` `$type: 'object'`; record the result under
  this plan's `reports/`.
- api-client — Modify: `packages/api-client/src/schemas/scan.ts`,
  `packages/api-client/src/fidelity/manifest.ts`; tests in
  `packages/api-client/src/schemas/scan.test.ts`.
- web — Create: `apps/web/src/features/scan-detail/components/ai-review-facts.tsx`
  (+ test); Modify: `scan-review-summary.tsx`,
  `apps/web/src/features/scan-list/rows/list-cells.tsx` (badge),
  `apps/web/src/i18n/locales/*.json`.
- docs — Modify: `docs/feature-flags-decision.md` (`scan-review-generator` row).
- Legacy reference: `gusi_web_dashboard/src/pages/dashboard/scans/*/[id]/components/`
  (how the dashboard rendered facts; copy the section order if it hard-coded one).

## Tests Before

- `scan.test.ts` already proves the schema against fixtures; add a fixture
  with a real-shaped `reviewFacts` object and one with a string, asserting
  both parse today (opaque). This pins the permissive behaviour the tightening
  must not lose for existing rows.
- `scan-review-summary` render test pins the current review layout.

## Refactor

- Schema tightened per measurement; `fidelity` replay confirms 100% of mirror
  reviews still parse.
- Summary component composes the new facts block; no layout change to the
  human review.

## Tests After

- `ai-review-facts.test.tsx`: renders sections in object order, skips
  non-string values, renders nothing for null/empty, labels the block
  AI-assisted.
- List badge appears only when facts present.
- Fidelity replay: `pnpm fidelity` green with the tightened schema.

## Implementation Steps

1. Measure on the mirror; write the shape note to `reports/`.
2. Tighten schema (or keep permissive) + fixtures + fidelity decision.
3. `ai-review-facts.tsx`; mount in the summary; list badge.
4. Locale keys; flag-doc row; sweep.

## Regression Gate

```
pnpm --filter @sector/api-client test
pnpm fidelity                       # collection replay must stay 100%
pnpm --filter @sector/web test -- src/features/scan-detail src/features/scan-list
pnpm -w typecheck && pnpm -w lint
node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] Every mirror review still parses after the schema change (fidelity 100%).
- [ ] A review with facts shows the AI-assisted block; one without shows nothing.
- [ ] Reviewed lists mark AI-assisted rows.
- [ ] The generator gap is documented with its reason and an owner question.
- [ ] No horizontal scroll at 390px on scan detail with a long facts block.

## Risk Assessment

- **Shape drift**: an external service writes these facts; a new key shape
  must not blank the page → renderer ignores unknown value types, schema stays
  tolerant, fidelity replay guards.
- **Mislabelled provenance** → the block is always labelled AI-assisted and
  placed after the human review.

## Security Considerations

- Render facts as text only; no HTML. Visibility follows the review's
  existing access rules; no new route.
