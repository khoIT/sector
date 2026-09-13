/**
 * Client-side media validation, ported from the legacy dashboard's
 * src/lib/validate-media-file.ts with its behaviour intact.
 *
 * The structure-first rule is the part that matters clinically and is easy to
 * get wrong: a file whose CONTAINER is valid is ACCEPTED even when the browser
 * cannot decode it. Ultrasound clips routinely carry codecs Chrome will not
 * play (and `MEDIA_ERR_SRC_NOT_SUPPORTED`, error code 4, is exactly that case),
 * but the server transcodes them fine. Rejecting them would throw away real
 * scans. Such a file is accepted with confidence 'structure-only' so the UI can
 * say so rather than silently pretending it previewed.
 *
 * Only three outcomes block an upload: a corrupt file, a disallowed type, and
 * a decode probe that ran out of time.
 */

const DEFAULT_BASE_TIMEOUT_MS = 15_000;
const MAX_EXTRA_TIMEOUT_MS = 45_000;
const MAX_TOTAL_TIMEOUT_MS = 60_000;
const HEADER_SNIFF_BYTES = 4096;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
] as const;

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/mov',
  'video/quicktime',
  'video/avi',
  'video/x-msvideo',
  'video/mkv',
  'video/x-matroska',
] as const;

export const ALLOWED_MEDIA_TYPES: readonly string[] = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
];

export type MediaValidationConfidence = 'verified' | 'structure-only';

export type MediaValidationFailureReason =
  'corrupted' | 'invalid-type' | 'timeout' | 'unsupported-in-browser';

export type MediaValidationResult =
  | { ok: true; confidence: MediaValidationConfidence }
  | { ok: false; reason: MediaValidationFailureReason };

export type ImageContainerKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'unknown' | 'mismatch';
export type VideoContainerKind = 'mp4' | 'webm' | 'avi' | 'mkv' | 'unknown' | 'mismatch';

export async function readFileHeader(
  file: File,
  maxBytes = HEADER_SNIFF_BYTES,
): Promise<Uint8Array> {
  const buffer = await file.slice(0, maxBytes).arrayBuffer();
  return new Uint8Array(buffer);
}

/** Scan for a 4-character box tag at 4-byte-aligned offsets (ISO BMFF etc.). */
export function findFourCc(bytes: Uint8Array, tag: string): boolean {
  if (tag.length !== 4 || bytes.length < 8) return false;

  const t0 = tag.charCodeAt(0);
  const t1 = tag.charCodeAt(1);
  const t2 = tag.charCodeAt(2);
  const t3 = tag.charCodeAt(3);
  const limit = Math.min(bytes.length - 4, HEADER_SNIFF_BYTES);

  for (let offset = 0; offset <= limit; offset += 4) {
    if (
      bytes[offset] === t0 &&
      bytes[offset + 1] === t1 &&
      bytes[offset + 2] === t2 &&
      bytes[offset + 3] === t3
    ) {
      return true;
    }
  }

  return false;
}

function bytesMatchAt(bytes: Uint8Array, offset: number, pattern: number[]): boolean {
  if (offset + pattern.length > bytes.length) return false;
  return pattern.every((value, index) => bytes[offset + index] === value);
}

const detectJpeg = (b: Uint8Array) => b.length >= 2 && b[0] === 0xff && b[1] === 0xd8;
const detectPng = (b: Uint8Array) => bytesMatchAt(b, 0, [0x89, 0x50, 0x4e, 0x47]);
const detectBmp = (b: Uint8Array) => b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d;

const detectGif = (b: Uint8Array) =>
  b.length >= 6 &&
  b[0] === 0x47 &&
  b[1] === 0x49 &&
  b[2] === 0x46 &&
  b[3] === 0x38 &&
  (b[4] === 0x37 || b[4] === 0x39) &&
  b[5] === 0x61;

const detectWebp = (b: Uint8Array) =>
  b.length >= 12 &&
  b[0] === 0x52 &&
  b[1] === 0x49 &&
  b[2] === 0x46 &&
  b[3] === 0x46 &&
  b[8] === 0x57 &&
  b[9] === 0x45 &&
  b[10] === 0x42 &&
  b[11] === 0x50;

const detectEbml = (b: Uint8Array) =>
  b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;

const detectAvi = (b: Uint8Array) =>
  b.length >= 12 &&
  b[0] === 0x52 &&
  b[1] === 0x49 &&
  b[2] === 0x46 &&
  b[3] === 0x46 &&
  b[8] === 0x41 &&
  b[9] === 0x56 &&
  b[10] === 0x49 &&
  b[11] === 0x20;

const detectMp4Family = (b: Uint8Array) =>
  findFourCc(b, 'ftyp') ||
  findFourCc(b, 'moov') ||
  findFourCc(b, 'mdat') ||
  findFourCc(b, 'free') ||
  findFourCc(b, 'wide');

/**
 * 'mismatch' means the declared MIME type and the magic bytes disagree — a
 * renamed or truncated file. 'unknown' means we have no rule for this type.
 */
export function sniffImageContainer(bytes: Uint8Array, mimeType: string): ImageContainerKind {
  if (!mimeType || mimeType === 'image/svg+xml') return 'unknown';

  let detected: ImageContainerKind = 'unknown';
  if (detectJpeg(bytes)) detected = 'jpeg';
  else if (detectPng(bytes)) detected = 'png';
  else if (detectGif(bytes)) detected = 'gif';
  else if (detectWebp(bytes)) detected = 'webp';
  else if (detectBmp(bytes)) detected = 'bmp';

  const expected: Record<string, ImageContainerKind> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
  };

  const want = expected[mimeType];
  if (!want) return 'unknown';
  return detected === want ? want : 'mismatch';
}

export function sniffVideoContainer(bytes: Uint8Array, mimeType: string): VideoContainerKind {
  let detected: VideoContainerKind = 'unknown';
  if (detectMp4Family(bytes)) detected = 'mp4';
  else if (detectEbml(bytes)) detected = 'webm';
  else if (detectAvi(bytes)) detected = 'avi';

  // QuickTime .mov and MKV are read through their ISO-BMFF / EBML cousins:
  // the containers are structurally the same family.
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime' || mimeType === 'video/mov') {
    return detected === 'mp4' ? 'mp4' : 'mismatch';
  }
  if (mimeType === 'video/webm') {
    return detected === 'webm' ? 'webm' : 'mismatch';
  }
  if (mimeType === 'video/avi' || mimeType === 'video/x-msvideo') {
    return detected === 'avi' ? 'avi' : 'mismatch';
  }
  if (mimeType === 'video/mkv' || mimeType === 'video/x-matroska') {
    return detected === 'webm' ? 'mkv' : 'mismatch';
  }

  return 'unknown';
}

export function isRasterMetadataAcceptable(dimensions: { width: number; height: number }): boolean {
  return dimensions.width > 0 && dimensions.height > 0;
}

export function isVideoMetadataAcceptable(metadata: {
  duration: number;
  videoWidth: number;
  videoHeight: number;
  readyState: number;
}): boolean {
  if (isRasterMetadataAcceptable({ width: metadata.videoWidth, height: metadata.videoHeight })) {
    return true;
  }
  // An audio-only or dimensionless track still counts as readable metadata.
  return metadata.readyState >= 1;
}

type FailedMediaValidationResult = Extract<MediaValidationResult, { ok: false }>;

/** True when the upload must not proceed: corrupt, wrong type, or timed out. */
export function blocksMediaUpload(
  result: MediaValidationResult,
): result is FailedMediaValidationResult {
  if (result.ok) return false;
  return (
    result.reason === 'corrupted' || result.reason === 'invalid-type' || result.reason === 'timeout'
  );
}

/**
 * Decode budget scaled by size: 15s base plus 2s per MB, capped at 60s. A
 * 500MB clip genuinely takes longer to demux than a 2MB still, and a fixed
 * timeout would reject the large ones as "corrupt".
 */
export function computeValidationTimeoutMs(file: File, overrideMs?: number): number {
  if (overrideMs !== undefined) return overrideMs;

  const sizeMb = file.size / (1024 * 1024);
  const extra = Math.min(MAX_EXTRA_TIMEOUT_MS, sizeMb * 2000);
  return Math.floor(Math.min(MAX_TOTAL_TIMEOUT_MS, DEFAULT_BASE_TIMEOUT_MS + extra));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('probe failed'));
      });
  });
}

type ProbeOutcome = 'verified' | 'failed' | 'timeout' | 'unsupported';

function probeWithImageElement(file: File, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(false);
    }, timeoutMs);

    img.onload = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(isRasterMetadataAcceptable({ width: img.naturalWidth, height: img.naturalHeight }));
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

async function validateRasterImage(file: File, timeoutMs: number): Promise<ProbeOutcome> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await withTimeout(createImageBitmap(file), timeoutMs);
      const ok = isRasterMetadataAcceptable({ width: bitmap.width, height: bitmap.height });
      bitmap.close();
      if (ok) return 'verified';
    } catch (error) {
      if (error instanceof Error && error.message === 'timeout') return 'timeout';
    }
  }

  try {
    return (await probeWithImageElement(file, timeoutMs)) ? 'verified' : 'failed';
  } catch (error) {
    if (error instanceof Error && error.message === 'timeout') return 'timeout';
    return 'failed';
  }
}

/** SVG is XML, not raster — only check it is non-empty, readable markup. */
async function validateSvg(file: File): Promise<boolean> {
  try {
    const text = await file.slice(0, 4096).text();
    return text.trim().length > 0 && (text.includes('<svg') || text.includes('<?xml'));
  } catch {
    return false;
  }
}

function validateVideoMetadata(file: File, timeoutMs: number): Promise<ProbeOutcome> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const url = URL.createObjectURL(file);
    let settled = false;

    const finish = (outcome: ProbeOutcome) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(outcome);
    };

    const tryAccept = () => {
      if (
        isVideoMetadataAcceptable({
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
        })
      ) {
        finish('verified');
      }
    };

    const timer = window.setTimeout(() => finish('timeout'), timeoutMs);

    video.onloadedmetadata = tryAccept;
    video.onloadeddata = tryAccept;
    video.onerror = () => {
      // code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED: a valid file this browser simply
      // cannot decode. The server can, so it is accepted, not rejected.
      finish(video.error?.code === 4 ? 'unsupported' : 'failed');
    };
    video.src = url;
  });
}

function isStructureValid(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/svg+xml') return true;

  if (mimeType.startsWith('image/')) {
    const kind = sniffImageContainer(bytes, mimeType);
    return kind !== 'mismatch' && kind !== 'unknown';
  }

  if (mimeType.startsWith('video/')) {
    const kind = sniffVideoContainer(bytes, mimeType);
    return kind !== 'mismatch' && kind !== 'unknown';
  }

  return false;
}

export type ValidateMediaFileOptions = { timeoutMs?: number };

export async function validateMediaFile(
  file: File,
  options?: ValidateMediaFileOptions,
): Promise<MediaValidationResult> {
  const timeoutMs = computeValidationTimeoutMs(file, options?.timeoutMs);

  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) return { ok: false, reason: 'invalid-type' };
  if (file.size === 0) return { ok: false, reason: 'corrupted' };

  let header: Uint8Array;
  try {
    header = await readFileHeader(file);
  } catch {
    return { ok: false, reason: 'corrupted' };
  }

  if (file.type === 'image/svg+xml') {
    return (await validateSvg(file))
      ? { ok: true, confidence: 'verified' }
      : { ok: false, reason: 'corrupted' };
  }

  if (!isStructureValid(header, file.type)) return { ok: false, reason: 'corrupted' };

  try {
    if (file.type.startsWith('image/')) {
      const probe = await validateRasterImage(file, timeoutMs);
      if (probe === 'verified') return { ok: true, confidence: 'verified' };
      if (probe === 'timeout') return { ok: false, reason: 'timeout' };
      return { ok: true, confidence: 'structure-only' };
    }

    if (file.type.startsWith('video/')) {
      const probe = await validateVideoMetadata(file, timeoutMs);
      if (probe === 'verified') return { ok: true, confidence: 'verified' };
      if (probe === 'timeout') return { ok: false, reason: 'timeout' };
      if (probe === 'unsupported') return { ok: true, confidence: 'structure-only' };
      return { ok: false, reason: 'corrupted' };
    }

    return { ok: false, reason: 'invalid-type' };
  } catch {
    // The container already checked out; a thrown probe is the browser's
    // problem, not the file's.
    return { ok: true, confidence: 'structure-only' };
  }
}
