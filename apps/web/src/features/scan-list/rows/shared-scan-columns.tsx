import {
  SHARED_SCAN_STATUS_LABEL,
  type AuthUser,
  type SharedScanListItem,
} from '@sector/api-client';
import { StatusPill } from '@sector/ui';

import { sharedScanDetailPathFor } from '@/features/scan-detail/scan-detail-links';

import type { ListColumn } from '../table/column-model';
import { formatDate } from '@/lib/format';
import {
  DateCell,
  RemovedStudyCell,
  ScanTypeCell,
  StatusCell,
  TitleCell,
  UserCell,
} from './list-cells';
import { OpenScanAction } from './row-actions';
import { ScanRowMenu } from './scan-row-menu';

export type SharedScanColumnContext = {
  returnUrl: string;
  /** Translator from the calling component, so this stays a pure factory. */
  t: (key: string, options?: Record<string, unknown>) => string;
  /** Needed by the row menu for the note permissions. */
  user: AuthUser | null;
};

/**
 * Columns for Shared Scans.
 *
 * Two status columns, deliberately. The legacy dashboard had ONE column called
 * "Status" that meant the share state (opened/unopened) under the new UI flag
 * and the scan's own lifecycle (submitted/reviewed/…) under the old one — the
 * same header, two unrelated answers, depending on a flag the user could not
 * see. Both facts matter here, so both get a column and a name.
 */
export function sharedScanColumns({
  returnUrl,
  user,
  t,
}: SharedScanColumnContext): Array<ListColumn<SharedScanListItem>> {
  return [
    {
      id: 'details',
      header: t('columns.details'),
      alwaysVisible: true,
      cell: (share) =>
        share.scan ? (
          <TitleCell
            title={share.scan.title}
            // Shares are opened through the share record, not the scan: the
            // recipient may have no permission on the scan itself.
            to={sharedScanDetailPathFor(share.id, returnUrl)}
            scanIdentifier={share.scan.scanIdentifier}
            fileCount={share.scan.fileCount}
            fileTotal={share.scan.fileTotal}
            tags={share.scan.tags}
            files={share.scan.files}
            // No findings or notes: the shared-scans mapper populates neither,
            // and the summary schema models only what this route really sends.
          />
        ) : (
          <RemovedStudyCell label={t('row.studyRemoved')} />
        ),
    },
    {
      id: 'scanType',
      header: t('columns.scanType'),
      cell: (share) => (share.scan ? <ScanTypeCell scanType={share.scan.scanType} /> : null),
    },
    {
      id: 'sharedBy',
      header: t('columns.sharedBy'),
      cell: (share) => <UserCell user={share.sharedBy} />,
    },
    {
      id: 'shareStatus',
      header: t('columns.share'),
      cell: (share) => (
        <StatusPill
          tone={share.status === 'opened' ? 'ok' : 'accent'}
          label={SHARED_SCAN_STATUS_LABEL[share.status]}
        />
      ),
    },
    {
      id: 'scanStatus',
      header: t('columns.scanStatus'),
      cell: (share) => (share.scan ? <StatusCell status={share.scan.status} /> : null),
    },
    {
      id: 'createdAt',
      header: t('columns.shared'),
      sortField: 'createdAt',
      numeric: true,
      cell: (share) => <DateCell iso={share.createdAt} format={formatDate} />,
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      alwaysVisible: true,
      className: 'text-right',
      cell: (share) =>
        share.scan ? (
          <div className="flex items-center justify-end gap-1">
            <OpenScanAction to={sharedScanDetailPathFor(share.id, returnUrl)} />
            <ScanRowMenu
              // The SCAN's id, not the share's: notes and downloads address the
              // scan. Only navigation goes through the share.
              scanId={share.scan.id}
              scanTitle={share.scan.title}
              files={share.scan.files}
              // The scan's own user. `sharedBy` is who sent it, which is a
              // different person the moment someone shares a scan they do not own.
              ownerId={share.scan.user.id}
              view="shared"
              user={user}
              to={sharedScanDetailPathFor(share.id, returnUrl)}
            />
          </div>
        ) : null,
    },
  ];
}
