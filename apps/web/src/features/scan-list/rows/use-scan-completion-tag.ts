import { useAddScanTag, useRemoveScanTag } from '@sector/api-client';

import { completionTagMutation, type CompletionTag } from './scan-tags';

/**
 * Set a scan's completeness, enforcing client-side what the server does not.
 *
 * `scanService.addTag` writes with `$push`, not `$addToSet` or a replace, so
 * the two completeness tags are only ever mutually exclusive because this
 * hook makes them so: it removes the opposite tag (when present) before, or
 * without, adding the new one, and skips the add entirely when the scan
 * already carries it.
 *
 * `setCompletion` RESOLVES on failure rather than rejecting, and reports it
 * through `error` instead. Both call sites fire it from an onClick, where a
 * rejected promise is an unhandled rejection and nothing on screen — a
 * reviewer's write could fail and they would believe it landed. The state a
 * caller needs to render is on the returned object, so a caller that ignores
 * the result still cannot lose the failure silently.
 */
export function useSetScanCompletionTag() {
  const addTag = useAddScanTag();
  const removeTag = useRemoveScanTag();

  async function setCompletion(
    scanId: string,
    currentTags: readonly string[],
    next: CompletionTag,
  ): Promise<void> {
    const mutation = completionTagMutation(currentTags, next);
    try {
      // The removal goes first: if only the add succeeds and this call is
      // retried, a second attempt sees the tag already there and correctly
      // no-ops it, rather than risking two additions landing before a removal.
      // A failed removal skips the add for the same reason — the alternative
      // leaves both tags on one scan.
      if (mutation.remove) await removeTag.mutateAsync({ scanId, tag: mutation.remove });
      if (mutation.add) await addTag.mutateAsync({ scanId, tag: mutation.add });
    } catch {
      // Surfaced through `error` below; see the note above.
    }
  }

  return {
    setCompletion,
    isPending: addTag.isPending || removeTag.isPending,
    error: addTag.error ?? removeTag.error,
    /** Dismiss a reported failure, so the next attempt starts clean. */
    reset: () => {
      addTag.reset();
      removeTag.reset();
    },
  };
}
