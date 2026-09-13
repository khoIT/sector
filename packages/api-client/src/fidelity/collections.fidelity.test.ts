import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REPLAY_ENTRIES } from './manifest';
import { openMirror, type Mirror } from './mirror';
import { formatReplayReport } from './report';
import { replayEntry, unexpectedShapes, type ReplayResult } from './replay';

/**
 * The fidelity gate: every document in the production mirror parses, or the
 * shape that does not is written down in the manifest with a reason.
 *
 *   pnpm fidelity
 *
 * Needs the LOCAL mirror (scripts/data/restore-prod-mirror.sh). Nothing here
 * can reach the production cluster: openMirror refuses any host that is not
 * loopback. The full report is printed at the end whether or not it passes,
 * because the parse rates are the deliverable even when they are 100%.
 */

let mirror: Mirror;
const results: ReplayResult[] = [];

beforeAll(async () => {
  mirror = await openMirror();
});

afterAll(async () => {
  process.stdout.write(formatReplayReport(results));
  await mirror?.close();
});

describe.each(REPLAY_ENTRIES.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
  it('parses every production document, or a shape the manifest names', async () => {
    const result = await replayEntry(mirror.db, entry);
    results.push(result);

    expect(result.total, 'the collection is not empty — is the mirror restored?').toBeGreaterThan(
      0,
    );

    const unexpected = unexpectedShapes(result, entry).map(
      (shape) => `${shape.count}× ${shape.signature} (sample ${shape.sampleId})`,
    );
    expect(unexpected).toEqual([]);
  });
});
