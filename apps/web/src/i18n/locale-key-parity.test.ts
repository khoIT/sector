import { describe, expect, it } from 'vitest';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
import italian from './locales/it.json';
import pt from './locales/pt.json';

/**
 * Every NEW string added for reset-upload, completeness tags, requesting an
 * expert review on an existing scan, and the upload-robustness notices has a
 * real (non-English) translation in all seven locales.
 *
 * This is deliberately scoped to the keys THIS work introduced rather than
 * asserting full parity across the whole resource: 68 pre-existing keys
 * (account, nav, toolbar, row, …) were already missing from every non-English
 * locale before this change, which is its own, separate piece of work — see
 * the create-scan/scan-detail i18n extraction the parity audit calls out.
 * Asserting full parity here would fail on that pre-existing gap regardless
 * of anything in this change, and misattribute it.
 */
const NEW_ACTION_KEYS = [
  'resetUpload',
  'requestExpertReview',
  'markComplete',
  'markIncomplete',
] as const;

const NEW_CREATE_SCAN_KEYS = [
  'storageDegradedTitle',
  'storageDegradedBody',
  'validationFileTooLarge',
  'validationStudyTooLarge',
  'resumingResetTitle',
  'resumingResetBody',
  'submitIncompleteSubtitle',
  'submitIncompleteStatus',
  'submitIncompleteTitle',
  'submitIncompleteBody',
  'tryAgain',
  'creditsUsedOfTotal',
] as const;

const NEW_SCAN_DETAIL_KEYS = [
  'resetUploadDialogTitle',
  'resetUploadDialogBody',
  'resetUploadConfirm',
  'resetUploadPending',
  'resetUploadError',
  'requestExpertReviewDialogTitle',
  'requestExpertReviewDialogBody',
  'requestExpertReviewAlready',
  'requestExpertReviewSubmit',
  'requestExpertReviewPending',
  'requestExpertReviewError',
  'markComplete',
  'markIncomplete',
  'close',
] as const;

const LOCALES: Record<string, Record<string, unknown>> = { de, es, fil, fr, it: italian, pt };

function get(resource: Record<string, unknown>, namespace: string, key: string): unknown {
  const section = resource[namespace];
  if (typeof section !== 'object' || section === null) return undefined;
  return (section as Record<string, unknown>)[key];
}

describe('i18n key parity for the upload-robustness / reset-upload / tags / expert-review strings', () => {
  it('finds every new key in English first, so a typo here fails loudly', () => {
    for (const key of NEW_ACTION_KEYS) expect(get(en, 'actions', key)).toBeTypeOf('string');
    for (const key of NEW_CREATE_SCAN_KEYS) expect(get(en, 'createScan', key)).toBeTypeOf('string');
    for (const key of NEW_SCAN_DETAIL_KEYS) expect(get(en, 'scanDetail', key)).toBeTypeOf('string');
  });

  for (const [locale, resource] of Object.entries(LOCALES)) {
    describe(locale, () => {
      it('translates every new actions.* key', () => {
        for (const key of NEW_ACTION_KEYS) {
          const value = get(resource, 'actions', key);
          expect(value, `actions.${key}`).toBeTypeOf('string');
          expect((value as string).length, `actions.${key}`).toBeGreaterThan(0);
        }
      });

      it('translates every new createScan.* key', () => {
        for (const key of NEW_CREATE_SCAN_KEYS) {
          const value = get(resource, 'createScan', key);
          expect(value, `createScan.${key}`).toBeTypeOf('string');
          expect((value as string).length, `createScan.${key}`).toBeGreaterThan(0);
        }
      });

      it('translates every new scanDetail.* key', () => {
        for (const key of NEW_SCAN_DETAIL_KEYS) {
          const value = get(resource, 'scanDetail', key);
          expect(value, `scanDetail.${key}`).toBeTypeOf('string');
          expect((value as string).length, `scanDetail.${key}`).toBeGreaterThan(0);
        }
      });

      it('does not just repeat the English string verbatim', () => {
        // A cheap signal for "forgot to translate this one" without requiring
        // a real translation-quality check: interpolation-only or otherwise
        // very short strings are allowed to legitimately match.
        const mismatches: string[] = [];
        for (const key of NEW_CREATE_SCAN_KEYS) {
          const englishValue = get(en, 'createScan', key) as string;
          const localValue = get(resource, 'createScan', key) as string;
          if (englishValue.length > 20 && englishValue === localValue) {
            mismatches.push(`createScan.${key}`);
          }
        }
        expect(mismatches).toEqual([]);
      });
    });
  }
});
