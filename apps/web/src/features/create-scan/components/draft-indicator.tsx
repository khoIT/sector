import { Badge, cn } from '@sector/ui';
import { CloudUpload, HardDriveDownload, Loader2 } from 'lucide-react';

import type { DraftFile } from '../model/draft-types';
import { countStored, countTracked } from '../model/file-counts';
import { useTranslation } from 'react-i18next';

export type DraftIndicatorProps = {
  files: DraftFile[];
  className?: string;
};

/**
 * The persistent "Draft saved — N of M files in storage" line, shown on every
 * step up to submission.
 *
 * It is the honest replacement for a "do not close the browser" warning: it
 * tells the user exactly how much of their work is already safe, so closing
 * the tab is a decision rather than a gamble. The count is derived from real
 * per-file state — a file is "in storage" only once S3 has acknowledged the
 * PUT.
 */
export function DraftIndicator({ files, className }: DraftIndicatorProps) {
  const { t } = useTranslation();
  const total = countTracked(files);
  const stored = countStored(files);
  const moving = files.filter(
    (file) => file.status === 'uploading' || file.status === 'queued',
  ).length;
  const detached = files.filter((file) => file.status === 'detached').length;

  if (total === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-token border border-line bg-surface-2 px-3 py-1.5',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
        {moving > 0 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-ink" aria-hidden />
        ) : (
          <CloudUpload className="h-3.5 w-3.5 text-ink-dim" aria-hidden />
        )}
        <span className="sv-num">{t('createScan.draftIndicator.saved', { stored, total })}</span>
      </span>

      {moving > 0 ? (
        <span className="text-[12px] text-ink-dim">
          <span className="sv-num">
            {t('createScan.draftIndicator.transferring', { count: moving })}
          </span>
        </span>
      ) : null}

      {detached > 0 ? (
        <Badge tone="warn" className="gap-1">
          <HardDriveDownload className="h-3 w-3" aria-hidden />
          <span className="sv-num">
            {t('createScan.draftIndicator.detached', { count: detached })}
          </span>
        </Badge>
      ) : null}
    </div>
  );
}
