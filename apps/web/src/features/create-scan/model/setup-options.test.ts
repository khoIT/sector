import type { ScanTypeSummary, UserGroup } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { groupOptions, groupTriggerLabel, scanTypeOptions, toggleGroup } from './setup-options';

function group(id: string, name: string, parent?: { id: string; name: string }): UserGroup {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    parent: parent ? { ...parent, slug: parent.name.toLowerCase() } : null,
  };
}

function scanType(id: string, name: string, version?: string): ScanTypeSummary {
  return { id, name, ...(version ? { version } : {}) } as ScanTypeSummary;
}

describe('scanTypeOptions', () => {
  it('puts the version on the second line', () => {
    expect(scanTypeOptions([scanType('1', 'AAA', '5')])).toEqual([
      { value: '1', label: 'AAA', description: 'v5' },
    ]);
  });

  it('omits the description when a type carries no version', () => {
    expect(scanTypeOptions([scanType('1', 'AAA')])).toEqual([{ value: '1', label: 'AAA' }]);
  });

  it('answers empty while the list is still loading', () => {
    expect(scanTypeOptions(undefined)).toEqual([]);
  });
});

describe('groupOptions', () => {
  it('names the parent underneath, which is what tells two cohorts apart', () => {
    expect(
      groupOptions([group('g1', 'Class of 2029', { id: 'p', name: 'William Carey' })]),
    ).toEqual([{ value: 'g1', label: 'Class of 2029', description: 'in William Carey' }]);
  });

  it('omits the line for a top-level group', () => {
    expect(groupOptions([group('g1', 'Fellows')])).toEqual([{ value: 'g1', label: 'Fellows' }]);
  });

  it('answers empty while the list is still loading', () => {
    expect(groupOptions(undefined)).toEqual([]);
  });
});

describe('groupTriggerLabel', () => {
  const groups = [group('g1', 'Class of 2029'), group('g2', 'Faculty'), group('g3', 'Fellows')];

  it('says so when a study is going nowhere', () => {
    expect(groupTriggerLabel([], groups)).toBe('No groups');
  });

  it('names the single group rather than counting to one', () => {
    expect(groupTriggerLabel(['g2'], groups)).toBe('Faculty');
  });

  it('counts past one', () => {
    expect(groupTriggerLabel(['g1', 'g2'], groups)).toBe('2 groups');
    expect(groupTriggerLabel(['g1', 'g2', 'g3'], groups)).toBe('3 groups');
  });

  it('falls back to a count when the single group is not in the list', () => {
    // A restored draft can hold a group the learner has since been removed
    // from. Better a vague label than a blank trigger.
    expect(groupTriggerLabel(['gone'], groups)).toBe('1 group');
  });

  it('does not blow up before the groups have loaded', () => {
    expect(groupTriggerLabel(['g1'], undefined)).toBe('1 group');
    expect(groupTriggerLabel([], undefined)).toBe('No groups');
  });
});

describe('toggleGroup', () => {
  it('adds a group at the end', () => {
    expect(toggleGroup(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a group without disturbing the others', () => {
    expect(toggleGroup(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('can empty the selection', () => {
    expect(toggleGroup(['a'], 'a')).toEqual([]);
  });

  it('does not mutate the array it was given', () => {
    const selected = ['a'];
    toggleGroup(selected, 'b');
    expect(selected).toEqual(['a']);
  });
});
