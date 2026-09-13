import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import baseline from './locale-completeness-baseline.json';

/**
 * The completeness gate: any key present (and non-empty) in `en.json` must be
 * present and non-empty in every other locale, or the build fails.
 *
 * This corpus already carried a gap before this gate existed — 74 keys,
 * identical across all six non-English locales, measured directly off the
 * committed files rather than taken from an earlier estimate (one report put
 * it at 68; that number does not match either file on disk). Failing on the
 * whole corpus on day one would leave this permanently red and train
 * everyone to ignore it, so the pre-existing 74 are named explicitly in
 * `locale-completeness-baseline.json` and excused ONLY there. Anything else
 * missing — a new key added to `en.json` without its translations, or a key
 * removed from a locale by accident — fails here, by name, per locale.
 *
 * The baseline is meant to shrink, not to grow: the first test below fails
 * the moment a baselined key is actually translated, so a translation PR
 * that forgets to trim the baseline entry fails loudly instead of leaving a
 * stale excuse for a gap that no longer exists.
 */

const LOCALES_DIR = fileURLToPath(new URL('./locales/', import.meta.url));
const BASELINE = baseline as Record<string, string[]>;

function leafKeyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function readAt(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      source,
    );
}

function readLocale(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8')) as Record<string, unknown>;
}

function isTranslated(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

const english = readLocale('en.json');
const englishKeys = leafKeyPaths(english);
const localeFiles = readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json') && file !== 'en.json')
  .sort();

describe('i18n completeness gate', () => {
  it('found the English corpus at all -- a zero-key read would pass everything below vacuously', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  it('every locale file named in the baseline still exists', () => {
    const localeNames = new Set(localeFiles.map((file) => file.replace('.json', '')));
    const orphaned = Object.keys(BASELINE).filter((locale) => !localeNames.has(locale));
    expect(orphaned, 'baseline names a locale with no matching file').toEqual([]);
  });

  it('names no key that is not actually missing from en.json', () => {
    // A typo'd or renamed key in the baseline would silently excuse nothing --
    // it would never match a real gap, and the file would just be wrong.
    const englishKeySet = new Set(englishKeys);
    const unknown: string[] = [];
    for (const [locale, keys] of Object.entries(BASELINE)) {
      for (const key of keys) {
        if (!englishKeySet.has(key)) unknown.push(`${locale}: ${key}`);
      }
    }
    expect(unknown, 'baseline entries with no matching en.json key').toEqual([]);
  });

  it('the baseline shrinks as translations land -- no stale excuses', () => {
    const stale: string[] = [];
    for (const [locale, keys] of Object.entries(BASELINE)) {
      const data = readLocale(`${locale}.json`);
      for (const key of keys) {
        if (isTranslated(readAt(data, key))) {
          stale.push(`${locale}: ${key}`);
        }
      }
    }
    expect(
      stale,
      `these baseline entries are translated now and must be removed from ` +
        `locale-completeness-baseline.json: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  for (const file of localeFiles) {
    const locale = file.replace('.json', '');

    it(`${locale} has every en.json key beyond the known, baselined gap`, () => {
      const data = readLocale(file);
      const excused = new Set(BASELINE[locale] ?? []);

      const newGaps = englishKeys.filter((key) => {
        if (excused.has(key)) return false;
        return !isTranslated(readAt(data, key));
      });

      expect(
        newGaps,
        newGaps.length === 0
          ? undefined
          : `${locale} is missing ${newGaps.length} key(s) not covered by the baseline: ${newGaps.join(', ')}`,
      ).toEqual([]);
    });
  }
});
