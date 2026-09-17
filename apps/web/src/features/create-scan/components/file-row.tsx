import { Badge, Button, Progress, StatusPill, cn } from '@sector/ui';
import { FileVideo, Image as ImageIcon, RotateCcw, Upload, X } from 'lucide-react';
import { useRef } from 'react';

import { formatBytes } from '@/lib/format';

import type { DraftFile, DraftFileStatus } from '../model/draft-types';
import { useTranslation } from 'react-i18next';

type StatusPresentation = {
  tone: 'neutral' | 'accent' | 'ok' | 'warn' | 'crit';
  label: string;
};

/**
 * Every status says what is true right now, in the user's terms. None of them
 * is a bare spinner: "Checking" and "Uploading" both carry the thing they are
 * waiting on, and the two that need the user say so.
 */
const STATUS: Record<DraftFileStatus, StatusPresentation> = {
  validating: { tone: 'neutral', label: 'Checking file' },
  rejected: { tone: 'crit', label: 'Not usable' },
  queued: { tone: 'neutral', label: 'Waiting to upload' },
  uploading: { tone: 'accent', label: 'Uploading' },
  stored: { tone: 'ok', label: 'In storage' },
  failed: { tone: 'crit', label: 'Upload failed' },
  cancelled: { tone: 'warn', label: 'Cancelled' },
  detached: { tone: 'warn', label: 'Needs re-selecting' },
};

export type FileRowProps = {
  file: DraftFile;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  /** Async: it revalidates the picked file before accepting it. */
  onReattach: (id: string, blob: File) => void | Promise<void>;
};

export function FileRow({ file, onCancel, onRetry, onRemove, onReattach }: FileRowProps) {
  const { t } = useTranslation();
  const reattachRef = useRef<HTMLInputElement>(null);
  const presentation = STATUS[file.status];
  const Icon = file.type.startsWith('video/') ? FileVideo : ImageIcon;

  return (
    <li className="flex flex-col gap-2 border-b border-line px-3 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Icon className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />

        <span className="min-w-0 flex-1 truncate text-body text-ink" title={file.name}>
          {file.name}
        </span>

        <span className="sv-num shrink-0 text-[12px] text-ink-dim">{formatBytes(file.size)}</span>

        <StatusPill tone={presentation.tone} label={presentation.label} />

        {file.confidence === 'structure-only' ? (
          <Badge tone="warn" title={t('createScan.fileRow.structureOnlyTitle')}>
            {t('createScan.fileRow.structureOnly')}
          </Badge>
        ) : null}

        <div className="flex shrink-0 items-center gap-1">
          {file.status === 'uploading' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(file.id)}
              aria-label={t('createScan.fileRow.cancelUpload', { name: file.name })}
            >
              <X className="h-3.5 w-3.5" aria-hidden /> {t('createScan.fileRow.cancel')}
            </Button>
          ) : null}

          {file.status === 'failed' || file.status === 'cancelled' ? (
            <Button variant="secondary" size="sm" onClick={() => onRetry(file.id)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t('createScan.fileRow.retry')}
            </Button>
          ) : null}

          {file.status === 'detached' ? (
            <>
              <input
                ref={reattachRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  if (picked) void onReattach(file.id, picked);
                  event.target.value = '';
                }}
              />
              <Button variant="secondary" size="sm" onClick={() => reattachRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" aria-hidden /> {t('createScan.fileRow.chooseAgain')}
              </Button>
            </>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(file.id)}
            aria-label={t('createScan.fileRow.remove', { name: file.name })}
            title={t('createScan.fileRow.remove', { name: file.name })}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {file.status === 'uploading' || file.status === 'stored' ? (
        <div className="flex items-center gap-2">
          <Progress
            value={file.progress}
            tone={file.status === 'stored' ? 'ok' : 'accent'}
            label={t('createScan.fileRow.progress', { name: file.name })}
            className="flex-1"
          />
          <span className={cn('sv-num w-9 text-right text-[11px] text-ink-dim')}>
            {file.progress}%
          </span>
        </div>
      ) : null}

      {file.error ? <p className="text-[12px] text-crit">{file.error.message}</p> : null}

      {file.status === 'detached' ? (
        <p className="text-[12px] text-ink-dim">{t('createScan.fileRow.detachedBody')}</p>
      ) : null}
    </li>
  );
}
