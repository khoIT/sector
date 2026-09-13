import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderDecommissionDocument } from './legacy-route-map-document';

/**
 * The committed decommission document is what the route map renders. When
 * this fails, run `pnpm docs:legacy-routes` and
 * commit the result — never edit the tables by hand.
 */
describe('docs/decommission-dashboard.md', () => {
  it('matches the route map', () => {
    const committed = readFileSync(
      fileURLToPath(new URL('../../../../docs/decommission-dashboard.md', import.meta.url)),
      'utf8',
    );
    expect(committed).toBe(renderDecommissionDocument());
  });
});
