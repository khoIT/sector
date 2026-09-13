import { describe, expect, it } from 'vitest';

import { scanNoteSchema } from './schemas/scan';
import { scanTypeItemSchema } from './schemas/scan-type';
import { sharedScanDetailSchema } from './schemas/shared-scan-detail';
import { sharedScanListItemSchema } from './schemas/shared-scan-list';

/**
 * Shapes found by replaying the production mirror (`pnpm fidelity`) on
 * 13 Sep 2026, outside the scan schema itself. The fixtures are the projected
 * documents the replay parsed, with identifying values replaced.
 */

const share = {
  id: 'sh1',
  email: 'recipient@example.test',
  status: 'opened',
  remarks: null,
  sharedBy: { id: 'u1', userName: 'sharer', email: 'sharer@example.test' },
  createdAt: '2025-06-05T09:18:36.357Z',
  updatedAt: '2025-06-05T09:20:05.846Z',
};

describe('a share whose study has since been deleted (5 of 282 production shares)', () => {
  it('parses on the list with scan null instead of blanking the page', () => {
    const parsed = sharedScanListItemSchema.parse({ ...share, scan: null });
    expect(parsed.scan).toBeNull();
  });

  it('parses on the detail route too', () => {
    expect(sharedScanDetailSchema.parse({ ...share, scan: null }).scan).toBeNull();
  });

  it('still requires a real study when one is sent', () => {
    expect(() => sharedScanListItemSchema.parse({ ...share, scan: { id: 's1' } })).toThrow();
  });
});

describe('a note whose scan has since been deleted (729 of 18,923 production notes)', () => {
  it('parses with scan null', () => {
    const parsed = scanNoteSchema.parse({
      id: 'n1',
      note: 'no findings',
      user: { id: 'u1', userName: 'learner', email: 'learner@example.test' },
      scan: null,
      createdAt: '2025-04-07T09:19:53.319Z',
      updatedAt: '2025-04-07T09:19:53.319Z',
    });
    expect(parsed.scan).toBeNull();
  });
});

describe('a scan-type item with no control type (12 of 893 production items)', () => {
  it('parses with type null', () => {
    const parsed = scanTypeItemSchema.parse({
      id: 'i1',
      key: 'v2_aaa_note',
      name: 'Note',
      parent: null,
      type: null,
      options: [],
    });
    expect(parsed.type).toBeNull();
  });
});
