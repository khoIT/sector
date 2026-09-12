import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, type Locale } from './config';
import { applyDocumentLanguage, readStoredLocale, writeStoredLocale } from './language-store';
import en from './locales/en.json';

/**
 * The translation seam.
 *
 * English is bundled; the other six load on demand. The legacy app imports all
 * seven eagerly, which puts six unused translation files in every first paint
 * for the ~all users who never change language. A dynamic import per locale
 * costs one request the first time someone switches and nothing after.
 *
 * Missing keys fall back to English rather than rendering the key. 53 of the
 * 117 strings here carry real translations lifted from the legacy corpus; the
 * remaining 64 are Scan Vault's own vocabulary — Outcome, Waiting, Asked, the
 * rubric line — which has never been translated because it has never existed.
 * Those read as English inside an otherwise translated page, which is what a
 * partly-translated product honestly looks like.
 */

const LOADERS: Readonly<Record<Exclude<Locale, 'en'>, () => Promise<{ default: unknown }>>> = {
  es: () => import('./locales/es.json'),
  it: () => import('./locales/it.json'),
  de: () => import('./locales/de.json'),
  pt: () => import('./locales/pt.json'),
  fil: () => import('./locales/fil.json'),
  fr: () => import('./locales/fr.json'),
};

const loaded = new Set<Locale>([DEFAULT_LOCALE]);

export function initI18n(): typeof i18next {
  const initial = readStoredLocale(globalThis.localStorage);

  void i18next.use(initReactI18next).init({
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'translation',
    resources: { en: { translation: en } },
    interpolation: {
      // React escapes for us; letting i18next escape as well turns an
      // apostrophe in a scan title into &#39; on screen.
      escapeValue: false,
    },
    returnNull: false,
  });

  applyDocumentLanguage(globalThis.document?.documentElement, DEFAULT_LOCALE);

  // A stored non-English choice is applied after init rather than as `lng`, so
  // the first paint never waits on a dynamic import.
  if (initial !== DEFAULT_LOCALE) void changeLocale(initial);

  return i18next;
}

/**
 * Switch language, loading its bundle first.
 *
 * A load failure leaves the current language in place and does not persist the
 * choice: a user who picks French over a flaky connection should see French or
 * see what they had, never an English page that claims to be French.
 */
export async function changeLocale(locale: Locale): Promise<void> {
  if (!loaded.has(locale) && locale !== DEFAULT_LOCALE) {
    try {
      const bundle = await LOADERS[locale as Exclude<Locale, 'en'>]();
      i18next.addResourceBundle(locale, 'translation', bundle.default, true, true);
      loaded.add(locale);
    } catch {
      return;
    }
  }

  await i18next.changeLanguage(locale);
  writeStoredLocale(globalThis.localStorage, locale);
  applyDocumentLanguage(globalThis.document?.documentElement, locale);
}
