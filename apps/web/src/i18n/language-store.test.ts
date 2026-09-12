import { describe, expect, it, vi } from 'vitest';

import { LOCALES } from './config';
import {
  applyDocumentLanguage,
  flagFor,
  readStoredLocale,
  writeStoredLocale,
} from './language-store';

function storageHolding(value: string | null) {
  return { getItem: () => value };
}

describe('readStoredLocale', () => {
  it('returns a stored locale it knows', () => {
    expect(readStoredLocale(storageHolding('fr'))).toBe('fr');
    expect(readStoredLocale(storageHolding('fil'))).toBe('fil');
  });

  it('falls back rather than handing i18next a locale with no bundle', () => {
    expect(readStoredLocale(storageHolding('kl'))).toBe('en');
    expect(readStoredLocale(storageHolding(''))).toBe('en');
    expect(readStoredLocale(storageHolding(null))).toBe('en');
    expect(readStoredLocale(undefined)).toBe('en');
  });

  it('survives a storage that throws, as a blocked private window does', () => {
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readStoredLocale(hostile)).toBe('en');
  });
});

describe('writeStoredLocale', () => {
  it('writes under the key the legacy app uses', () => {
    const setItem = vi.fn();
    writeStoredLocale({ setItem }, 'de');
    expect(setItem).toHaveBeenCalledWith('language', 'de');
  });

  it('does not throw when the store is full or blocked', () => {
    const hostile = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writeStoredLocale(hostile, 'de')).not.toThrow();
    expect(() => writeStoredLocale(undefined, 'de')).not.toThrow();
  });
});

describe('applyDocumentLanguage', () => {
  it('stamps lang on the root, which is what picks a screen-reader voice', () => {
    const setAttribute = vi.fn();
    applyDocumentLanguage({ setAttribute }, 'es');
    expect(setAttribute).toHaveBeenCalledWith('lang', 'es');
  });

  it('does nothing without a root', () => {
    expect(() => applyDocumentLanguage(null, 'es')).not.toThrow();
  });
});

describe('flagFor', () => {
  it('flies the country, not the language', () => {
    // The three mappings a derivation from the language code gets wrong.
    expect(flagFor('en')).toBe('🇺🇸');
    expect(flagFor('pt')).toBe('🇧🇷');
    expect(flagFor('fil')).toBe('🇵🇭');
  });

  it('handles the straightforward ones', () => {
    expect(flagFor('fr')).toBe('🇫🇷');
    expect(flagFor('de')).toBe('🇩🇪');
    expect(flagFor('es')).toBe('🇪🇸');
    expect(flagFor('it')).toBe('🇮🇹');
  });

  it('produces a two-codepoint flag for every locale', () => {
    for (const locale of LOCALES) {
      expect([...flagFor(locale)]).toHaveLength(2);
    }
  });
});
