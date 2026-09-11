import {
  SCAN_STATUS_LABEL,
  scanStatusTone,
  userDisplayName,
  type ScanGroupRef,
  type ScanStatus,
  type UserBasic,
} from '@scanvault/api-client';
import { Badge, StatusPill, cn } from '@scanvault/ui';
import { Link } from 'react-router-dom';

import { formatDate, formatDateTime } from '@/lib/format';

import { formatWaiting, waitingTone } from '../table/waiting-time';

/** Title + the details that stop a reviewer having to open the scan to identify it. */
export function TitleCell({
  title,
  to,
  scanIdentifier,
  fileCount,
  fileTotal,
  tags,
}: {
  title: string;
  to: string;
  scanIdentifier?: string | null;
  fileCount: number;
  fileTotal: number;
  tags?: string[];
}) {
  return (
    <div className="flex min-w-[12rem] flex-col gap-0.5">
      <Link
        to={to}
        className="font-medium text-accent-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
      >
        {title}
      </Link>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-dim">
        <span className="sv-num">
          {fileCount}/{fileTotal} files
        </span>
        {scanIdentifier ? <span className="truncate">ID {scanIdentifier}</span> : null}
        {(tags ?? []).map((tag) => (
          <Badge key={tag} tone={tag === 'incomplete' ? 'warn' : 'neutral'}>
            {tag.replace(/_/g, ' ')}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function UserCell({ user }: { user: UserBasic }) {
  return (
    <div className="flex min-w-[9rem] flex-col">
      <span className="text-ink">{userDisplayName(user)}</span>
      <span className="truncate text-[11px] text-ink-dim">{user.email}</span>
    </div>
  );
}

export function StatusCell({ status }: { status: ScanStatus }) {
  return <StatusPill tone={scanStatusTone(status)} label={SCAN_STATUS_LABEL[status]} />;
}

/**
 * Uploaded vs expected files. A short count is the single best predictor that
 * a scan cannot be assessed, so it is called out in warn rather than left for
 * the reviewer to notice after opening it.
 */
export function FilesCell({ fileCount, fileTotal }: { fileCount: number; fileTotal: number }) {
  const short = fileTotal > 0 && fileCount < fileTotal;
  return (
    <span className={cn('sv-num', short ? 'text-warn' : 'text-ink')}>
      {fileCount}/{fileTotal}
    </span>
  );
}

export function GroupsCell({ groups }: { groups: ScanGroupRef[] }) {
  if (groups.length === 0) return <span className="text-ink-dim">—</span>;

  const [first, ...rest] = groups;
  return (
    <div
      className="flex min-w-[10rem] items-center gap-1"
      title={groups.map((group) => group.name).join(', ')}
    >
      <span className="truncate text-ink">{first?.name}</span>
      {rest.length > 0 ? (
        <Badge tone="neutral" className="sv-num shrink-0">
          +{rest.length}
        </Badge>
      ) : null}
    </div>
  );
}

export function DateCell({
  iso,
  format,
}: {
  iso: string | null | undefined;
  format: (v: string | null | undefined) => string;
}) {
  return (
    <span className="sv-num whitespace-nowrap text-ink" title={formatDateTime(iso)}>
      {format(iso)}
    </span>
  );
}

/**
 * Time in the queue, the number a reviewer triages on, over the submission
 * date it is measured from.
 *
 * The elapsed time answers "how bad is this" and the date answers "what else
 * was happening then" — a reviewer reconciling a queue against a teaching
 * block or a cohort's due date needs the second, and should not have to hover
 * every row to get it. Both come from one timestamp, so they live in one
 * column rather than costing the table a second one.
 */
export function WaitingCell({ submittedAt, now }: { submittedAt: string; now: number }) {
  const elapsed = Math.max(0, now - Date.parse(submittedAt));
  const tone = waitingTone(elapsed);

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      title={`Submitted ${formatDateTime(submittedAt)}`}
    >
      <StatusPill
        tone={tone}
        dot={tone !== 'neutral'}
        label={<span className="sv-num">{formatWaiting(elapsed)}</span>}
      />
      <span className="sv-num whitespace-nowrap text-[11px] text-ink-dim">
        {formatDate(submittedAt)}
      </span>
    </div>
  );
}

export function ReviewedByCell({ user }: { user: UserBasic | null | undefined }) {
  if (!user) return <span className="text-ink-dim">—</span>;
  return <span className="text-ink">{userDisplayName(user)}</span>;
}
