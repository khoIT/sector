import { useUserOrganizations } from '@sector/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sector/ui';
import { ChevronDown, Paperclip } from 'lucide-react';

import { useAuth } from '@/auth/auth-context';

import { FileDropZone } from './file-drop-zone';
import { FileRow } from './file-row';
import { InlineNotice } from './inline-notice';
import { shouldShowFileCountNudge } from '../model/file-count-nudge';
import {
  canAutoCollapseFiles,
  countStored,
  countTracked,
  trackedBytes,
} from '../model/file-counts';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import { useTranslation } from 'react-i18next';

export type FilesPanelProps = {
  draft: UseCreateScanDraft;
  /** Folded to a summary row. Never set while a file still needs attention. */
  collapsed?: boolean;
  /**
   * Omitted where folding makes no sense — the classic wizard's Files step is
   * the whole step, and a step that can collapse itself to one row is a step
   * showing nothing. Without this, no collapse affordance is offered.
   */
  onToggle?: () => void;
};

export function FilesPanel({ draft, collapsed = false, onToggle }: FilesPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: organizations } = useUserOrganizations(user?.id);

  const { files } = draft.state;
  const tracked = countTracked(files);
  const stored = countStored(files);
  const failed = files.filter((file) => file.status === 'failed');
  const detached = files.filter((file) => file.status === 'detached');
  const moving = files.filter((file) => file.status === 'uploading' || file.status === 'queued');

  // Inline, and shown as soon as the count is short — not as a modal fired at
  // the moment the user clicks Next. See model/file-count-nudge.ts.
  const showNudge = shouldShowFileCountNudge(tracked, organizations);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        className="flex w-full items-center gap-2 rounded-token border border-line bg-surface px-3 py-2.5 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink"
      >
        <Paperclip className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
        <span className="text-body text-ink">
          <span className="sv-num">
            {t('createScan.files.collapsedSummary', { count: stored })}
          </span>
        </span>
        <span className="sv-num text-[12px] text-ink-dim">{formatBytes(trackedBytes(files))}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{t('createScan.files.title')}</CardTitle>
              <p className="mt-0.5 text-[12px] text-ink-dim">{t('createScan.files.blurb')}</p>
            </div>
            {/* Only offered once nothing needs attention: a fold that hides a
                failed upload is how a failed upload reaches Submit. */}
            {onToggle && canAutoCollapseFiles(files) ? (
              <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded>
                {t('createScan.files.collapse')}
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <FileDropZone onFiles={(picked) => void draft.addFiles(picked)} />

          {draft.validationFailures.length > 0 ? (
            <InlineNotice
              tone="crit"
              title={t('createScan.files.notAdded', { count: draft.validationFailures.length })}
              action={
                <Button variant="ghost" size="sm" onClick={draft.dismissValidationFailures}>
                  {t('createScan.files.dismiss')}
                </Button>
              }
            >
              <ul className="flex flex-col gap-0.5">
                {draft.validationFailures.map((failure) => (
                  <li key={failure.name}>{draft.validationMessage(failure)}</li>
                ))}
              </ul>
            </InlineNotice>
          ) : null}

          {showNudge ? (
            <InlineNotice tone="warn" title={t('createScan.files.nudgeTitle')}>
              {t('createScan.files.nudgeBody', { count: tracked })}
            </InlineNotice>
          ) : null}

          {detached.length > 0 ? (
            <InlineNotice tone="warn" title={t('createScan.files.detachedTitle')}>
              {t('createScan.files.detachedBody', { count: detached.length })}
            </InlineNotice>
          ) : null}

          {failed.length > 0 ? (
            <InlineNotice
              tone="crit"
              title={t('createScan.files.failedTitle', { count: failed.length })}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => failed.forEach((file) => draft.retryFile(file.id))}
                >
                  {t('createScan.files.retryAll')}
                </Button>
              }
            >
              {t('createScan.files.failedBody')}
            </InlineNotice>
          ) : null}

          {files.length > 0 ? (
            <div className="rounded-token border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                <span className="text-[12px] font-medium text-ink-dim">
                  <span className="sv-num">
                    {t('createScan.files.storedOf', { stored, tracked })}
                  </span>
                </span>
                {moving.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={draft.cancelAll}>
                    {t('createScan.files.cancelAll')}
                  </Button>
                ) : null}
              </div>
              <ul>
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onCancel={draft.cancelFile}
                    onRetry={draft.retryFile}
                    onRemove={draft.removeFile}
                    onReattach={draft.reattachFile}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** `148 MB`. One decimal below 10 units, none above — precision nobody reads. */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
