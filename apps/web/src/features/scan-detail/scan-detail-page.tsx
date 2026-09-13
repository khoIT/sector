import type { ScanListView } from '@sector/api-client';
import { isApiError, useScan } from '@sector/api-client';
import { Button, EmptyState, Skeleton } from '@sector/ui';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { ScanContextPanel } from './components/scan-context-panel';
import { ScanMediaViewer } from './components/scan-media-viewer';
import { ScanNotesThread } from './components/scan-notes-thread';
import { ScanReviewPanel } from './components/scan-review-panel';
import { ScanReviewSummary } from './components/scan-review-summary';
import { ScanSharePanel } from './components/scan-share-panel';
import {
  safeReturnUrl,
  scanDetailPathFor,
  scanListPathFor,
  SCAN_VIEW_LABEL,
  SCAN_VIEW_PERMISSION,
} from './scan-detail-links';
import { clinicalNoteFor } from './scan-detail-format';

/** Queues where a reviewer submits feedback rather than reads it back. */
const REVIEW_QUEUES: ReadonlySet<ScanListView> = new Set<ScanListView>(['pending', 'expert']);

/** Where a submitted review lands, per source queue. */
const REVIEW_DESTINATION: Partial<Record<ScanListView, ScanListView>> = {
  pending: 'reviewed',
  expert: 'expert-reviewed',
};

export function ScanDetailPage({ view }: { view: ScanListView }) {
  const { scanId } = useParams<{ scanId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();

  const scanQuery = useScan({ view, scanId });
  const listPath = scanListPathFor(view);
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'), listPath);

  const scan = scanQuery.data;
  const isReviewQueue = REVIEW_QUEUES.has(view) && can('create:scan:review');

  function handleReviewed(reviewedScanId: string) {
    const destination = REVIEW_DESTINATION[view];

    // Only route to the reviewed queue when the reviewer can actually open it;
    // a role with create:scan:review but no view:scan:reviewed would otherwise
    // be bounced to the vault root the moment they submit.
    if (destination && can(SCAN_VIEW_PERMISSION[destination])) {
      navigate(scanDetailPathFor(destination, reviewedScanId, returnUrl));
      return;
    }
    navigate(returnUrl);
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={returnUrl}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to {SCAN_VIEW_LABEL[view]}
          </Link>
        </Button>
      </div>

      {scanQuery.isPending ? (
        <DetailSkeleton />
      ) : scanQuery.isError ? (
        <EmptyState
          tone="crit"
          title={isApiError(scanQuery.error) && scanQuery.error.isNotFound
            ? 'Scan not found'
            : 'Could not load this scan'}
          description={
            isApiError(scanQuery.error)
              ? scanQuery.error.message
              : 'Something went wrong loading the scan.'
          }
          action={
            <Button variant="secondary" onClick={() => void scanQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !scan ? null : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_470px]">
          {/* Sticky on wide screens: the reviewer writes feedback in the right
              rail while scrolling, and the images have to stay on screen. */}
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <ScanMediaViewer files={scan.files} />
          </div>

          <div className="min-w-0 space-y-3">
            {isReviewQueue ? (
              <ScanReviewPanel
                // Remount on scan change so draft hydration and form state
                // never leak from one scan into the next.
                key={scan.id}
                scan={scan}
                isExpertScan={view === 'expert'}
                onSubmitted={handleReviewed}
              />
            ) : (
              <ScanReviewSummary review={scan.review} reviewedAt={scan.reviewedAt} />
            )}

            <ScanContextPanel
              scan={scan}
              clinicalNote={clinicalNoteFor(scan)}
              scanLogs={scan.scanLogs}
              logs={scan.logs}
            />

            <ScanNotesThread
              scanId={scan.id}
              canRead={can('read:scan:note')}
              canAdd={can('create:scan:note')}
            />

            {user ? <ScanSharePanel scanId={scan.id} currentUserId={user.id} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}


function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Skeleton className="aspect-video w-full" />
      <div className="space-y-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
