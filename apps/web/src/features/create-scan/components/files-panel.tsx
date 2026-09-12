import { useUserOrganizations } from '@scanvault/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@scanvault/ui';
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
          <span className="sv-num">{stored}</span> {stored === 1 ? 'file' : 'files'} in storage
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
              <CardTitle>Files</CardTitle>
              <p className="mt-0.5 text-[12px] text-ink-dim">
                Uploading starts as soon as a file passes its check. You can keep working, and
                closing this tab will not lose anything already in storage.
              </p>
            </div>
            {/* Only offered once nothing needs attention: a fold that hides a
                failed upload is how a failed upload reaches Submit. */}
            {onToggle && canAutoCollapseFiles(files) ? (
              <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded>
                Collapse
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <FileDropZone onFiles={(picked) => void draft.addFiles(picked)} />

          {draft.validationFailures.length > 0 ? (
            <InlineNotice
              tone="crit"
              title={
                draft.validationFailures.length === 1
                  ? '1 file was not added'
                  : `${draft.validationFailures.length} files were not added`
              }
              action={
                <Button variant="ghost" size="sm" onClick={draft.dismissValidationFailures}>
                  Dismiss
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
            <InlineNotice tone="warn" title="Most complete studies have at least three files">
              This study has {tracked} so far. Add the remaining views now if you have them — files
              can also be added to the study later, but reviewers see it as soon as it is submitted.
            </InlineNotice>
          ) : null}

          {detached.length > 0 ? (
            <InlineNotice tone="warn" title="Some files from your saved draft need choosing again">
              {detached.length} of the files in this draft had not finished uploading when the page
              was last closed, and the browser does not keep file contents. Pick each one again
              below, or remove it from the study.
            </InlineNotice>
          ) : null}

          {failed.length > 0 ? (
            <InlineNotice
              tone="crit"
              title={`${failed.length} ${failed.length === 1 ? 'file' : 'files'} failed to upload`}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => failed.forEach((file) => draft.retryFile(file.id))}
                >
                  Retry all
                </Button>
              }
            >
              Each one says why below. Retrying re-uploads only that file; everything already in
              storage stays put.
            </InlineNotice>
          ) : null}

          {files.length > 0 ? (
            <div className="rounded-token border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                <span className="text-[12px] font-medium text-ink-dim">
                  <span className="sv-num">{stored}</span> of{' '}
                  <span className="sv-num">{tracked}</span> in storage
                </span>
                {moving.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={draft.cancelAll}>
                    Cancel all transfers
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
