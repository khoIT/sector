import type { AuthUser, Scan, ScanListView } from '@sector/api-client';
import { hasPermission } from '@sector/api-client';

import { scanDetailPathFor } from '@/features/scan-detail/scan-detail-links';

import { isReviewQueue, isReviewedList } from '../scan-list-views';
import type { ListColumn } from '../table/column-model';
import { formatDate } from '@/lib/format';
import {
  DateCell,
  GroupsCell,
  OutcomeCell,
  ReviewedByCell,
  ScanTypeCell,
  TitleCell,
  UserCell,
  WaitingCell,
} from './list-cells';
import { AssessAction, OpenScanAction } from './row-actions';
import { scanOutcome } from './scan-outcome';
import { ScanRowMenu } from './scan-row-menu';

export type ScanColumnContext = {
  view: ScanListView;
  /** Translator from the calling component, so this stays a pure factory. */
  t: (key: string, options?: Record<string, unknown>) => string;
  user: AuthUser | null;
  /** The list URL to come back to, carried into every row link. */
  returnUrl: string;
  /** Frozen "now" for the whole render, so every Waiting cell agrees. */
  now: number;
};

/**
 * Column sets for the five /api/scan/* views.
 *
 * They are one parameterised factory rather than five files: the legacy
 * dashboard shipped pending-scans and expert-scans as byte-identical column
 * files, and reviewed-scans and expert-reviewed-scans as another identical
 * pair, which is how their labels drifted apart ("Date Submitted" on one,
 * "Date Created" on its twin) without anyone noticing.
 */
export function scanColumns(context: ScanColumnContext): Array<ListColumn<Scan>> {
  const { view, user, returnUrl, now, t } = context;
  const queue = isReviewQueue(view);
  const reviewed = isReviewedList(view);
  const canReview = hasPermission(user, 'create:scan:review');

  const columns: Array<ListColumn<Scan>> = [
    {
      id: 'details',
      header: t('columns.details'),
      sortField: 'title',
      alwaysVisible: true,
      cell: (scan) => (
        <TitleCell
          title={scan.title}
          to={scanDetailPathFor(view, scan.id, returnUrl)}
          scanIdentifier={scan.scanIdentifier}
          fileCount={scan.fileCount}
          fileTotal={scan.fileTotal}
          tags={scan.tags}
          files={scan.files}
          findings={scan.findings}
          hasNotes={scan.notes.length > 0}
        />
      ),
    },
  ];

  // The learner's name only means something on a list of OTHER people's scans.
  if (view !== 'my') {
    columns.push({
      id: 'learner',
      header: t('columns.learner'),
      sortField: 'firstName',
      cell: (scan) => <UserCell user={scan.user} />,
    });
  }

  columns.push({
    id: 'scanType',
    header: t('columns.scanType'),
    sortField: 'scanType',
    cell: (scan) => <ScanTypeCell scanType={scan.scanType} />,
  });

  // Every row on a queue is `submitted` and every row on a reviewed list is
  // `reviewed`, so a status column there would be one repeated word.
  //
  // On My Scans the same column had the opposite problem: "Reviewed" is what
  // the learner already knows, and whether they achieved competency — the
  // thing they opened the page for — was one field away on the same row.
  if (view === 'my') {
    columns.push({
      id: 'outcome',
      header: t('columns.outcome'),
      sortField: 'status',
      cell: (scan) => <OutcomeCell outcome={scanOutcome(scan)} status={scan.status} />,
    });
  }

  if (view !== 'my') {
    columns.push({
      id: 'groups',
      header: t('columns.groups'),
      cell: (scan) => <GroupsCell groups={scan.groups ?? []} scanTitle={scan.title} />,
    });
  }

  if (queue) {
    columns.push({
      id: 'waiting',
      header: t('columns.waiting'),
      // Longest waiting first is OLDEST first, so a descending click on this
      // column has to send `createdAt:asc`.
      sortField: 'createdAt',
      invertSort: true,
      numeric: true,
      cell: (scan) => <WaitingCell submittedAt={scan.createdAt} now={now} />,
    });
  }

  columns.push({
    id: 'createdAt',
    header: t('columns.submitted'),
    sortField: 'createdAt',
    numeric: true,
    // On a queue the Waiting column already carries this, with the exact
    // timestamp on hover. Available, just not on by default.
    defaultHidden: queue,
    cell: (scan) => <DateCell iso={scan.createdAt} format={formatDate} />,
  });

  if (reviewed) {
    columns.push(
      {
        id: 'reviewedAt',
        header: t('columns.reviewed'),
        sortField: 'reviewedAt',
        numeric: true,
        cell: (scan) => <DateCell iso={scan.reviewedAt} format={formatDate} />,
      },
      {
        id: 'reviewedBy',
        header: t('columns.reviewedBy'),
        cell: (scan) => <ReviewedByCell user={scan.review?.user} />,
      },
    );
  }

  // The primary action stays a visible button — on a queue it is the reason the
  // queue exists — and everything else sits behind the menu beside it.
  columns.push({
    id: 'actions',
    header: t('columns.actions'),
    alwaysVisible: true,
    className: 'text-right',
    cell: (scan) => {
      const to = scanDetailPathFor(view, scan.id, returnUrl);

      return (
        <div className="flex items-center justify-end gap-1">
          {queue ? (
            <AssessAction
              to={to}
              canReview={canReview}
              isOwnScan={Boolean(user) && scan.user.id === user?.id}
            />
          ) : (
            <OpenScanAction
              to={to}
              label={reviewed ? t('actions.openReview') : t('actions.open')}
            />
          )}

          <ScanRowMenu
            scanId={scan.id}
            scanTitle={scan.title}
            files={scan.files}
            ownerId={scan.user.id}
            view={view}
            user={user}
            to={to}
          />
        </div>
      );
    },
  });

  return columns;
}
