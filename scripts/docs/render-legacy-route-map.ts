import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderDecommissionDocument } from '../../apps/web/src/app/legacy-route-map-document';

/**
 * Write docs/decommission-dashboard.md from the legacy route map.
 *
 *   pnpm docs:legacy-routes
 *
 * A test asserts the committed document matches what this renders, so the
 * table in the doc and the table the router uses cannot drift apart.
 */
const target = fileURLToPath(new URL('../../docs/decommission-dashboard.md', import.meta.url));
writeFileSync(target, renderDecommissionDocument());
process.stdout.write(`wrote ${target}\n`);
