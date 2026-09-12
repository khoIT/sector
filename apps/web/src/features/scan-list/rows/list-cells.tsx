import {
  SCAN_STATUS_LABEL,
  scanStatusTone,
  userDisplayName,
  type MediaFile,
  type ScanFinding,
  type ScanGroupRef,
  type ScanStatus,
  type ScanTypeRef,
  type UserBasic,
} from '@scanvault/api-client';
import { Badge, StatusPill, cn } from '@scanvault/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDate, formatDateTime } from '@/lib/format';

import { formatWaiting, waitingTone } from '../table/waiting-time';
import { groupDisplayName } from './group-list';
import { rubricVersionLabel, rubricVersionTitle } from './rubric-version';
import {
  formatFindingCount,
  gapFindingTitle,
  summariseFindings,
} from './scan-finding-summary';
import { ScanGroupsDialog } from './scan-groups-dialog';
import { formatMediaSummary, summariseMedia } from './scan-media-summary';
import { OUTCOME_LABEL, type ScanOutcome } from './scan-outcome';
import { displayTags, isMissingFiles, missingFilesTitle } from './scan-tags';

/** A dim separator between two facts that belong to the same group. */
function Dot() {
  return <span aria-hidden>·</span>;
}

/**
 * Title + the details that stop a reviewer having to open the scan to identify it.
 *
 * The file ratio lives here and nowhere else. It used to be printed twice — once
 * on this line and once in a Files column two cells to the right — and that
 * column could neither sort nor filter, so it carried no fact this line does
 * not. What it did carry was the warning tone on a short count, which moved
 * here with it.
 *
 * Everything below the title sits on ONE wrapping row rather than stacking into
 * separate lines: counts first as a single group, then the identifier, then the
 * chips. A queue row is already the tallest thing on the page and the budget for
 * this cell was one line, so the facts wrap into a second only on narrow
 * viewports, where the table is scrolling anyway.
 */
export function TitleCell({
  title,
  to,
  scanIdentifier,
  fileCount,
  fileTotal,
  tags,
  files,
  findings,
  hasNotes = false,
}: {
  title: string;
  to: string;
  scanIdentifier?: string | null;
  fileCount: number;
  fileTotal: number;
  tags?: string[];
  files?: readonly MediaFile[] | null;
  findings?: readonly ScanFinding[] | null;
  /** The learner left a question on the scan. 41% of a queue does. */
  hasNotes?: boolean;
}) {
  const media = formatMediaSummary(summariseMedia(files));
  const findingSummary = summariseFindings(findings);
  const findingCount = formatFindingCount(findingSummary);

  return (
    <div className="flex min-w-[12rem] flex-col gap-0.5">
      <Link
        to={to}
        className="font-medium text-accent-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-ink"
      >
        {title}
      </Link>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-dim">
        <span className="sv-num inline-flex items-center gap-1 whitespace-nowrap">
          <span
            className={cn(isMissingFiles(fileCount, fileTotal) && 'text-warn')}
            title={missingFilesTitle(fileCount, fileTotal)}
          >
            {fileCount}/{fileTotal} files
          </span>

          {/* Eight clips is a fifteen-minute review and two stills is ninety
              seconds; the ratio alone prices them the same. */}
          {media ? (
            <>
              <Dot />
              <span>{media}</span>
            </>
          ) : null}

          {findingCount ? (
            <>
              <Dot />
              <span>{findingCount}</span>
            </>
          ) : null}
        </span>

        {scanIdentifier ? <span className="truncate">ID {scanIdentifier}</span> : null}

        {/* Someone is waiting on an answer, and nothing said so until the scan
            was opened. */}
        {hasNotes ? <Badge tone="accent">Asked</Badge> : null}

        {findingSummary.gaps > 0 ? (
          <Badge tone="warn" title={gapFindingTitle(findingSummary)}>
            {findingSummary.gaps} not examined
          </Badge>
        ) : null}

        {displayTags(tags).map((tag) => (
          <Badge key={tag.id} tone="neutral">
            {tag.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * The scan type, and which generation of its rubric this scan answers.
 *
 * Six versions are live in the queue at once and they all print the same name,
 * so the version is the half that says which set of questions the reviewer is
 * about to be asked. Dim and inline: it qualifies the name, it does not warn.
 */
export function ScanTypeCell({ scanType }: { scanType: ScanTypeRef }) {
  const version = rubricVersionLabel(scanType);

  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap text-ink">
      {scanType.name}
      {version ? (
        <span className="sv-num text-[11px] text-ink-dim" title={rubricVersionTitle(scanType)}>
          {version}
        </span>
      ) : null}
    </span>
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

const OUTCOME_TONE = {
  achieved: 'ok',
  'not-achieved': 'crit',
  'no-outcome': 'neutral',
} as const;

/**
 * What a learner's own scan came back as, in the column that used to say
 * "Reviewed".
 *
 * 3,294 of 15,579 reviews did not achieve competency and every one of them read
 * as the same word as the ones that did. The pill now answers the question the
 * learner has, and the line under it answers the next one — how long it took —
 * which the reviewed lists otherwise leave as a subtraction between two columns.
 */
export function OutcomeCell({ outcome, status }: { outcome: ScanOutcome; status: ScanStatus }) {
  if (outcome.kind === 'status') return <StatusCell status={status} />;

  if (outcome.kind === 'failed') {
    return (
      <div className="flex min-w-[8rem] flex-col items-start gap-0.5">
        <StatusCell status={status} />
        {/* Written by the ingest worker since the day that shipped. The person
            whose upload failed has never been told why. */}
        {outcome.error ? (
          <span className="max-w-[16rem] text-[11px] leading-4 text-ink-dim" title={outcome.error}>
            {outcome.error}
          </span>
        ) : null}
      </div>
    );
  }

  const turnaround = outcome.turnaroundMs === null ? null : formatWaiting(outcome.turnaroundMs);

  return (
    <div className="flex min-w-[8rem] flex-col items-start gap-0.5">
      <StatusPill
        tone={OUTCOME_TONE[outcome.kind]}
        label={OUTCOME_LABEL[outcome.kind]}
        title={
          outcome.kind === 'no-outcome'
            ? 'Reviewed, but no competency outcome was recorded'
            : undefined
        }
      />

      {outcome.reviewedAt ? (
        <span
          className="sv-num whitespace-nowrap text-[11px] text-ink-dim"
          title={
            turnaround
              ? `Reviewed ${formatDateTime(outcome.reviewedAt)}, ${turnaround} after submission`
              : `Reviewed ${formatDateTime(outcome.reviewedAt)}`
          }
        >
          {formatDate(outcome.reviewedAt)}
          {turnaround ? (
            <>
              {' '}
              <Dot /> {turnaround}
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The first group, and a way into the rest.
 *
 * The `+N` badge is a button rather than a tooltip because N is not small:
 * a third of scans belong to more than one group and the largest belongs to
 * 705. A title attribute holding 705 comma-separated names is not an
 * expansion of the count, it is a way of appearing to offer one.
 */
export function GroupsCell({ groups, scanTitle }: { groups: ScanGroupRef[]; scanTitle: string }) {
  const [open, setOpen] = useState(false);

  if (groups.length === 0) return <span className="text-ink-dim">—</span>;

  const [first, ...rest] = groups;

  const firstName = first ? groupDisplayName(first) : '';

  return (
    <>
      <div className="flex min-w-[10rem] items-center gap-1">
        {/* A single group has no +N button, so its name needs the tooltip the
            truncation would otherwise swallow. */}
        <span className="truncate text-ink" title={firstName}>
          {firstName}
        </span>

        {rest.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Show all ${groups.length} groups for ${scanTitle}`}
            className={cn(
              'shrink-0 rounded-full border border-line bg-surface-2 px-2 py-0.5',
              'sv-num text-[11px] font-medium leading-4 text-ink-dim outline-none transition-colors',
              'hover:border-accent-ink/30 hover:text-accent-ink',
              'focus-visible:ring-2 focus-visible:ring-accent-ink',
            )}
          >
            +{rest.length}
          </button>
        ) : null}
      </div>

      {/*
        Mounted on `open`, NOT inside the `rest.length` branch. The list polls
        every 5s while a scan is processing; a refetch that drops this scan to
        one group would unmount an open dialog with its state still true, and
        the next refetch would reopen it over the table on its own.
      */}
      {open ? (
        <ScanGroupsDialog
          groups={groups}
          scanTitle={scanTitle}
          open
          onOpenChange={setOpen}
        />
      ) : null}
    </>
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
