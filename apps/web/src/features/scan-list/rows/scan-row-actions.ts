import type { ScanStatus } from '@sector/api-client';

import type { ScanVaultView } from '../scan-list-views';
import { COMPLETE_TAG, INCOMPLETE_TAG } from './scan-tags';

/**
 * Which actions a row offers, by surface.
 *
 * Read off the legacy dashboard, which ships one `data-table-row-actions.tsx`
 * per view — six near-copies whose contents had already drifted apart. Here it
 * is one table, so a rule can be read rather than diffed.
 *
 *   view            open  share  download  comment  delete  reset  expert  complete/incomplete
 *   my               y      y       y         y       y*      y*      y*      -
 *   pending          y      y       y         y       y*      -       -       y*
 *   reviewed         y      y       y         y       y*      -       -       y*
 *   shared           y      -       y         y       -       -       -       -
 *   expert           y      y       y         y       -       -       -       y*
 *   expert-reviewed  y      y       y         y       y*      -       -       y*
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
 * Reset-upload and request-expert-review are owner actions, so they only ever
 * appear on My Scans (`isOwnScan` is always true there — a row on someone
 * else's My Scans does not exist). Mark complete/incomplete is a REVIEWER
 * action, so it appears everywhere else a reviewer looks at someone else's
 * scan and never on My Scans or Shared Scans, gated on `edit:scan` — the same
 * permission the server's tag routes require.
 *
 * Two legacy row actions are deliberately still not here:
 *
 *   Logs             lives on the scan page as `scan-activity-log.tsx`
 *   Review generator one of the AI surfaces still open in the parity audit
 */

export type RowActionId =
  | 'open'
  | 'share'
  | 'download'
  | 'comment'
  | 'delete'
  | 'reset-upload'
  | 'request-expert-review'
  | 'mark-complete'
  | 'mark-incomplete';

export type RowActionContext = {
  view: ScanVaultView;
  /** True when the signed-in user submitted this scan. */
  isOwnScan: boolean;
  /** The scan has at least one file with a URL to fetch. */
  hasFiles: boolean;
  canReadNotes: boolean;
  canDelete: boolean;
  /** Holds `edit:scan` — gates the two completeness actions. */
  canEditScan: boolean;
  status: ScanStatus;
  tags: readonly string[];
};

/** Actions the surface offers at all, before any per-user gate. */
function actionsForView(view: ScanVaultView): RowActionId[] {
  if (view === 'shared') return ['open', 'download', 'comment'];
  if (view === 'my') {
    return [
      'open',
      'share',
      'download',
      'comment',
      'reset-upload',
      'request-expert-review',
      'delete',
    ];
  }
  return ['open', 'share', 'download', 'comment', 'mark-complete', 'mark-incomplete', 'delete'];
}

/** Statuses `PUT /api/scan/:id/reset-upload` actually accepts (scan-reset.controller.ts). */
export const RESETTABLE_STATUSES: ReadonlySet<ScanStatus> = new Set(['failed', 'failed_upload']);

export function rowActionsFor(context: RowActionContext): RowActionId[] {
  const { view, isOwnScan, canReadNotes, canDelete, canEditScan, status, tags } = context;
  const normalizedTags = new Set(tags.map((tag) => tag.trim().toLowerCase()));

  return actionsForView(view).filter((action) => {
    if (action === 'comment') return canReadNotes;
    // Never on a scan the user does not own: see the note above.
    if (action === 'delete') return isOwnScan && canDelete;
    if (action === 'reset-upload') return isOwnScan && RESETTABLE_STATUSES.has(status);
    if (action === 'request-expert-review') return isOwnScan;
    if (action === 'mark-complete') return canEditScan && !normalizedTags.has(COMPLETE_TAG);
    if (action === 'mark-incomplete') return canEditScan && !normalizedTags.has(INCOMPLETE_TAG);
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
