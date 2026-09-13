import type { ExportFileResult } from './schemas/group-export';

/**
 * Turns one of the four generated exports (base64 workbook bytes) into a
 * `Blob` the browser can save. Pure and unit-testable: `atob`/`Uint8Array`
 * are global in Node 22, so this needs no DOM.
 *
 * Triggering the actual save (an `<a download>` click) is left to the call
 * site — that half touches `document`, which this package's tests, running
 * in a node environment, cannot exercise anyway. See CONTRACTS.md: "Browser
 * verification is mandatory" for anything that only a real page load proves.
 */
export function exportFileToBlob(result: Pick<ExportFileResult, 'buffer' | 'contentType'>): Blob {
  const binary = atob(result.buffer);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: result.contentType });
}
