import { describe, expect, it } from 'vitest';

import { shouldActivateRow } from './row-activation';

/** A stand-in for a clicked element: `closest` is all the rule reads. */
function element(matches: string[] = []) {
  return {
    closest(selector: string) {
      return selector.split(',').some((part) => matches.includes(part.trim())) ? {} : null;
    },
  };
}

describe('shouldActivateRow', () => {
  it('opens the row for a click on plain cell text', () => {
    expect(shouldActivateRow({ target: element() })).toBe(true);
  });

  it('stands aside for the controls a row already has', () => {
    // Opening a row menu must not also navigate, and ticking a checkbox must
    // not open a scan.
    for (const tag of ['a', 'button', 'input', '[role="menuitem"]', '[data-interactive]']) {
      expect(shouldActivateRow({ target: element([tag]) })).toBe(false);
    }
  });

  it('does not navigate on the click that ends a text selection', () => {
    // Dragging across a scan identifier to copy it ends in a click; opening
    // the row there throws away what the user was doing.
    expect(shouldActivateRow({ target: element(), selectedText: 'SC-0042' })).toBe(false);
  });

  it('ignores a selection of only whitespace', () => {
    expect(shouldActivateRow({ target: element(), selectedText: '   ' })).toBe(true);
  });

  it('does nothing without a target', () => {
    expect(shouldActivateRow({ target: null })).toBe(false);
  });
});
