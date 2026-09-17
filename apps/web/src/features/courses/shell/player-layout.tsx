import { cn } from '@sector/ui';
import type { ReactNode } from 'react';

import { useMediaQuery } from '@/lib/use-media-query';

/**
 * The width at which a third column appears beside the video.
 *
 * `2xl`, not `xl`. At 1280 the contents pane (20rem) and the panel (24rem)
 * leave the video about 500px inside the app shell's own chrome, which is
 * smaller than the two-column layout gives it — a third column that shrinks
 * the thing it sits beside is a worse page, not a wider one.
 */
const PANEL_QUERY = '(min-width: 96rem)';

export type PlayerLayoutProps = {
  /** The contents pane. Hidden below `lg`, where it moves into a drawer. */
  contents: ReactNode;
  main: ReactNode;
  /**
   * Receives the panel column's element, or null when the viewport is too
   * narrow for one. The item view portals its tab panel into it.
   */
  onPanelSlotChange: (node: HTMLElement | null) => void;
};

/**
 * The player's columns: contents | video and title | panel.
 *
 * The panel column is MOUNTED rather than hidden with CSS. A `hidden xl:block`
 * slot still exists in the DOM at every width, so portalling into it below the
 * breakpoint would put the tabs inside a `display: none` box and lose them
 * entirely — the failure would look like "the Overview tab is empty on a
 * laptop", which is nowhere near its cause. Rendering the slot only when it is
 * real means `onPanelSlotChange(null)` fires on the way down, and the item
 * view renders its tabs inline instead.
 */
export function PlayerLayout({ contents, main, onPanelSlotChange }: PlayerLayoutProps) {
  const hasPanel = useMediaQuery(PANEL_QUERY);

  return (
    <div
      className={cn(
        // `items-start` only once this is a grid. In the column form below
        // `lg` it would size each child to its own max-content width instead
        // of the container's, which drags the document sideways on a phone.
        'flex flex-col gap-4',
        'lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start',
        hasPanel && '2xl:grid-cols-[20rem_minmax(0,1fr)_24rem]',
      )}
    >
      {/* Below `lg` the contents live in the drawer, so this column is not
          rendered at all rather than hidden — one list on the page, one
          place the learner's scroll position lives. */}
      <div className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        {contents}
      </div>

      {/* `min-w-0` is load-bearing: a grid track defaults to `min-content`,
          and a 16:9 Vimeo iframe's min-content is wider than the viewport. */}
      <div className="w-full min-w-0">{main}</div>

      {hasPanel ? (
        <div
          ref={onPanelSlotChange}
          className="sticky top-4 max-h-[calc(100vh-2rem)] w-full min-w-0 overflow-y-auto"
        />
      ) : null}
    </div>
  );
}
