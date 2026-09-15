import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GENERATED_SECTION_MARKER, renderDecommissionDocument } from './legacy-route-map-document';

/**
 * The committed decommission document's generated half is what the route map
 * renders. When this fails, run `pnpm docs:legacy-routes` and commit the
 * result — never edit the tables by hand.
 *
 * Only the span from the marker down is compared. The prose above it is
 * hand-written (cutover decisions, switch-off order, rollback) and is
 * deliberately not the renderer's business.
 */
describe('docs/decommission-dashboard.md', () => {
  const committed = (): string =>
    readFileSync(
      fileURLToPath(new URL('../../../../docs/decommission-dashboard.md', import.meta.url)),
      'utf8',
    );

  it('carries the generated-section marker exactly once', () => {
    // Zero and two are both failures, for different reasons. Without it the
    // writer refuses to run; with two, the seam between hand-written and
    // generated content is ambiguous and the writer would cut at the first —
    // dropping the prose in between. Both have to fail here rather than at
    // someone's next regeneration.
    expect(committed().split(GENERATED_SECTION_MARKER).length - 1).toBe(1);
  });

  it('matches the route map from the marker down', () => {
    const text = committed();
    expect(text.slice(text.indexOf(GENERATED_SECTION_MARKER))).toBe(renderDecommissionDocument());
  });

  it('keeps hand-written prose above the marker', () => {
    const text = committed();
    expect(text.slice(0, text.indexOf(GENERATED_SECTION_MARKER)).trim()).not.toBe('');
  });
});
