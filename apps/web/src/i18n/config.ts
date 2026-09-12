/**
 * The seven locales the GUSI apps ship, and the flag each one flies.
 *
 * Copied from `gusi_web_dashboard/src/i18n/config.ts` rather than derived,
 * because three of the seven mappings are not what a derivation would produce:
 * Portuguese flies Brazil, Filipino flies the Philippines, and English flies
 * the United States. Deriving a country from a language code gets all three
 * wrong, and gets them wrong in a way nobody notices until a user does.
 */

export const LOCALES = ['en', 'es', 'it', 'de', 'pt', 'fil', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Each language's name in that language, as legacy lists them. */
export const LOCALE_NAME: Readonly<Record<Locale, string>> = {
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  de: 'Deutsch',
  pt: 'Português',
  fil: 'Filipino',
  fr: 'Français',
};

/** Locale → ISO country for the flag. See the note above on pt/fil/en. */
export const LOCALE_COUNTRY: Readonly<Record<Locale, string>> = {
  en: 'us',
  es: 'es',
  it: 'it',
  de: 'de',
  pt: 'br',
  fil: 'ph',
  fr: 'fr',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
