import type { FileDetail, MediaFile } from '@sector/api-client';
import { isPendingFilePlaceholder } from '@sector/api-client';
import { StatusPill } from '@sector/ui';

import { formatBytes } from '@/lib/format';

type ScanFileListProps = {
  files: MediaFile[];
  /**
   * The client-supplied upload manifest. It carries a per-file status and a
   * failure message for files that never became File documents, which is the
   * only place a partial upload explains itself.
   */
  fileDetails: FileDetail[];
  expected: number;
};

type FileRow = {
  key: string;
  filename: string;
  filesize: number | null;
  status: string;
  message: string | null;
  missing: boolean;
};

/**
 * Every file on the scan and the state each one is in.
 *
 * Two collections have to be reconciled: `files` (real documents, with media
 * URLs) and `fileDetails` (the uploader's manifest). They are matched by
 * FILENAME because that is the only key they share — the same key the server's
 * PATCH /file-details/status uses — so two files with the same name in one scan
 * are genuinely ambiguous here, as they are server-side.
 */
export function ScanFileList({ files, fileDetails, expected }: ScanFileListProps) {
  const detailByName = new Map(fileDetails.map((detail) => [detail.filename, detail]));
  const seen = new Set<string>();

  const rows: FileRow[] = files.map((file) => {
    seen.add(file.filename);
    const detail = detailByName.get(file.filename);
    const missing = isPendingFilePlaceholder(file) || !file.url;

    return {
      key: file.id,
      filename: file.filename,
      filesize: file.filesize,
      status: missing ? 'not uploaded' : (file.status ?? detail?.status ?? 'completed'),
      message: detail?.message ?? null,
      missing,
    };
  });

  // Manifest entries with no File document at all: the upload was started and
  // never landed, so the filename is all that survives.
  for (const detail of fileDetails) {
    if (seen.has(detail.filename)) continue;
    rows.push({
      key: `detail-${detail.id ?? detail._id ?? detail.filename}`,
      filename: detail.filename,
      filesize: detail.filesize ?? null,
      status: detail.status ?? 'pending',
      message: detail.message ?? null,
      missing: true,
    });
  }

  if (rows.length === 0) {
    return <p className="text-body text-ink-dim">No files recorded on this scan.</p>;
  }

  return (
    <div className="space-y-1.5">
      {rows.length !== expected ? (
        <p className="text-[12px] text-warn">
          {rows.length} of {expected} expected file{expected === 1 ? '' : 's'} recorded.
        </p>
      ) : null}

      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-body text-ink" title={row.filename}>
                {row.filename}
              </p>
              <p className="text-[11px] text-ink-dim sv-num">{formatBytes(row.filesize)}</p>
              {row.message ? <p className="text-[11px] text-crit">{row.message}</p> : null}
            </div>
            <StatusPill
              tone={fileStatusTone(row.status, row.missing)}
              label={row.status}
              className="mt-0.5 shrink-0"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function fileStatusTone(status: string, missing: boolean): 'ok' | 'warn' | 'crit' | 'neutral' {
  if (status === 'failed') return 'crit';
  if (missing) return 'warn';
  if (status === 'completed') return 'ok';
  return 'neutral';
}
