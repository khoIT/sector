import { describe, expect, it } from 'vitest';

import { memberColumnsFor } from './columns';

describe('memberColumnsFor', () => {
  it('renders one shared definition for both roles rather than two screens', () => {
    const leaderColumns = memberColumnsFor('leader');
    const administratorColumns = memberColumnsFor('administrator');

    // The administrator set starts with the exact same column defs, in the
    // same order — proof that one array backs both, not a second hand-copy.
    expect(administratorColumns.slice(0, leaderColumns.length)).toEqual(leaderColumns);
  });

  it('differs only by the actions column an administrator additionally gets', () => {
    const leaderIds = memberColumnsFor('leader').map((column) => column.id);
    const administratorIds = memberColumnsFor('administrator').map((column) => column.id);

    expect(administratorIds).toEqual([...leaderIds, 'actions']);
  });

  it('never drops a column a leader sees from the administrator set', () => {
    const leaderIds = memberColumnsFor('leader').map((column) => column.id);
    const administratorIds = new Set(memberColumnsFor('administrator').map((column) => column.id));

    for (const id of leaderIds) {
      expect(administratorIds.has(id)).toBe(true);
    }
  });

  it('gives every column a translation key', () => {
    for (const role of ['leader', 'administrator'] as const) {
      for (const column of memberColumnsFor(role)) {
        expect(column.labelKey).toMatch(/^groups\.members\.columns\./);
      }
    }
  });
});
