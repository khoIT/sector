import Player from '@vimeo/player';
import { useEffect, useRef, type RefObject } from 'react';

/**
 * Detects a `player.vimeo.com` iframe inside rendered topic content and
 * reports the learner's playhead as it moves.
 *
 * It reports seconds observed and nothing else. It used to call back on
 * `ended` alone, and the caller turned that into `videoCompleted: true` — a
 * completion the browser asserted and the server took on trust. Completion is
 * now decided server-side from the marks these reports leave behind, so there
 * is no "fire once" state here any more: every event is just another position.
 *
 * `RichText`'s sanitiser (`packages/ui/src/components/sanitize-rich-text.ts`)
 * only ever allows a `player.vimeo.com` iframe with
 * `sandbox="allow-scripts allow-same-origin allow-presentation"`, which is
 * exactly what the Vimeo Player postMessage bridge needs to run.
 */
export function useVimeoWatchTracking(
  containerRef: RefObject<HTMLElement | null>,
  html: string | null | undefined,
  onPosition: (seconds: number, options?: { force?: boolean }) => void,
): void {
  // Stored in a ref so a new callback closure on every render (the common
  // case for an inline arrow function) never tears down and re-attaches the
  // player — only a real change of container/content should do that.
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  useEffect(() => {
    const container = containerRef.current;
    const iframe = container?.querySelector<HTMLIFrameElement>('iframe[src*="player.vimeo.com"]');
    if (!iframe) return;

    const player = new Player(iframe);

    // `timeupdate` fires several times a second; the throttle in
    // `watch-position.ts` decides which of those earns a request.
    const handleTimeUpdate = (data: { seconds: number }) => {
      onPositionRef.current(data.seconds);
    };
    // A pause, a seek or the end of the video are each a moment worth
    // recording exactly, rather than up to twelve seconds later.
    const handleSettled = (data: { seconds: number }) => {
      onPositionRef.current(data.seconds, { force: true });
    };

    player.on('timeupdate', handleTimeUpdate);
    player.on('pause', handleSettled);
    player.on('seeked', handleSettled);
    player.on('ended', handleSettled);

    return () => {
      player.off('timeupdate', handleTimeUpdate);
      player.off('pause', handleSettled);
      player.off('seeked', handleSettled);
      player.off('ended', handleSettled);
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
    // `onPositionRef` is read via `.current`, never itself, so it is
    // deliberately not listed.
  }, [containerRef, html]);
}
