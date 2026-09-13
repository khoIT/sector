import type { Document } from 'mongodb';

import { pick, toWire, type RefCache } from '../wire';

/**
 * `populate({ path: 'user', select: 'userName email firstName lastName' })`,
 * the projection every scan-side route uses for a person.
 *
 * Null, not undefined, when the reference does not resolve: that is what
 * Mongoose writes for a single populated path whose target is missing, and it
 * is a shape production really produces for a scan whose owner was deleted.
 */
export const USER_BASIC_FIELDS = ['userName', 'email', 'firstName', 'lastName'] as const;

export function populatedUser(refs: RefCache, ref: unknown): unknown {
  const user = refs.get('users', ref);
  return user ? toWire(pick(user, USER_BASIC_FIELDS)) : null;
}

/** `populate({ path: 'scanType', select: 'key name version questions' })`. */
export const SCAN_TYPE_REF_FIELDS = ['key', 'name', 'version', 'questions'] as const;

export function populatedScanTypeRef(refs: RefCache, ref: unknown): unknown {
  const scanType = refs.get('scantypes', ref);
  return scanType ? toWire(pick(scanType, SCAN_TYPE_REF_FIELDS)) : null;
}

/**
 * A File document as the scan routes send it.
 *
 * The media URLs are CloudFront-signed at request time and cannot come from a
 * dump, so they are null here — which is a value the schema has to accept
 * anyway, because the API sends null for every file in the pendingFiles
 * fallback and for any object CloudFront could not sign.
 */
export function mediaFile(file: Document): unknown {
  return {
    ...(toWire(
      pick(file, ['filename', 'filesize', 'filetype', 'filepath', 'originalFilename']),
    ) as Record<string, unknown>),
    // scan.controller: `status: scanFile.status || FileStatus.COMPLETED`
    status: file.status || 'completed',
    url: null,
    urlThumbnail: null,
    url360: null,
    url480: null,
    url720: null,
  };
}

/** The detail route's stand-in for files that never landed. */
export function pendingFilePlaceholder(entry: Document, index: number): unknown {
  return {
    ...(toWire(entry) as Record<string, unknown>),
    id: `pending-${index}`,
    originalFilename: entry.originalFilename ?? null,
    url: null,
    urlThumbnail: null,
    url360: null,
    url480: null,
    url720: null,
  };
}
