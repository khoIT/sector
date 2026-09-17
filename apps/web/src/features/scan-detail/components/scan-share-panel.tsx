import type { CreateScanShareResult } from '@sector/api-client';
import {
  isApiError,
  useCreateScanShareMutation,
  useDeleteScanShareMutation,
  useSharesForScan,
} from '@sector/api-client';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  StatusPill,
  Textarea,
} from '@sector/ui';
import { Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { formatDateTime } from '@/lib/format';
import { useTranslation } from 'react-i18next';

type ScanSharePanelProps = {
  scanId: string;
  /** The signed-in user's id. The share routes do not infer the sharer. */
  currentUserId: string;
};

/**
 * Share a scan with colleagues, see who already has it, and take it back.
 *
 * A share is one row per recipient EMAIL, so "revoke" removes one person, not
 * the whole share. Recipients must already have an account — the server skips
 * unregistered addresses silently, which is why the skipped ones are reported
 * back to the sharer here instead of being swallowed.
 */
export function ScanSharePanel({ scanId, currentUserId }: ScanSharePanelProps) {
  const { t } = useTranslation();
  const [emailsText, setEmailsText] = useState('');
  const [remarks, setRemarks] = useState('');
  const [result, setResult] = useState<CreateScanShareResult | null>(null);

  const sharesQuery = useSharesForScan({ scanId, sharedBy: currentUserId });
  const createShare = useCreateScanShareMutation();
  const deleteShare = useDeleteScanShareMutation();

  const emails = parseEmails(emailsText);

  async function submit() {
    if (emails.length === 0) return;
    setResult(null);

    try {
      const created = await createShare.mutateAsync({
        scan: scanId,
        emails,
        sharedBy: currentUserId,
        remarks: remarks.trim() || undefined,
      });
      setResult(created);
      setEmailsText('');
      setRemarks('');
    } catch {
      // Rendered from createShare.error. The typed addresses are kept so a
      // single bad entry does not cost the user the whole list.
    }
  }

  const shares = sharesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('scanDetail.share.title')}</CardTitle>
        {shares.length > 0 ? (
          <span className="text-[12px] text-ink-dim sv-num">
            {t('scanDetail.share.recipients', { count: shares.length })}
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {sharesQuery.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : sharesQuery.isError ? (
          <p className="text-[12px] text-crit">
            {isApiError(sharesQuery.error)
              ? sharesQuery.error.message
              : t('scanDetail.share.loadError')}
          </p>
        ) : shares.length === 0 ? (
          <p className="text-body text-ink-dim">{t('scanDetail.share.none')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {shares.map((share) => (
              <li key={share.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-body text-ink" title={share.email}>
                    {share.email}
                  </p>
                  <p className="text-[11px] text-ink-dim">
                    {t('scanDetail.share.sharedAt', { date: formatDateTime(share.createdAt) })}
                  </p>
                  {share.remarks ? (
                    <p className="mt-0.5 break-words text-[11px] text-ink-dim">“{share.remarks}”</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusPill
                    tone={share.status === 'opened' ? 'ok' : 'neutral'}
                    label={
                      share.status === 'opened'
                        ? t('scanDetail.share.opened')
                        : t('scanDetail.share.unopened')
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('scanDetail.share.revoke', { email: share.email })}
                    disabled={deleteShare.isPending}
                    // The failure is rendered from deleteShare.error below;
                    // the catch only keeps the rejection from going unhandled.
                    onClick={() =>
                      void deleteShare.mutateAsync({ shareId: share.id }).catch(() => {})
                    }
                  >
                    <Trash2 className="h-4 w-4 text-crit" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {deleteShare.isError ? (
          <p className="text-[12px] text-crit">
            {isApiError(deleteShare.error)
              ? deleteShare.error.message
              : t('scanDetail.share.revokeError')}
          </p>
        ) : null}

        <div className="space-y-2 border-t border-line pt-3">
          <Input
            label={t('scanDetail.share.withLabel')}
            placeholder={t('scanDetail.share.withPlaceholder')}
            hint={t('scanDetail.share.withHint')}
            value={emailsText}
            disabled={createShare.isPending}
            onChange={(event) => setEmailsText(event.target.value)}
            error={
              createShare.isError
                ? isApiError(createShare.error)
                  ? createShare.error.message
                  : t('scanDetail.share.shareError')
                : undefined
            }
          />
          <Textarea
            label={t('scanDetail.share.messageLabel')}
            rows={2}
            value={remarks}
            disabled={createShare.isPending}
            onChange={(event) => setRemarks(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={emails.length === 0 || createShare.isPending}
              onClick={() => void submit()}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              {createShare.isPending
                ? t('scanDetail.share.sharing')
                : t('scanDetail.share.shareWithCount', { count: emails.length || 0 })}
            </Button>
          </div>

          {result ? <ShareOutcome result={result} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ShareOutcome({ result }: { result: CreateScanShareResult }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1 rounded-token border border-line bg-surface-2 p-2 text-[12px]">
      {result.sharedScans.length > 0 ? (
        <p className="text-ok">
          {t('scanDetail.share.outcomeShared', { count: result.sharedScans.length })}
        </p>
      ) : null}
      {result.duplicateEmails.length > 0 ? (
        <p className="text-warn">
          {t('scanDetail.share.outcomeDuplicate', { emails: result.duplicateEmails.join(', ') })}
        </p>
      ) : null}
      {result.notFoundEmails.length > 0 ? (
        <p className="text-warn">
          {t('scanDetail.share.outcomeNotFound', { emails: result.notFoundEmails.join(', ') })}
        </p>
      ) : null}
    </div>
  );
}

function parseEmails(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
