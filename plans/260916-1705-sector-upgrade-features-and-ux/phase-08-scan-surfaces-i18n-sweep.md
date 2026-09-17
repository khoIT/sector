---
phase: 8
title: Scan surfaces i18n sweep
status: completed
priority: P2
effort: 4d
dependencies:
  - 5
  - 7
---

# Phase 8: Scan surfaces i18n sweep

## Overview

Move every hard-coded English string in `create-scan`, `scan-detail` and
`account` through `t()` with keys in all seven locales, and add a test that
fails on any literal JSX text in those directories so the state cannot
regress. Today only 4 of 27, 4 of 22 and 4 of 10 components use
`useTranslation`; the shell offers seven languages, so a Spanish learner hits
English the moment they upload a scan. Runs after phases 5 and 7 so their
strings settle first.

## Requirements

**Functional**

- Zero literal user-visible text in the three directories: JSX text nodes,
  `title=`, `aria-label=`, `placeholder=`, `alt=` (non-empty), toast messages,
  dialog copy, validation messages built in the model files.
- Keys follow the existing namespaces: `createScan.*`, `scanDetail.*`,
  `account.*`; sub-namespace per component (`createScan.filesPanel.*`).
- Pluralisation via i18next `_one`/`_other`; interpolation for counts and
  names; no string concatenation of translated fragments.
- Translations for de, es, fil, fr, it, pt written in this phase, not
  baselined.

**Non-functional**

- Zero additions to `apps/web/src/i18n/locale-completeness-baseline.json`;
  ideally remove entries the sweep makes redundant.
- No behaviour change: this is a string relocation. Snapshot tests that
  assert English text are updated to assert keys or to run with the `en`
  bundle loaded, whichever the existing tests do (check
  `legacy-surfaces-locale-parity.test.ts` and the render tests' i18n setup).

## Architecture

```
apps/web/src/i18n/
  ├── locales/{en,de,es,fil,fr,it,pt}.json        + createScan.*, scanDetail.*, account.*
  ├── no-literal-jsx-text.test.ts   NEW  scans the three feature dirs for literal text
  └── locale-key-parity.test.ts     existing, keeps the seven bundles in step

Inventory command (run once, commit the CSV under this plan's reports/):
  npx tsx scripts/i18n/list-literal-text.ts apps/web/src/features/{create-scan,scan-detail,account}
```

The scanner walks `.tsx` with the TypeScript compiler API: reports
`JsxText` with non-whitespace content, and string literals in the attributes
listed above. Allow-list: `aria-hidden`, `className`, `data-*`, `href`,
`src`, `type`, `role`, and an inline `{/* i18n-exempt: reason */}` comment
for genuine non-translatables (units like "MB", product names).

## Related Code Files

- Create: `scripts/i18n/list-literal-text.ts` (also used by the test)
- Create: `apps/web/src/i18n/no-literal-jsx-text.test.ts`
- Modify: every `.tsx` under `apps/web/src/features/create-scan/` (23 files
  without `useTranslation`), `apps/web/src/features/scan-detail/` (18),
  `apps/web/src/features/account/` (6) — get the exact list from the
  inventory command, not from memory.
- Modify: model files that build user-facing messages
  (`create-scan/model/*` message builders such as the draft-expired and
  storage-degraded texts read by `create-scan-page.tsx`) — return keys +
  params, translate at the render site.
- Modify: `apps/web/src/i18n/locales/*.json` (seven)
- Modify: `apps/web/src/i18n/locale-completeness-baseline.json` (removals only)

## Tests Before

- Run the inventory; commit the count per directory as the baseline in the
  new test's first version (`expect(count).toBeLessThanOrEqual(N)`), so the
  sweep can land component by component while the number only goes down.
- Existing render tests for these features pass unchanged before any edit
  (run them once; they are the regression net for behaviour).

## Refactor

- Component by component, smallest first. Each commit: one component (or one
  panel group), its keys in seven locales, ratchet the literal-text budget
  down in the test.
- Message builders in `model/` return `{ key, params }`; render sites call
  `t(key, params)`.

## Tests After

- `no-literal-jsx-text.test.ts` budget reaches 0 for all three directories.
- `locale-key-parity.test.ts` and `locale-completeness-gate.test.ts` green
  with no new baseline rows.
- Existing render tests green; where they asserted English copy, they now
  assert through the loaded `en` bundle.

## Implementation Steps

1. Write the scanner script + test with the initial budget; commit.
2. Account (6 files): forms, delete dialog, notification preferences.
3. Scan detail (18): panels, dialogs, activity log, file list, media viewer.
4. Create-scan (23): setup bar, files panel, finding rows, review panel,
   commit bar, dialogs, submitted step, model message builders.
5. Translate all new keys into six locales; review medical terms with the
   glossary already used for the shell (`nav.*`, `groups.*`) for consistency.
6. Remove now-redundant baseline rows; ratchet budget to 0; sweep at 390 in
   `de` (longest strings) to catch overflow.

## Regression Gate

```
pnpm --filter @sector/web test -- src/i18n src/features/create-scan src/features/scan-detail src/features/account
pnpm -w typecheck && pnpm -w lint
SECTOR_SWEEP_LOCALE=de node scripts/check/cold-load-sweep.mjs "$SECTOR_MIRROR_JWT_SECRET" <fixture-dir>
```

## Success Criteria

- [ ] Literal-text budget is 0 for the three directories and enforced by test.
- [ ] Seven locale bundles have identical key sets; baseline has no new rows.
- [ ] Switching to `es` on create-scan shows no English (manual pass on the
      study flow, one dialog, the submitted step).
- [ ] No horizontal overflow at 390px in `de` on create-scan and scan detail.
- [ ] No behaviour change: existing render tests pass.

## Risk Assessment

- **Long German/French strings break the three-column create-scan layout**
  → sweep in `de` at 390 and 2200; wrap, do not truncate, labels.
- **Translation quality of clinical terms** → reuse terms already present in
  the bundles; flag new clinical terms in a short list for a clinician review
  (open question, does not block merge).
- **Test churn** from English-asserting render tests → migrate them to the
  `en` bundle in the same commit as the component.
