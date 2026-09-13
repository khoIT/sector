import { describe, expect, it } from 'vitest';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
// Named `italian`, not `it` — that would shadow vitest's `it` for the rest of
// this module.
import italian from './locales/it.json';
import pt from './locales/pt.json';

/**
 * Key parity for the `gallery`, `sage` and `assignments` namespaces across
 * all seven locales — same reasoning and pattern as
 * `groups-namespace-parity.test.ts`: these are new namespaces, so every
 * locale ships the complete set from day one.
 */
const LOCALES: Record<string, unknown> = { en, de, es, fil, fr, it: italian, pt };
const NAMESPACES = ['gallery', 'sage', 'assignments'] as const;

/** Every leaf key path under an object, dot-joined (arrays are not used here). */
function leafKeyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe.each(NAMESPACES)('%s namespace key parity', (namespace) => {
  const englishKeys = leafKeyPaths((en as Record<string, unknown>)[namespace]).sort();

  it('has a non-empty namespace to compare against', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(LOCALES))(
    '%s carries every key English does, and no others',
    (_locale, catalogue) => {
      const value = (catalogue as Record<string, unknown>)[namespace];
      expect(value).toBeDefined();

      const keys = leafKeyPaths(value).sort();
      expect(keys).toEqual(englishKeys);
    },
  );
});

describe('nav.gallery and nav.sage key parity', () => {
  it.each(Object.entries(LOCALES))('%s carries nav.gallery and nav.sage', (_locale, catalogue) => {
    const nav = (catalogue as { nav?: Record<string, unknown> }).nav;
    expect(typeof nav?.gallery).toBe('string');
    expect(typeof nav?.sage).toBe('string');
  });
});
