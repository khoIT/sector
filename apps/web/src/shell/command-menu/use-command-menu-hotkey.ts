import { useEffect } from 'react';

import { isEditableTarget } from '@/lib/editable-target';

/**
 * ⌘K / Ctrl-K, anywhere in the authenticated shell.
 *
 * Only this one combination, and never a bare letter: a single-key shortcut
 * on a page full of text fields is a shortcut that fires while somebody is
 * writing a clinical note. For the same reason it stands down inside an
 * editable field, where the browser or the OS may already own the chord.
 */
export function useCommandMenuHotkey(onOpen: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k') return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (isEditableTarget(event.target as HTMLElement | null)) return;

      event.preventDefault();
      onOpen();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onOpen]);
}
