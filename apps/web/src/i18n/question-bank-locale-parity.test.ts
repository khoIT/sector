import { describe, expect, it } from 'vitest';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
// Named `itLocale`, not `it` — that would shadow vitest's own `it` above.
import itLocale from './locales/it.json';
import pt from './locales/pt.json';

/**
 * The `questionBanks` and `quiz` namespaces are new in every one of the seven
 * locales at once — unlike the rest of this corpus (see i18n/index.ts's doc
 * comment: most namespaces are a partial lift from the legacy translations,
 * with English filling the gaps by design). There is no legacy source to be
 * partial FROM here, so these two namespaces hold each other to full parity:
 * the same key set, in the same shape, in all seven files.
 */
const LOCALES: Record<string, unknown> = { en, es, it: itLocale, de, pt, fil, fr };
const NAMESPACES = ['questionBanks', 'quiz'] as const;

function keysOf(locale: unknown, namespace: string): string[] {
  const value = (locale as Record<string, unknown>)[namespace];
  return value && typeof value === 'object' ? Object.keys(value).sort() : [];
}

/** The translated string at `locale[namespace][key]`, or '' if any of the
 *  three levels is missing — the parity assertions below are what turn a
 *  missing value into a readable failure rather than a thrown TypeError. */
function translationAt(locale: unknown, namespace: string, key: string): string {
  const dict = (locale as Record<string, unknown>)[namespace];
  if (!dict || typeof dict !== 'object') return '';
  const value = (dict as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function placeholdersIn(value: string): string[] {
  return [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1] ?? '').sort();
}

describe('questionBanks/quiz translation parity', () => {
  for (const namespace of NAMESPACES) {
    const englishKeys = keysOf(en, namespace);

    it(`${namespace}: English carries at least one real key`, () => {
      expect(englishKeys.length).toBeGreaterThan(0);
    });

    for (const [locale, dict] of Object.entries(LOCALES)) {
      if (locale === 'en') continue;

      it(`${namespace}: ${locale} has exactly the same keys as English`, () => {
        expect(keysOf(dict, namespace)).toEqual(englishKeys);
      });

      it(`${namespace}: ${locale} translates every key to a non-empty string`, () => {
        for (const key of englishKeys) {
          const value = translationAt(dict, namespace, key);
          expect(value.length, `${locale}.${namespace}.${key}`).toBeGreaterThan(0);
        }
      });

      it(`${namespace}: ${locale} carries the same {{placeholders}} as English`, () => {
        for (const key of englishKeys) {
          const english = translationAt(en, namespace, key);
          const translated = translationAt(dict, namespace, key);
          expect(placeholdersIn(translated), `${locale}.${namespace}.${key}`).toEqual(
            placeholdersIn(english),
          );
        }
      });
    }
  }
});
