import { describe, expect, it } from 'vitest';

import { TABLE_SCROLL_CONTAINER_CLASS } from './table-scroll-container';

describe('TABLE_SCROLL_CONTAINER_CLASS', () => {
  it('scrolls horizontally rather than widening the page', () => {
    expect(TABLE_SCROLL_CONTAINER_CLASS).toContain('overflow-x-auto');
  });

  it('is a containing block, so absolutely positioned labels cannot escape it', () => {
    // Not redundant styling. `sr-only` is `position: absolute`, and an
    // absolutely positioned element is clipped by an ancestor's overflow only
    // if that ancestor is its containing block. Without `relative` the labels
    // inside a wide table positioned against the shell instead and dragged the
    // whole document 966px sideways on a phone.
    expect(TABLE_SCROLL_CONTAINER_CLASS).toContain('relative');
  });

  it('fills its column', () => {
    expect(TABLE_SCROLL_CONTAINER_CLASS).toContain('w-full');
  });
});
