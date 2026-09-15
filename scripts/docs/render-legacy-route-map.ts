import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  GENERATED_SECTION_MARKER,
  renderDecommissionDocument,
} from '../../apps/web/src/app/legacy-route-map-document';

/**
 * Write the generated half of docs/decommission-dashboard.md from the legacy
 * route map.
 *
 *   pnpm docs:legacy-routes
 *
 * The document is two halves: hand-written cutover prose above the marker,
 * generated tables from the marker down. Only the second half is rewritten,
 * so the switch-off order and the recorded cutover decisions survive a
 * regeneration. A test asserts the committed generated half matches what this
 * renders, so the table in the doc and the table the router uses cannot drift
 * apart.
 */
const target = fileURLToPath(new URL('../../docs/decommission-dashboard.md', import.meta.url));
const existing = readFileSync(target, 'utf8');

// The marker is the only seam between the hand-written head and the generated
// tables, so it has to be unambiguous. Matching the first occurrence would be
// wrong the moment the prose above quotes the marker to explain how the split
// works: the write below would cut there and drop every line in between, which
// is the one part of this file no tool can reconstruct. So two markers is an
// error, not something to resolve by picking one.
const markerCount = existing.split(GENERATED_SECTION_MARKER).length - 1;

if (markerCount !== 1) {
  process.stderr.write(
    markerCount === 0
      ? `${target} has no generated-section marker.\n` +
          'Refusing to write, because the hand-written cutover prose above the marker would be\n' +
          'lost. Restore the marker line, then re-run.\n'
      : `${target} has ${markerCount} generated-section markers.\n` +
          'Refusing to write, because the boundary between hand-written and generated content\n' +
          'is ambiguous. Leave exactly one; to mention the marker in prose, break the string\n' +
          'up so it cannot match.\n',
  );
  process.exit(1);
}

writeFileSync(
  target,
  existing.slice(0, existing.indexOf(GENERATED_SECTION_MARKER)) + renderDecommissionDocument(),
);
process.stdout.write(`wrote the generated section of ${target}\n`);
