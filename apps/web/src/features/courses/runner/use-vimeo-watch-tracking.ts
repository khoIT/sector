import Player from '@vimeo/player';
import { useEffect, useRef, type RefObject } from 'react';

/**
 * Detects a `player.vimeo.com` iframe inside rendered topic content and
 * writes the learner's watch position back through `onEnded` — the only
 * video signal the API's progress model carries (`hasVideo`/`videoCompleted`
 * booleans, not a numeric position; see `topic-view.tsx`'s doc comment).
 *
 * `RichText`'s sanitiser (`packages/ui/src/components/sanitize-rich-text.ts`)
 * only ever allows a `player.vimeo.com` iframe with
 * `sandbox="allow-scripts allow-same-origin allow-presentation"`, which is
 * exactly what the Vimeo Player postMessage bridge needs to run.
 */
export function useVimeoWatchTracking(
  containerRef: RefObject<HTMLElement | null>,
  html: string | null | undefined,
  onEnded: () => void,
): void {
  // Stored in a ref so a new `onEnded` closure on every render (the common
  // case for an inline arrow function) never tears down and re-attaches the
  // player — only a real change of container/content should do that.
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const container = containerRef.current;
    const iframe = container?.querySelector<HTMLIFrameElement>('iframe[src*="player.vimeo.com"]');
    if (!iframe) return;

    const player = new Player(iframe);
    const handleEnded = () => onEndedRef.current();
    player.on('ended', handleEnded);

    return () => {
      player.off('ended', handleEnded);
      // `.destroy()` returns a promise the Vimeo SDK rejects if the iframe
      // was already removed from the DOM (a route change unmounting this
      // component); swallow it — there is nothing this caller can do about
      // a teardown race, and an unhandled rejection here would just be
      // console noise on every ordinary navigation away from a video topic.
      void player.destroy().catch(() => undefined);
    };
    // Re-run whenever the rendered content changes (a different topic's
    // body swapped in without unmounting this component — depth-first
    // client-side navigation between two video topics can do exactly that).
    // `onEndedRef` is read via `.current`, never itself, so it is
    // deliberately not listed.
  }, [containerRef, html]);
}
