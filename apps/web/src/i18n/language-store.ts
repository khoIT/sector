import { DEFAULT_LOCALE, LOCALE_COUNTRY, isLocale, type Locale } from './config';

/**
 * Where the chosen language lives, and what else has to be told about it.
 *
 * The key is `language`, matching the legacy dashboard, so a user who has both
 * apps open on the same origin does not get two different languages. (They are
 * different origins today; the cost of matching is nil and the cost of not
 * matching, if they are ever merged, is a silent reset.)
 */

const STORAGE_KEY = 'language';

/**
 * Read the stored choice.
 *
 * Every access is guarded: `localStorage` throws outright in a private window
 * with site data blocked, and returns a stale value from a build that knew a
 * locale this one does not. An unknown value falls back rather than being
 * handed to i18next, which would otherwise resolve keys against a resource
 * bundle that does not exist.
 */
export function readStoredLocale(storage: Pick<Storage, 'getItem'> | undefined): Locale {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function writeStoredLocale(
  storage: Pick<Storage, 'setItem'> | undefined,
  locale: Locale,
): void {
  try {
    storage?.setItem(STORAGE_KEY, locale);
  } catch {
    // A blocked or full store costs the preference on the next reload, which
    // is not worth failing a language change over.
  }
}

/**
 * Stamp the language onto <html>.
 *
 * This is not decoration: `lang` is what a screen reader reads to choose a
 * voice and a pronunciation model, and what a browser uses to pick
 * hyphenation. A page of Spanish announced by an English voice is materially
 * worse than one that was never translated.
 */
export function applyDocumentLanguage(
  root: { setAttribute: (name: string, value: string) => void } | null | undefined,
  locale: Locale,
): void {
  root?.setAttribute('lang', locale);
}

/**
 * The flag, as regional-indicator letters rather than an icon font.
 *
 * The legacy app pulls in `flag-icons`, a CSS package with a sprite per
 * country, to render a 16×12 rectangle. Two codepoints do the same job with no
 * dependency and no stylesheet. Where a platform has no flag glyph — Windows
 * Chrome, notably — it renders the two letters instead, which still says which
 * country, so the degraded case is legible rather than blank.
 */
export function flagFor(locale: Locale): string {
  const country = LOCALE_COUNTRY[locale];
  const REGIONAL_INDICATOR_A = 0x1f1e6;
  const LETTER_A = 'a'.charCodeAt(0);

  return [...country.toLowerCase()]
    .map((letter) => String.fromCodePoint(REGIONAL_INDICATOR_A + (letter.charCodeAt(0) - LETTER_A)))
    .join('');
}
