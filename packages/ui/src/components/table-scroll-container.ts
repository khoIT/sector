/**
 * The class string for the box a `<Table>` scrolls inside.
 *
 * `relative` looks redundant here and is not. A table wider than its column
 * holds `sr-only` labels, and Tailwind's `sr-only` is `position: absolute`.
 * An absolutely positioned element is clipped by an ancestor's `overflow`
 * ONLY when that ancestor is also its containing block — and a `static`
 * scroll container is not one. Those labels therefore escaped the scroller,
 * took their position from the shell's `relative` wrapper instead, and landed
 * at the far edge of the table's own width.
 *
 * The result was a page that scrolled sideways bodily: on a 390px phone the
 * reviewed group queue dragged the document 966px, taking the navigation and
 * the tab strip off screen with it. The table was innocent — it scrolled
 * inside its box exactly as designed, and every element's box measured
 * correctly, which is why reading the markup could not find this. `relative`
 * makes the scroller the containing block, so the labels stay inside it.
 *
 * Extracted as a constant so the reason survives: a future reader deleting a
 * "redundant" `relative` from JSX would reintroduce a bug whose symptom is
 * three components away from its cause.
 */
export const TABLE_SCROLL_CONTAINER_CLASS = 'relative w-full overflow-x-auto';
