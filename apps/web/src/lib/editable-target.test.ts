import { describe, expect, it } from 'vitest';

import { isEditableTarget } from './editable-target';

describe('isEditableTarget', () => {
  it('stands down inside the fields people type into', () => {
    // A clinical note is the reason: a shortcut that fires mid-sentence is
    // worse than one the reviewer has to reach for.
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'input', 'textarea']) {
      expect(isEditableTarget({ tagName })).toBe(true);
    }
  });

  it('stands down inside a contenteditable region', () => {
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('fires everywhere else', () => {
    expect(isEditableTarget({ tagName: 'DIV' })).toBe(false);
    expect(isEditableTarget({ tagName: 'BODY' })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });
});
