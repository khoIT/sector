/**
 * Whether a keystroke was aimed at something the user is typing into.
 *
 * Shared by every global hotkey in the app — ⌘K for the command menu, j/k for
 * the review queue. A shortcut that fires while somebody is writing a clinical
 * note is worse than one they have to reach for, and each hotkey deciding that
 * for itself is how one of them ends up not deciding it.
 *
 * Takes a plain shape rather than an `EventTarget` so the rule is testable in
 * the node environment the suites run in: there is no DOM there to build an
 * `<input>` in.
 */
export function isEditableTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Whether a modal is on screen.
 *
 * A global hotkey must stand down while one is open: the dialog owns the
 * keyboard, and stepping the queue out from under a confirmation the reviewer
 * is reading is the kind of bug nobody reports because nobody believes it.
 */
export function hasOpenDialog(): boolean {
  return document.querySelector('[role="dialog"],[role="alertdialog"]') !== null;
}
