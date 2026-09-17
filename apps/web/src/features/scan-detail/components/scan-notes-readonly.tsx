import type { UserBasic } from '@sector/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@sector/ui';

import { formatDateTime } from '@/lib/format';

import { noteAuthorName } from '../scan-detail-format';
import { useTranslation } from 'react-i18next';

type ReadonlyNote = {
  id: string;
  note: string;
  user: string | UserBasic;
  createdAt: string;
};

/**
 * The note thread without a composer, for surfaces where the viewer has no
 * write access — a shared scan, or a reviewed scan being read back.
 *
 * Renders the notes EMBEDDED on the scan rather than fetching the notes route:
 * a share recipient is not necessarily the scan owner and may not hold
 * `read:scan:note`, so requesting it would 403 on a page that otherwise works.
 */
export function ScanNotesReadonly({ notes }: { notes: readonly ReadonlyNote[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('scanDetail.notes.title')}</CardTitle>
        {notes.length > 0 ? (
          <span className="text-[12px] text-ink-dim sv-num">{notes.length}</span>
        ) : null}
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-body text-ink-dim">{t('scanDetail.notes.none')}</p>
        ) : (
          <ol className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-token border border-line bg-surface-2 p-2.5">
                <p className="whitespace-pre-wrap break-words text-body text-ink">{note.note}</p>
                <p className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11px] text-ink-dim">
                  <span className="font-medium text-accent-ink">{noteAuthorName(note.user)}</span>
                  <span>{formatDateTime(note.createdAt)}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
