import { describe, expect, it } from 'vitest';

import { memberColumnsFor } from './columns';

describe('memberColumnsFor', () => {
  it('produces the identical column set for both roles today', () => {
    // Honest about the current state: there is no administrator-only column
    // yet (the write slice — role changes, removal — is what will add one),
    // so both roles read the exact same array. This is the test to update
    // when that column comes back.
    expect(memberColumnsFor('administrator')).toEqual(memberColumnsFor('leader'));
  });

  it('is one shared definition, not two hand-maintained lists', () => {
    // Reference equality, not just deep equality: both roles resolve to the
    // SAME array object, which is what proves one definition backs both
    // rather than two copies that happen to match right now.
    expect(memberColumnsFor('leader')).toBe(memberColumnsFor('administrator'));
  });

  it('lists the columns backed by real group-member data', () => {
    expect(memberColumnsFor('leader').map((column) => column.id)).toEqual([
      'member',
      'role',
      'status',
      'joined',
      'expires',
    ]);
  });

  it('gives every column a translation key', () => {
    for (const role of ['leader', 'administrator'] as const) {
      for (const column of memberColumnsFor(role)) {
        expect(column.labelKey).toMatch(/^groups\.members\.columns\./);
      }
    }
  });
});
