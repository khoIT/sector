import { describe, expect, it } from 'vitest';

import { drawerContentClass } from './drawer-position';

describe('drawerContentClass', () => {
  it('pins to the right edge', () => {
    expect(drawerContentClass('right')).toContain('right-0');
    expect(drawerContentClass('right')).not.toContain('left-0');
  });

  it('pins to the left edge', () => {
    expect(drawerContentClass('left')).toContain('left-0');
    expect(drawerContentClass('left')).not.toContain('right-0');
  });
});
