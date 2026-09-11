import { isApiError, useSharedScanDetail, userDisplayName } from '@scanvault/api-client';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@scanvault/ui';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ScanContextPanel } from './components/scan-context-panel';
import { ScanMediaViewer } from './components/scan-media-viewer';
import { ScanNotesReadonly } from './components/scan-notes-readonly';
import { ScanReviewSummary } from './components/scan-review-summary';
import { safeReturnUrl, SHARED_SCAN_LIST_PATH } from './scan-detail-links';
import { formatDateTime } from '@/lib/format';

import { clinicalNoteFor } from './scan-detail-format';

/**
 * A scan someone shared with you — read-only throughout.
 *
 * Opening it marks the share `opened` server-side, which is why the recipient
 * gets no write affordances at all: they are a guest on someone else's study
 * and hold no permission over it.
 */
export function SharedScanDetailPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [searchParams] = useSearchParams();
  const shareQuery = useSharedScanDetail(shareId);
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'), SHARED_SCAN_LIST_PATH);

  const share = shareQuery.data;
  const scan = share?.scan;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={returnUrl}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to shared scans
          </Link>
        </Button>
        <Badge tone="accent">Shared with you · read only</Badge>
      </div>

      {shareQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : shareQuery.isError ? (
        <EmptyState
          tone="crit"
          title={
            isApiError(shareQuery.error) && shareQuery.error.isForbidden
              ? 'This scan is not shared with you'
              : 'Could not load this shared scan'
          }
          description={
            isApiError(shareQuery.error)
              ? shareQuery.error.message
              : 'Something went wrong loading the shared scan.'
          }
          action={
            <Button variant="secondary" onClick={() => void shareQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !share || !scan ? null : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_470px]">
          {/* Sticky on wide screens: the reviewer writes feedback in the right
              rail while scrolling, and the images have to stay on screen. */}
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <ScanMediaViewer files={scan.files} />
          </div>

          <div className="min-w-0 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Shared by</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-body text-ink">
                  {typeof share.sharedBy === 'string'
                    ? 'Unknown user'
                    : userDisplayName(share.sharedBy)}
                </p>
                <p className="text-[12px] text-ink-dim">{formatDateTime(share.createdAt)}</p>
                {share.remarks ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-body text-ink">
                    “{share.remarks}”
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <ScanReviewSummary review={scan.review} reviewedAt={scan.reviewedAt} />

            <ScanContextPanel
              scan={scan}
              clinicalNote={clinicalNoteFor(scan)}
            />

            <ScanNotesReadonly notes={scan.notes} />
          </div>
        </div>
      )}
    </div>
  );
}

