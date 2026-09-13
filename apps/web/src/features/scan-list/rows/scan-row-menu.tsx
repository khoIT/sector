import type { AuthUser, MediaFile, ScanStatus } from '@sector/api-client';
import { hasPermission } from '@sector/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHint,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sector/ui';
import {
  CheckCircle,
  CircleSlash,
  Download,
  MessageSquare,
  MoreVertical,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { RequestExpertReviewDialog } from '@/features/scan-detail/components/request-expert-review-dialog';
import { ResetUploadDialog } from '@/features/scan-detail/components/reset-upload-dialog';
import { ScanNotesDialog } from '@/features/scan-detail/components/scan-notes-dialog';
import { ScanShareDialog } from '@/features/scan-detail/components/scan-share-dialog';
import {
  ScanDownloadError,
  downloadScanFiles,
  type DownloadableFile,
} from '@/lib/download-scan-files';

import type { ScanVaultView } from '../scan-list-views';
import { DeleteScanDialog } from './delete-scan-dialog';
import { isRowActionDisabled, rowActionsFor, type RowActionId } from './scan-row-actions';
import { COMPLETE_TAG, INCOMPLETE_TAG } from './scan-tags';
import { useSetScanCompletionTag } from './use-scan-completion-tag';

export type ScanRowMenuProps = {
  scanId: string;
  scanTitle: string;
  /** Files as the LIST returned them: presigned URLs, no detail fetch needed. */
  files: readonly MediaFile[];
  /** The id of the user who submitted the scan. */
  ownerId: string;
  status: ScanStatus;
  tags: readonly string[];
  view: ScanVaultView;
  user: AuthUser | null;
  /** Where "Open scan" goes, already carrying the return URL. */
  to: string;
};

type Dialogs = 'share' | 'notes' | 'delete' | 'reset-upload' | 'request-expert-review' | null;

type DownloadReport = { tone: 'warn' | 'crit'; message: string; failed: string[] };

const ACTION_KEY: Record<RowActionId, string> = {
  open: 'actions.openScan',
  share: 'actions.share',
  download: 'actions.download',
  comment: 'actions.comment',
  delete: 'actions.deleteScan',
  'reset-upload': 'actions.resetUpload',
  'request-expert-review': 'actions.requestExpertReview',
  'mark-complete': 'actions.markComplete',
  'mark-incomplete': 'actions.markIncomplete',
};

const ACTION_ICON = {
  open: Play,
  share: Share2,
  download: Download,
  comment: MessageSquare,
  delete: Trash2,
  'reset-upload': RotateCcw,
  'request-expert-review': Sparkles,
  'mark-complete': CheckCircle,
  'mark-incomplete': CircleSlash,
} as const;

/**
 * The actions a list row offers, beyond its primary button.
 *
 * Which actions appear is decided by `rowActionsFor`, which is a plain table
 * and is tested; this component only renders the result and owns the dialogs.
 *
 * Download runs here rather than on the scan page because the file URLs are
 * already on the row — the list response carries them — so leaving the list
 * to fetch what the list already has would be the slower path.
 */
export function ScanRowMenu({
  scanId,
  scanTitle,
  files,
  ownerId,
  status,
  tags,
  view,
  user,
  to,
}: ScanRowMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [downloading, setDownloading] = useState(false);
  /**
   * The download report has its OWN open state rather than a value of
   * `dialog`. A download runs in the background and can finish at any moment:
   * sharing one slot meant a slow download resolving while the user was typing
   * a note would replace the notes dialog and throw the draft away.
   */
  const [report, setReport] = useState<DownloadReport | null>(null);
  const completionTag = useSetScanCompletionTag();

  const downloadable: DownloadableFile[] = files
    .filter((file) => Boolean(file.url))
    .map((file) => ({ url: file.url as string, filename: file.filename }));

  const actions = rowActionsFor({
    view,
    isOwnScan: Boolean(user) && ownerId === user?.id,
    hasFiles: downloadable.length > 0,
    canReadNotes: hasPermission(user, 'read:scan:note'),
    canDelete: hasPermission(user, 'delete:scan'),
    canEditScan: hasPermission(user, 'edit:scan'),
    status,
    tags,
  });

  async function runDownload() {
    setDownloading(true);
    setReport(null);

    try {
      const result = await downloadScanFiles({ files: downloadable, zipName: scanTitle });
      if (result.failed.length > 0) {
        setReport({
          tone: 'warn',
          message: `Downloaded ${result.downloaded} of ${downloadable.length} files. These could not be fetched:`,
          failed: result.failed,
        });
      }
    } catch (error) {
      setReport({
        tone: 'crit',
        message: error instanceof ScanDownloadError ? error.message : t('actions.downloadFailed'),
        failed: error instanceof ScanDownloadError ? error.failed : [],
      });
    } finally {
      setDownloading(false);
    }
  }

  function run(action: RowActionId) {
    if (action === 'open') navigate(to);
    else if (action === 'share') setDialog('share');
    else if (action === 'comment') setDialog('notes');
    else if (action === 'delete') setDialog('delete');
    else if (action === 'reset-upload') setDialog('reset-upload');
    else if (action === 'request-expert-review') setDialog('request-expert-review');
    else if (action === 'mark-complete')
      void completionTag.setCompletion(scanId, tags, COMPLETE_TAG);
    else if (action === 'mark-incomplete') {
      void completionTag.setCompletion(scanId, tags, INCOMPLETE_TAG);
    } else void runDownload();
  }

  const destructive = actions.filter((action) => action === 'delete');
  const ordinary = actions.filter((action) => action !== 'delete');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t('actions.rowMenuFor', { title: scanTitle })}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>

          {ordinary.map((action) => {
            const Icon = ACTION_ICON[action];
            const disabled = isRowActionDisabled(action, { hasFiles: downloadable.length > 0 });
            return (
              <DropdownMenuItem
                key={action}
                disabled={disabled || (action === 'download' && downloading)}
                onSelect={() => run(action)}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                {action === 'download' && downloading
                  ? t('actions.downloading')
                  : t(ACTION_KEY[action])}
                {/* A disabled item cannot receive hover, so its reason has to
                    be on screen rather than in a title attribute. */}
                {disabled ? <DropdownMenuHint>{t('actions.noFiles')}</DropdownMenuHint> : null}
              </DropdownMenuItem>
            );
          })}

          {destructive.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              {destructive.map((action) => {
                const Icon = ACTION_ICON[action];
                return (
                  <DropdownMenuItem key={action} tone="crit" onSelect={() => run(action)}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {t(ACTION_KEY[action])}
                  </DropdownMenuItem>
                );
              })}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'share' && user ? (
        <ScanShareDialog
          scanId={scanId}
          scanTitle={scanTitle}
          currentUserId={user.id}
          open
          onOpenChange={(open) => setDialog(open ? 'share' : null)}
        />
      ) : null}

      {dialog === 'notes' ? (
        <ScanNotesDialog
          scanId={scanId}
          scanTitle={scanTitle}
          canRead={hasPermission(user, 'read:scan:note')}
          canAdd={hasPermission(user, 'create:scan:note')}
          open
          onOpenChange={(open) => setDialog(open ? 'notes' : null)}
        />
      ) : null}

      {dialog === 'delete' ? (
        <DeleteScanDialog
          scanId={scanId}
          scanTitle={scanTitle}
          open
          onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        />
      ) : null}

      {dialog === 'reset-upload' ? (
        <ResetUploadDialog
          scanId={scanId}
          scanTitle={scanTitle}
          open
          onOpenChange={(open) => setDialog(open ? 'reset-upload' : null)}
        />
      ) : null}

      {dialog === 'request-expert-review' ? (
        <RequestExpertReviewDialog
          scanId={scanId}
          scanTitle={scanTitle}
          tags={tags}
          open
          onOpenChange={(open) => setDialog(open ? 'request-expert-review' : null)}
        />
      ) : null}

      {report ? (
        <Dialog open onOpenChange={(open) => !open && setReport(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className={report.tone === 'crit' ? 'text-crit' : 'text-warn'}>
                {report.tone === 'crit' ? 'Download failed' : 'Some files are missing'}
              </DialogTitle>
              <DialogDescription>{report.message}</DialogDescription>
            </DialogHeader>

            {report.failed.length > 0 ? (
              <ul className="divide-y divide-line rounded-token border border-line">
                {report.failed.map((filename) => (
                  <li key={filename} className="px-3 py-2 text-body text-ink">
                    {filename}
                  </li>
                ))}
              </ul>
            ) : null}

            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={() => setReport(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
