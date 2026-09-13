import { GROUP_MEMBER_ROLES, GROUP_MEMBER_STATUSES } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { memberRoleTone, memberStatusTone } from './member-badge-tone';

describe('memberStatusTone', () => {
  it.each([
    ['active', 'ok'],
    ['pending', 'warn'],
    ['inactive', 'neutral'],
    ['expired', 'crit'],
  ] as const)('maps %j to %j', (status, tone) => {
    expect(memberStatusTone(status)).toBe(tone);
  });

  it('maps every real status to a tone', () => {
    for (const status of GROUP_MEMBER_STATUSES) {
      expect(memberStatusTone(status)).toBeTruthy();
    }
  });
});

describe('memberRoleTone', () => {
  it('accents a leader and leaves a learner neutral', () => {
    expect(memberRoleTone('leader')).toBe('accent');
    expect(memberRoleTone('learner')).toBe('neutral');
  });

  it('maps every real role to a tone', () => {
    for (const role of GROUP_MEMBER_ROLES) {
      expect(memberRoleTone(role)).toBeTruthy();
    }
  });
});
