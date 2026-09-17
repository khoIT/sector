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
} from '@sector/api-client';
import { SCAN_STATUS_LABEL, scanStatusTone, userDisplayName } from '@sector/api-client';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatusPill } from '@sector/ui';
import { CheckCircle, CircleSlash } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatDateTime } from '@/lib/format';
import {
  COMPLETE_TAG,
  INCOMPLETE_TAG,
  type CompletionTag,
} from '@/features/scan-list/rows/scan-tags';

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
  /**
   * True when the viewer holds `edit:scan` AND is looking at the study from a
   * reviewer surface — the queues and the reviewed lists. `edit:scan` alone
   * is not a gate: every role in the product holds it. The surface is what
   * carries the meaning, and it is already permission-gated at the route, so
   * this is never true on My Scans or Shared Scans. It is not an ownership
   * check: a reviewer who opens their own study through a queue can mark it.
   */
  canEditCompletion?: boolean;
  onSetCompletion?: (next: CompletionTag) => void;
  settingCompletion?: boolean;
  /** A completeness write that failed, so the reviewer is not left guessing. */
  completionError?: string | null;
};

/** Everything about the study that is not the media itself. */
export function ScanContextPanel({
  scan,
  clinicalNote,
  scanLogs = [],
  logs = [],
  canEditCompletion = false,
  onSetCompletion,
  settingCompletion = false,
  completionError = null,
}: ScanContextPanelProps) {
  const { t } = useTranslation();
  // Undefined and empty mean opposite things here: the detail route does not
  // send `groups` at all, while the list route sends [] for a study that
  // really went to nobody. Collapsing the two told every learner their study
  // had been routed nowhere.
  const groups = scan.groups;

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
          <Section title={t('scanDetail.context.clinicalNote')}>
            <p className="whitespace-pre-wrap break-words text-body text-ink">
              {clinicalNote.note}
            </p>
            <p className="mt-1 text-[11px] text-ink-dim">
              {clinicalNote.author} · {formatDateTime(clinicalNote.createdAt)}
            </p>
          </Section>
        ) : null}

        <Section title={t('scanDetail.context.findings')}>
          <ScanSubmittedAnswers
            scanTypeId={scan.scanType.id}
            findings={scan.findings}
            form={scan.form}
          />
        </Section>

        <Section title={t('scanDetail.context.identifiers')}>
          <dl className="space-y-1">
            <Row
              label={t('scanDetail.context.scanIdentifier')}
              value={scan.scanIdentifier || '—'}
            />
            <Row
              label={t('scanDetail.context.externalPatientId')}
              value={scan.externalPatientId || '—'}
            />
            <Row label={t('scanDetail.context.scanId')} value={scan.id} mono />
          </dl>
        </Section>

        <Section title={t('scanDetail.context.submittedBy')}>
          <p className="text-body text-ink">{userDisplayName(scan.user)}</p>
          <p className="text-[12px] text-ink-dim">{scan.user.email}</p>
          <dl className="mt-2 space-y-1">
            <Row label={t('scanDetail.context.submitted')} value={formatDateTime(scan.createdAt)} />
            <Row
              label={t('scanDetail.context.lastUpdated')}
              value={formatDateTime(scan.updatedAt)}
            />
            {scan.reviewedAt ? (
              <Row
                label={t('scanDetail.context.reviewed')}
                value={formatDateTime(scan.reviewedAt)}
              />
            ) : null}
          </dl>
        </Section>

        {groups ? (
          <Section title={t('scanDetail.context.group', { count: groups.length })}>
            {groups.length === 0 ? (
              <p className="text-body text-ink-dim">{t('scanDetail.context.noGroup')}</p>
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
        ) : null}

        {scan.tags.length > 0 || canEditCompletion ? (
          <Section title={t('scanDetail.context.tags')}>
            {scan.tags.length > 0 ? (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {scan.tags.map((tag) => (
                  <li key={tag}>
                    <Badge tone="accent">{tag}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}

            {canEditCompletion && onSetCompletion ? (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={settingCompletion || normalizedTags(scan.tags).has(COMPLETE_TAG)}
                  onClick={() => onSetCompletion(COMPLETE_TAG)}
                >
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden /> {t('scanDetail.markComplete')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={settingCompletion || normalizedTags(scan.tags).has(INCOMPLETE_TAG)}
                  onClick={() => onSetCompletion(INCOMPLETE_TAG)}
                >
                  <CircleSlash className="h-3.5 w-3.5" aria-hidden />{' '}
                  {t('scanDetail.markIncomplete')}
                </Button>
              </div>
            ) : null}

            {completionError ? (
              <p className="mt-2 rounded-token border border-crit/30 bg-crit-soft p-2 text-[12px] text-crit">
                {completionError}
              </p>
            ) : null}
          </Section>
        ) : null}

        <Section
          title={t('scanDetail.media.filesSection', {
            count: scan.fileCount,
            total: scan.fileTotal,
          })}
        >
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

function normalizedTags(tags: readonly string[]): Set<string> {
  return new Set(tags.map((tag) => tag.trim().toLowerCase()));
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
