import type {
  FileDetail,
  MediaFile,
  ScanFinding,
  ScanFormResponse,
  ScanGroupRef,
  ScanLog,
  ScanStatus,
  ScanTypeRef,
  UserBasic,
} from '@scanvault/api-client';
import { SCAN_STATUS_LABEL, scanStatusTone, userDisplayName } from '@scanvault/api-client';
import { Badge, Card, CardContent, CardHeader, CardTitle, StatusPill } from '@scanvault/ui';

import { formatDateTime } from '@/lib/format';
import { ScanActivityLog } from './scan-activity-log';
import { ScanFileList } from './scan-file-list';
import { ScanSubmittedAnswers } from './scan-submitted-answers';

/**
 * Structural, not `Scan`, on purpose: the shared-scan route returns a nested
 * scan that is deliberately typed separately (its `review.user`, `scanLogs` and
 * `groups` differ on the wire), and both shapes satisfy this.
 */
export type ScanContextSubject = {
  id: string;
  title: string;
  status: ScanStatus;
  processingError?: string | null;
  scanType: ScanTypeRef;
  user: UserBasic;
  groups?: ScanGroupRef[] | null;
  tags: string[];
  scanIdentifier?: string | null;
  externalPatientId?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  fileTotal: number;
  fileCount: number;
  files: MediaFile[];
  fileDetails: FileDetail[];
  findings: ScanFinding[];
  form: ScanFormResponse[];
};

type ScanContextPanelProps = {
  scan: ScanContextSubject;
  /** The learner's own note. Shown here as the clinical context for the study. */
  clinicalNote?: { note: string; author: string; createdAt: string } | null;
  scanLogs?: ScanLog[];
  logs?: ScanLog[];
};

/** Everything about the study that is not the media itself. */
export function ScanContextPanel({
  scan,
  clinicalNote,
  scanLogs = [],
  logs = [],
}: ScanContextPanelProps) {
  const groups = scan.groups ?? [];

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <CardTitle>{scan.title}</CardTitle>
          <StatusPill tone={scanStatusTone(scan.status)} label={SCAN_STATUS_LABEL[scan.status]} />
        </div>
        <p className="text-[12px] text-ink-dim">
          {scan.scanType.name}
          {scan.scanType.version ? ` · v${scan.scanType.version}` : ''}
          {scan.scanType.organization?.name ? ` · ${scan.scanType.organization.name}` : ''}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {scan.processingError ? (
          <p className="rounded-token border border-crit/30 bg-crit-soft p-2 text-[12px] text-crit">
            {scan.processingError}
          </p>
        ) : null}

        {clinicalNote ? (
          <Section title="Clinical note">
            <p className="whitespace-pre-wrap break-words text-body text-ink">
              {clinicalNote.note}
            </p>
            <p className="mt-1 text-[11px] text-ink-dim">
              {clinicalNote.author} · {formatDateTime(clinicalNote.createdAt)}
            </p>
          </Section>
        ) : null}

        <Section title="Findings and interpretation">
          <ScanSubmittedAnswers
            scanTypeId={scan.scanType.id}
            findings={scan.findings}
            form={scan.form}
          />
        </Section>

        <Section title="Identifiers">
          <dl className="space-y-1">
            <Row label="Scan identifier" value={scan.scanIdentifier || '—'} />
            <Row label="External patient ID" value={scan.externalPatientId || '—'} />
            <Row label="Scan ID" value={scan.id} mono />
          </dl>
        </Section>

        <Section title="Submitted by">
          <p className="text-body text-ink">{userDisplayName(scan.user)}</p>
          <p className="text-[12px] text-ink-dim">{scan.user.email}</p>
          <dl className="mt-2 space-y-1">
            <Row label="Submitted" value={formatDateTime(scan.createdAt)} />
            <Row label="Last updated" value={formatDateTime(scan.updatedAt)} />
            {scan.reviewedAt ? <Row label="Reviewed" value={formatDateTime(scan.reviewedAt)} /> : null}
          </dl>
        </Section>

        <Section title={groups.length === 1 ? 'Group' : 'Groups'}>
          {groups.length === 0 ? (
            <p className="text-body text-ink-dim">Not attached to a group.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {groups.map((group) => (
                <li key={group.id || group.name}>
                  <Badge>{group.name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {scan.tags.length > 0 ? (
          <Section title="Tags">
            <ul className="flex flex-wrap gap-1.5">
              {scan.tags.map((tag) => (
                <li key={tag}>
                  <Badge tone="accent">{tag}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title={`Files (${scan.fileCount}/${scan.fileTotal})`}>
          <ScanFileList
            files={scan.files}
            fileDetails={scan.fileDetails}
            expected={scan.fileTotal}
          />
        </Section>

        <ScanActivityLog scanLogs={scanLogs} logs={logs} />
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <dt className="text-[12px] text-ink-dim">{label}</dt>
      <dd className={mono ? 'text-[12px] text-ink sv-num' : 'text-body text-ink'}>{value}</dd>
    </div>
  );
}
