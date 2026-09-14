import { exportFileToBlob, type ExportFileResult } from '@sector/api-client';

/**
 * Turns a generated export result into a real browser download.
 *
 * The blob-decoding half (`exportFileToBlob`) is pure and lives in
 * `@sector/api-client`, unit-tested there. This half — an `<a download>`
 * click — touches `document` and `URL.createObjectURL`, which this repo's
 * node-environment vitest cannot exercise; it is exactly the kind of thing
 * the cold-load sweep and a manual browser pass exist to catch instead.
 *
 * Both helpers THROW on a payload they cannot turn into a file. The caller is
 * expected to catch: this runs after the request already succeeded, so no
 * mutation's `isError` will ever be true for a failure here, and an
 * unreported throw is a download that silently does not happen.
 */
export function downloadExportFile(result: ExportFileResult): void {
  saveBlob(exportFileToBlob(result), result.filename);
}

/** The scan-report CSV/JSON routes answer plain text/rows, not a base64 buffer. */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  saveBlob(new Blob([content], { type: mimeType }), filename);
}

/**
 * Hand a blob to the browser as a download.
 *
 * The revoke is deferred rather than run on the next line. Revoking an object
 * URL in the same task as the synthetic `click()` races the browser's own
 * read of it: Chromium usually wins that race, Safari and some Firefox builds
 * do not, and the symptom is a download that simply never starts. A timeout
 * still frees the blob — it just does it after the click has been serviced.
 */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
