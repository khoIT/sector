import { isApiError, useAddScanNoteMutation, useScanNotes } from '@sector/api-client';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Textarea,
} from '@sector/ui';
import { MessagesSquare } from 'lucide-react';
import { useState } from 'react';

import { formatDateTime } from '@/lib/format';

import { noteAuthorName } from '../scan-detail-format';
import { useTranslation } from 'react-i18next';

type ScanNotesThreadProps = {
  scanId: string;
  /** False when the role lacks `read:scan:note`, so the request is not even made. */
  canRead: boolean;
  canAdd: boolean;
};

/**
 * The note thread on a scan: the learner's question, the reviewer's replies.
 *
 * Read through the standalone notes route rather than the scan's embedded
 * `notes[]` copy, because the embedded copy only refreshes when the scan
 * itself is refetched.
 */
export function ScanNotesThread({ scanId, canRead, canAdd }: ScanNotesThreadProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const notesQuery = useScanNotes(scanId, canRead);
  const addNote = useAddScanNoteMutation();

  async function submit() {
    const note = draft.trim();
    if (!note) return;

    try {
      await addNote.mutateAsync({ scanId, note });
      setDraft('');
    } catch {
      // Surfaced from `addNote.error` below; the draft is deliberately kept so
      // nothing a user typed is thrown away by a failed request.
    }
  }

  const notes = notesQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('scanDetail.notes.title')}</CardTitle>
        {notes.length > 0 ? (
          <span className="text-[12px] text-ink-dim sv-num">{notes.length}</span>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {!canRead ? (
          <p className="text-body text-ink-dim">{t('scanDetail.notes.noReadAccess')}</p>
        ) : notesQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : notesQuery.isError ? (
          <EmptyState
            tone="crit"
            title={t('scanDetail.notes.loadError')}
            description={
              isApiError(notesQuery.error)
                ? notesQuery.error.message
                : t('scanDetail.common.somethingWentWrong')
            }
            action={
              <Button variant="secondary" size="sm" onClick={() => void notesQuery.refetch()}>
                {t('scanDetail.common.retry')}
              </Button>
            }
          />
        ) : notes.length === 0 ? (
          <p className="text-body text-ink-dim">{t('scanDetail.notes.empty')}</p>
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

        {canAdd ? (
          <div className="space-y-2 border-t border-line pt-3">
            <Textarea
              label={t('scanDetail.notes.addLabel')}
              placeholder={t('scanDetail.notes.addPlaceholder')}
              value={draft}
              rows={3}
              disabled={addNote.isPending}
              onChange={(event) => setDraft(event.target.value)}
              error={
                addNote.isError
                  ? isApiError(addNote.error)
                    ? addNote.error.message
                    : t('scanDetail.notes.addError')
                  : undefined
              }
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                disabled={!draft.trim() || addNote.isPending}
                onClick={() => void submit()}
              >
                <MessagesSquare className="h-4 w-4" aria-hidden />
                {addNote.isPending ? t('scanDetail.notes.adding') : t('scanDetail.notes.add')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
