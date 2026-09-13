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
 * Key parity for the `groups` namespace across all seven locales.
 *
 * Scoped to this ONE namespace deliberately: several of the OLDER namespaces
 * (`row`, `toolbar`, ...) are only partly translated in the six non-English
 * files today, so a whole-file parity assertion would fail on pre-existing
 * gaps this change did not create. `groups` is new, so every locale ships the
 * complete set from day one — this test is what keeps it that way.
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

const englishKeys = leafKeyPaths((en as { groups: unknown }).groups).sort();

describe('groups namespace key parity', () => {
  it('has a non-empty namespace to compare against', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(LOCALES))(
    '%s carries every key English does, and no others',
    (_locale, catalogue) => {
      const groups = (catalogue as { groups?: unknown }).groups;
      expect(groups).toBeDefined();

      const keys = leafKeyPaths(groups).sort();
      expect(keys).toEqual(englishKeys);
    },
  );
});
