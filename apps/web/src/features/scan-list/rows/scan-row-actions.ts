import type { ScanVaultView } from '../scan-list-views';

/**
 * Which actions a row offers, by surface.
 *
 * Read off the legacy dashboard, which ships one `data-table-row-actions.tsx`
 * per view — six near-copies whose contents had already drifted apart. Here it
 * is one table, so a rule can be read rather than diffed.
 *
 *   view            open  share  download  comment  delete
 *   my               y      y       y         y       y
 *   pending          y      y       y         y       y*
 *   reviewed         y      y       y         y       y*
 *   shared           y      -       y         y       -
 *   expert           y      y       y         y       -
 *   expert-reviewed  y      y       y         y       y*
 *
 * `y*` marks where this app deliberately differs. Legacy offers Delete on the
 * queues and the reviewed lists — surfaces made of OTHER people's scans — and
 * checks nothing before showing it. Two facts make that unsafe to copy:
 * `delete:scan` is held by every role in the database, and the server's
 * delete handler never compares the scan's owner to the caller. So the
 * permission gates nobody and the ownership gate has to live here.
 *
 * Shared Scans is the recipient's view of someone else's scan: no share (the
 * recipient is not the sharer) and no delete (it is not their scan).
 *
 * Four legacy row actions are deliberately NOT here, so the table above is the
 * whole story only for these five:
 *
 *   Logs             lives on the scan page as `scan-activity-log.tsx`
 *   Reset upload     a recovery tool; belongs with the scan, not a list row
 *   Expert review    not built in this app yet
 *   Review generator one of the AI surfaces still open in the parity audit
 */

export type RowActionId = 'open' | 'share' | 'download' | 'comment' | 'delete';

export type RowActionContext = {
  view: ScanVaultView;
  /** True when the signed-in user submitted this scan. */
  isOwnScan: boolean;
  /** The scan has at least one file with a URL to fetch. */
  hasFiles: boolean;
  canReadNotes: boolean;
  canDelete: boolean;
};

/** Actions the surface offers at all, before any per-user gate. */
function actionsForView(view: ScanVaultView): RowActionId[] {
  if (view === 'shared') return ['open', 'download', 'comment'];
  return ['open', 'share', 'download', 'comment', 'delete'];
}

export function rowActionsFor(context: RowActionContext): RowActionId[] {
  const { view, isOwnScan, canReadNotes, canDelete } = context;

  return actionsForView(view).filter((action) => {
    if (action === 'comment') return canReadNotes;
    // Never on a scan the user does not own: see the note above.
    if (action === 'delete') return isOwnScan && canDelete;
    return true;
  });
}

/**
 * Download stays listed but disabled on a scan with nothing to fetch, rather
 * than disappearing — a row with 0/4 files is exactly the row where someone
 * looks for the download and needs to learn why there is not one.
 */
export function isRowActionDisabled(
  action: RowActionId,
  context: Pick<RowActionContext, 'hasFiles'>,
): boolean {
  return action === 'download' && !context.hasFiles;
}
