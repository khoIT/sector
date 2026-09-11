/**
 * The draft id is the S3 prefix segment the wizard uploads under BEFORE any
 * scan exists: `storage/{userId}/scan/{draftId}/{filekey}`.
 *
 * POST /api/scan/v2/upload-presign validates that segment with
 * `isValidObjectId()` and nothing else — it never looks a scan up — so a
 * client-minted 24-hex value is accepted and the transfer can start the moment
 * a file is chosen. POST /api/scan/create then stores the resulting key
 * VERBATIM, so the File document ends up pointing at the object that really
 * landed. (Do not try to register these through /add-files instead: that route
 * rebuilds the key around the new scan id and 400s because nothing is there.)
 */

const OBJECT_ID_HEX_LENGTH = 24;

/** A 24-character lowercase hex string — the shape isValidObjectId accepts. */
export function mintDraftId(): string {
  const bytes = new Uint8Array(OBJECT_ID_HEX_LENGTH / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isDraftId(value: string): boolean {
  return new RegExp(`^[0-9a-f]{${OBJECT_ID_HEX_LENGTH}}$`).test(value);
}
