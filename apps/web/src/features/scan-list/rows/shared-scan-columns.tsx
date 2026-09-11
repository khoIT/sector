import { SHARED_SCAN_STATUS_LABEL, type SharedScanListItem } from '@scanvault/api-client';
import { StatusPill } from '@scanvault/ui';

import { sharedScanDetailPathFor } from '@/features/scan-detail/scan-detail-links';

import type { ListColumn } from '../table/column-model';
import { formatDate } from '@/lib/format';
import { DateCell, FilesCell, StatusCell, TitleCell, UserCell } from './list-cells';
import { OpenScanAction } from './row-actions';

export type SharedScanColumnContext = {
  returnUrl: string;
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
}: SharedScanColumnContext): Array<ListColumn<SharedScanListItem>> {
  return [
    {
      id: 'details',
      header: 'Details',
      alwaysVisible: true,
      cell: (share) => (
        <TitleCell
          title={share.scan.title}
          // Shares are opened through the share record, not the scan: the
          // recipient may have no permission on the scan itself.
          to={sharedScanDetailPathFor(share.id, returnUrl)}
          scanIdentifier={share.scan.scanIdentifier}
          fileCount={share.scan.fileCount}
          fileTotal={share.scan.fileTotal}
          tags={share.scan.tags}
        />
      ),
    },
    {
      id: 'scanType',
      header: 'Scan type',
      cell: (share) => (
        <span className="whitespace-nowrap text-ink">{share.scan.scanType.name}</span>
      ),
    },
    {
      id: 'sharedBy',
      header: 'Shared by',
      cell: (share) => <UserCell user={share.sharedBy} />,
    },
    {
      id: 'shareStatus',
      header: 'Share',
      cell: (share) => (
        <StatusPill
          tone={share.status === 'opened' ? 'ok' : 'accent'}
          label={SHARED_SCAN_STATUS_LABEL[share.status]}
        />
      ),
    },
    {
      id: 'scanStatus',
      header: 'Scan status',
      cell: (share) => <StatusCell status={share.scan.status} />,
    },
    {
      id: 'files',
      header: 'Files',
      numeric: true,
      defaultHidden: true,
      cell: (share) => (
        <FilesCell fileCount={share.scan.fileCount} fileTotal={share.scan.fileTotal} />
      ),
    },
    {
      id: 'createdAt',
      header: 'Shared',
      sortField: 'createdAt',
      numeric: true,
      cell: (share) => <DateCell iso={share.createdAt} format={formatDate} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      alwaysVisible: true,
      className: 'text-right',
      cell: (share) => (
        <div className="flex justify-end">
          <OpenScanAction to={sharedScanDetailPathFor(share.id, returnUrl)} />
        </div>
      ),
    },
  ];
}
