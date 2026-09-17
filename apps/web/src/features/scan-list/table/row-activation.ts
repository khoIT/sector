/**
 * Everything in a row that already does something when you click it.
 *
 * The row-wide click has to stand behind all of these, or opening a row menu
 * navigates instead, and ticking a checkbox opens a scan. `[data-interactive]`
 * is the escape hatch for a control that is none of these tags.
 */
const INTERACTIVE_SELECTOR =
  'a,button,input,select,textarea,label,summary,[role="button"],[role="menuitem"],[role="checkbox"],[data-interactive]';

export type RowActivationEvent = {
  /** The clicked element. Only `closest` is used, so a stub satisfies it. */
  target: { closest(selector: string): unknown } | null;
  /** `window.getSelection()?.toString()`, passed in so this stays pure. */
  selectedText?: string;
};

/**
 * Whether a click on a row should open it.
 *
 * Two things stop it. A click that landed on a control belongs to that
 * control — the row menu, the open button, the title link all handle
 * themselves. And a click that ENDS a text selection is the user finishing a
 * drag to copy an identifier, not asking to navigate; opening the row there
 * throws away what they were doing.
 */
export function shouldActivateRow({ target, selectedText = '' }: RowActivationEvent): boolean {
  if (selectedText.trim().length > 0) return false;
  if (!target) return false;

  return target.closest(INTERACTIVE_SELECTOR) === null;
}
