/**
 * Scan status vocabulary and the pure predicates that drive polling and the
 * upload result screen. Kept free of React and of any UI import so both can be
 * unit-tested and reused by every feature surface.
 */

/** Matches the server enum value-for-value (scan.model.ts). */
export const SCAN_STATUSES = [
  'pending',
  'processing',
  'submitted',
  'failed',
  'failed_upload',
  'partially_uploaded',
  'reviewed',
] as const;

export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** A separate, 3-value enum. Do not confuse it with ScanStatus. */
export const FILE_STATUSES = ['pending', 'completed', 'failed'] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

/** How often to re-poll a list while any row is still processing. */
export const PROCESSING_POLL_MS = 5000;

export const SCAN_STATUS_LABEL: Record<ScanStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  submitted: 'Submitted',
  failed: 'Failed',
  failed_upload: 'Upload failed',
  partially_uploaded: 'Partially uploaded',
  reviewed: 'Reviewed',
};

/**
 * Tone for the StatusPill. The union is written out rather than imported from
 * @sector/ui so this package stays UI-free; it is assignable to BadgeTone.
 */
export type StatusTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'crit';

export function scanStatusTone(status: ScanStatus): StatusTone {
  switch (status) {
    case 'reviewed':
      return 'ok';
    case 'submitted':
      return 'accent';
    case 'processing':
    case 'pending':
      return 'neutral';
    case 'partially_uploaded':
      return 'warn';
    case 'failed':
    case 'failed_upload':
      return 'crit';
  }
}

/**
 * True when any row is still being processed server-side. Drives the 5s
 * refetchInterval on the scan lists: rendering/de-identification finishes
 * seconds AFTER the bytes land, so a list can go stale without any user action.
 */
export function hasProcessingScan(
  items: ReadonlyArray<{ status: ScanStatus }> | undefined,
): boolean {
  return Boolean(items?.some((item) => item.status === 'processing'));
}

export type UploadOutcome =
  | { done: false }
  | { done: true; failed: true; error: string | null | undefined }
  | { done: true; failed: false };

/**
 * Resolve whether an upload has finished, and whether it finished badly.
 *
 * The upload page polls the scan until `done`, because the bytes reaching S3
 * is NOT success: the server still has to render and de-identify, and that can
 * fail seconds later. Reporting success at PUT time hides those failures.
 */
export function uploadOutcomeFor(
  scan: { status: ScanStatus; processingError?: string | null } | undefined | null,
): UploadOutcome {
  if (!scan) return { done: false };
  if (scan.status === 'processing' || scan.status === 'pending') return { done: false };
  if (scan.status === 'failed') return { done: true, failed: true, error: scan.processingError };
  return { done: true, failed: false };
}
