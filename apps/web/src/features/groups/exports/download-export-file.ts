import { exportFileToBlob, type ExportFileResult } from '@sector/api-client';

/**
 * Turns a generated export result into a real browser download.
 *
 * The blob-decoding half (`exportFileToBlob`) is pure and lives in
 * `@sector/api-client`, unit-tested there. This half — an `<a download>`
 * click — touches `document` and `URL.createObjectURL`, which this repo's
 * node-environment vitest cannot exercise; it is exactly the kind of thing
 * the cold-load sweep and a manual browser pass exist to catch instead.
 */
export function downloadExportFile(result: ExportFileResult): void {
  const blob = exportFileToBlob(result);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** The scan-report CSV/JSON routes answer plain text/rows, not a base64 buffer. */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
