import { describe, expect, it } from 'vitest';

import {
  MAX_PHOTO_BYTES,
  photoRejectionReason,
  profileChanged,
  validatePassword,
  validateProfile,
} from './account-form-model';

describe('validateProfile', () => {
  it('trims what it accepts', () => {
    const result = validateProfile({ firstName: '  Demo ', lastName: 'Learner ' });
    expect(result).toEqual({ ok: true, value: { firstName: 'Demo', lastName: 'Learner' } });
  });

  it('accepts an empty name, which 166 users have', () => {
    const result = validateProfile({ firstName: '', lastName: '' });
    expect(result.ok).toBe(true);
  });

  it('reports the field that is wrong', () => {
    const result = validateProfile({ firstName: 'x'.repeat(101), lastName: 'Learner' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.firstName).toBeTruthy();
    expect(result.errors.lastName).toBeUndefined();
  });
});

describe('validatePassword', () => {
  const valid = {
    oldPassword: 'ScanVault!2026',
    newPassword: 'NewPassphrase!2026',
    confirmNewPassword: 'NewPassphrase!2026',
  };

  it('accepts a change the server will also accept', () => {
    expect(validatePassword(valid).ok).toBe(true);
  });

  it('catches a mismatched confirmation on the field the user retypes', () => {
    const result = validatePassword({ ...valid, confirmNewPassword: 'Different!2026' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.confirmNewPassword).toBe('The new passwords do not match');
  });

  it('catches a new password that is the current one', () => {
    const result = validatePassword({
      oldPassword: 'ScanVault!2026',
      newPassword: 'ScanVault!2026',
      confirmNewPassword: 'ScanVault!2026',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.newPassword).toBeTruthy();
  });

  it('requires every field', () => {
    const result = validatePassword({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.oldPassword).toBeTruthy();
  });

  it('invents no strength rule the server does not enforce', () => {
    // A short password the server may well accept must not be refused here:
    // rejecting one that would have worked is the worse failure.
    expect(
      validatePassword({ oldPassword: 'a', newPassword: 'b', confirmNewPassword: 'b' }).ok,
    ).toBe(true);
  });
});

describe('profileChanged', () => {
  it('ignores whitespace-only edits, which the payload trims away anyway', () => {
    expect(
      profileChanged({ firstName: 'Demo', lastName: 'Learner' }, {
        firstName: ' Demo ',
        lastName: 'Learner',
      }),
    ).toBe(false);
  });

  it('sees a real edit', () => {
    expect(
      profileChanged({ firstName: 'Demo', lastName: 'Learner' }, {
        firstName: 'Dema',
        lastName: 'Learner',
      }),
    ).toBe(true);
  });

  it('treats filling in a missing name as a change', () => {
    expect(
      profileChanged({ firstName: null, lastName: null }, {
        firstName: 'Demo',
        lastName: '',
      }),
    ).toBe(true);
  });
});

describe('photoRejectionReason', () => {
  it('accepts an image within the limit', () => {
    expect(photoRejectionReason({ type: 'image/png', size: 1024 })).toBeNull();
  });

  it('refuses a file that is not an image before spending an upload', () => {
    expect(photoRejectionReason({ type: 'application/pdf', size: 1024 })).toBe(
      'Choose an image file.',
    );
  });

  it('refuses one over the size limit', () => {
    expect(photoRejectionReason({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 })).toBe(
      'Choose an image under 5 MB.',
    );
    expect(photoRejectionReason({ type: 'image/png', size: MAX_PHOTO_BYTES })).toBeNull();
  });
});
