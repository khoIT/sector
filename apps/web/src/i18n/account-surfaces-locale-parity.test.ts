import { describe, expect, it } from 'vitest';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import fr from './locales/fr.json';
// Named `itLocale`, not `it` — the Italian bundle would otherwise shadow
// vitest's `it` in this module scope and every test below would silently
// call the JSON module instead of registering a test.
import itLocale from './locales/it.json';
import pt from './locales/pt.json';

/**
 * Every key added for password recovery, the invitation landing page, group
 * notification preferences and account deletion must exist — translated,
 * not just present — in all seven locale bundles. `initI18n` falls back to
 * English for a missing key, so a gap here would not crash anything; it would
 * just quietly leave a non-English page speaking English on the one surface
 * where a confused, locked-out user arrives.
 *
 * Scoped to the namespaces THIS phase added rather than the whole file: the
 * rest of the corpus already had known partial-translation gaps before this
 * work (see the doc comment on `i18n/index.ts`), and closing those is not
 * this phase's job.
 */
const NEW_NAMESPACES = [
  'auth',
  'recovery',
  'invitation',
  'notifications',
  'deleteAccount',
] as const;

const LOCALES: Record<string, unknown> = { es, it: itLocale, de, pt, fil, fr };

/** Every leaf key path under a namespace, dot-joined (e.g. "notifications.types.scan_created"). */
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

describe.each(NEW_NAMESPACES)('locale parity for the "%s" namespace', (namespace) => {
  const englishKeys = leafKeyPaths((en as Record<string, unknown>)[namespace]);

  it('is not itself empty — a namespace with zero keys would pass vacuously', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(LOCALES))('%s has every English key, non-empty', (_locale, bundle) => {
    for (const keyPath of englishKeys) {
      const value = readAt((bundle as Record<string, unknown>)[namespace], keyPath);
      expect(typeof value, `${namespace}.${keyPath}`).toBe('string');
      expect((value as string).length, `${namespace}.${keyPath} is empty`).toBeGreaterThan(0);
    }
  });
});
