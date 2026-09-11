import { useUserOrganizations } from '@scanvault/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@scanvault/ui';
import { ArrowRight } from 'lucide-react';

import { useAuth } from '@/auth/auth-context';

import { FileDropZone } from '../components/file-drop-zone';
import { FileRow } from '../components/file-row';
import { InlineNotice } from '../components/inline-notice';
import { shouldShowFileCountNudge } from '../model/file-count-nudge';
import { countStored, countTracked } from '../model/file-counts';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';

export type StepFilesProps = {
  draft: UseCreateScanDraft;
  onNext: () => void;
};

export function StepFiles({ draft, onNext }: StepFilesProps) {
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            Uploading starts as soon as a file passes its check. You can keep working, and closing
            this tab will not lose anything already in storage.
          </p>
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

      <div className="flex flex-wrap items-center justify-end gap-2">
        {tracked === 0 ? (
          <span className="text-[12px] text-ink-dim">Add at least one file to continue.</span>
        ) : null}
        <Button onClick={onNext} disabled={tracked === 0}>
          Interpretation <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
