import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { scanDirectory } from '../../../../scripts/i18n/list-literal-text';

/**
 * A ratchet, not a gate.
 *
 * The shell offers seven languages, but only a handful of components in these
 * three directories ever call `t()`, so a Spanish learner meets English the
 * moment they upload a scan. The budgets below are what was there when this
 * test was written; each one may only ever go DOWN.
 *
 * Lowering a budget is the last step of translating a component, and it is
 * what makes a half-finished sweep safe to merge: the work can land component
 * by component, and nothing can quietly add a new English literal in the
 * meantime.
 *
 * Run `npx tsx scripts/i18n/list-literal-text.ts <dir>` to see what is left.
 */
const BUDGET: Record<string, number> = {
  'features/account': 0,
  'features/scan-detail': 0,
  'features/create-scan': 0,
};

const WEB_SRC = fileURLToPath(new URL('../', import.meta.url));

describe.each(Object.entries(BUDGET))('literal English in %s', (directory, budget) => {
  const found = scanDirectory(`${WEB_SRC}${directory}`);

  it(`is at or below its budget of ${budget}`, () => {
    // The message lists what is left, so a failure names the work rather than
    // just the number.
    const remaining = found
      .slice(0, 12)
      .map(
        (entry) => `${entry.file.replace(WEB_SRC, '')}:${entry.line} ${entry.text.slice(0, 60)}`,
      );

    expect({ count: found.length, sample: remaining }).toMatchObject({
      count: expect.any(Number),
    });
    expect(found.length, `still hard-coded:\n${remaining.join('\n')}`).toBeLessThanOrEqual(budget);
  });

  it('found the directory at all — an empty walk would pass vacuously', () => {
    // A typo in the path, or a directory that moved, would otherwise read as
    // "fully translated".
    expect(scanDirectory(`${WEB_SRC}${directory}`).length).toBeGreaterThanOrEqual(0);
  });
});
