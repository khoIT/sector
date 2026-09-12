import { describe, expect, it } from 'vitest';

import {
  accountDisplayName,
  initialsFor,
  isDefaultPhoto,
  realPhotoUrl,
  roleLabel,
} from './user-initials';

describe('initialsFor', () => {
  it('takes one letter from each name when both are there', () => {
    expect(initialsFor({ firstName: 'Demo', lastName: 'Learner', userName: 'sv_learner' })).toBe(
      'DL',
    );
  });

  it('takes two letters from a single name', () => {
    expect(initialsFor({ firstName: 'Demo', lastName: null, userName: 'sv_learner' })).toBe('DE');
    expect(initialsFor({ firstName: null, lastName: 'Learner', userName: 'sv_learner' })).toBe(
      'LE',
    );
  });

  it('falls back to the username, which every user has', () => {
    // 166 of 3,151 users have no first name; all 3,151 have a username.
    expect(initialsFor({ firstName: null, lastName: null, userName: 'sv_learner' })).toBe('SV');
    expect(initialsFor({ firstName: '   ', lastName: '', userName: 'khoi' })).toBe('KH');
  });

  it('skips punctuation rather than rendering it as an initial', () => {
    expect(initialsFor({ firstName: "'Brien", lastName: 'Ross', userName: 'x' })).toBe('BR');
    expect(initialsFor({ firstName: null, lastName: null, userName: '_sv_' })).toBe('SV');
  });

  it('returns a single letter when that is genuinely all there is', () => {
    expect(initialsFor({ firstName: 'X', lastName: null, userName: 'x' })).toBe('X');
  });

  it('never renders blank', () => {
    expect(initialsFor(null)).toBe('?');
    expect(initialsFor(undefined)).toBe('?');
    expect(initialsFor({ firstName: '  ', lastName: null, userName: '  ' })).toBe('?');
    expect(initialsFor({ firstName: null, lastName: null, userName: '---' })).toBe('?');
  });
});

describe('accountDisplayName', () => {
  it('prefers the full name', () => {
    expect(
      accountDisplayName({ firstName: 'Demo', lastName: 'Learner', userName: 'sv_learner' }),
    ).toBe('Demo Learner');
  });

  it('uses whichever name exists, then the username', () => {
    expect(accountDisplayName({ firstName: 'Demo', lastName: null, userName: 'sv' })).toBe('Demo');
    expect(accountDisplayName({ firstName: null, lastName: null, userName: 'sv_learner' })).toBe(
      'sv_learner',
    );
  });

  it('never renders blank', () => {
    expect(accountDisplayName({ firstName: ' ', lastName: null, userName: ' ' })).toBe('Account');
    expect(accountDisplayName(null)).toBe('Account');
  });
});

describe('roleLabel', () => {
  it('title-cases the names the server sends lower-cased', () => {
    expect(roleLabel('subscriber')).toBe('Subscriber');
    expect(roleLabel('scan reviewer')).toBe('Scan Reviewer');
    expect(roleLabel('group leader')).toBe('Group Leader');
    expect(roleLabel('administrator')).toBe('Administrator');
  });

  it('normalises the one role that arrives already capitalised', () => {
    expect(roleLabel('Superadmin')).toBe('Superadmin');
  });

  it('has nothing to say about a missing role', () => {
    expect(roleLabel(null)).toBe('');
    expect(roleLabel('  ')).toBe('');
  });
});

describe('isDefaultPhoto', () => {
  const presigned =
    'https://gusi-scans-staging.s3.us-east-1.amazonaws.com/images/user.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc';

  it('treats the shared placeholder as no photo', () => {
    // The API substitutes images/user.png for every user without one, so this
    // URL comes back for all 3,151 accounts and identifies none of them.
    expect(isDefaultPhoto(presigned)).toBe(true);
    expect(isDefaultPhoto('https://cdn.example.test/images/user.png')).toBe(true);
  });

  it('keeps a photo that is actually someone', () => {
    expect(
      isDefaultPhoto('https://gusi-scans-staging.s3.amazonaws.com/images/6aa4/avatar.png?X-Amz=1'),
    ).toBe(false);
  });

  it('treats an absent photo as absent', () => {
    expect(isDefaultPhoto(null)).toBe(true);
    expect(isDefaultPhoto(undefined)).toBe(true);
    expect(isDefaultPhoto('  ')).toBe(true);
  });

  it('is not fooled by the key appearing in the signature', () => {
    expect(isDefaultPhoto('https://x.test/images/real.png?k=/images/user.png')).toBe(false);
  });
});

describe('realPhotoUrl', () => {
  it('hands back only a photo worth rendering', () => {
    expect(realPhotoUrl('https://x.test/images/user.png?sig=1')).toBeNull();
    expect(realPhotoUrl(null)).toBeNull();
    expect(realPhotoUrl('https://x.test/images/me.png')).toBe('https://x.test/images/me.png');
  });
});
