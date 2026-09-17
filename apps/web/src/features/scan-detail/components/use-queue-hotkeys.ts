import { useEffect } from 'react';

import { hasOpenDialog, isEditableTarget } from '@/lib/editable-target';

/**
 * `j` / `k` to step a review queue, the way the legacy dashboard did.
 *
 * Bare letters, which is only safe because of the two guards: the keys stand
 * down inside anything editable — a reviewer types their assessment into a
 * textarea on this very page — and while any dialog is open, because a modal
 * owns the keyboard and stepping the queue out from under a confirmation is a
 * bug nobody reports because nobody believes it.
 *
 * A modifier held means the chord belongs to the browser or the OS, not here.
 */
export function useQueueHotkeys({
  onNext,
  onPrevious,
}: {
  onNext: () => void;
  onPrevious: () => void;
}): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'j' && event.key !== 'k') return;
      if (isEditableTarget(event.target as HTMLElement | null)) return;
      if (hasOpenDialog()) return;

      event.preventDefault();
      if (event.key === 'j') onNext();
      else onPrevious();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onNext, onPrevious]);
}
