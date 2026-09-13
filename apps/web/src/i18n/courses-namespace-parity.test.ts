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
 * Key parity for the `courses` namespace across all seven locales — same
 * shape as `groups-namespace-parity.test.ts`, and for the same reason: this
 * namespace is new, so every locale ships the complete set from day one
 * rather than falling back silently to English for a missing key.
 */
const LOCALES: Record<string, unknown> = { en, de, es, fil, fr, it: italian, pt };

/** Every leaf key path under an object, dot-joined (arrays are not used here). */
function leafKeyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

const englishKeys = leafKeyPaths((en as { courses: unknown }).courses).sort();

describe('courses namespace key parity', () => {
  it('has a non-empty namespace to compare against', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(LOCALES))(
    '%s carries every key English does, and no others',
    (_locale, catalogue) => {
      const courses = (catalogue as { courses?: unknown }).courses;
      expect(courses).toBeDefined();

      const keys = leafKeyPaths(courses).sort();
      expect(keys).toEqual(englishKeys);
    },
  );
});
