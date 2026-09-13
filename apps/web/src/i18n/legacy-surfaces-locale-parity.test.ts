import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The retired-surface page is the one page a user reaches from an OLD link
 * with no context at all, so it must speak every language the shell offers.
 * The keys under `retired` in English must exist in every other locale.
 */
const LOCALES_DIR = fileURLToPath(new URL('./locales/', import.meta.url));

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) =>
    leafKeys(inner, prefix ? `${prefix}.${key}` : key),
  );
}

describe('the retired-surface strings exist in every locale', () => {
  const files = readdirSync(LOCALES_DIR).filter((file) => file.endsWith('.json'));
  const english = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const expected = leafKeys(english.retired, 'retired');

  it('has the English keys at all', () => {
    expect(expected.length).toBeGreaterThan(9);
  });

  it.each(files.filter((file) => file !== 'en.json'))('%s', (file) => {
    const locale = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(leafKeys(locale.retired, 'retired').sort()).toEqual([...expected].sort());
  });
});
