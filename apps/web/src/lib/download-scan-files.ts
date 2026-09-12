/**
 * Downloading a scan's media from a list row.
 *
 * The URLs are already on the row — the list response carries presigned
 * CloudFront links for every file — so this needs no detail fetch.
 *
 * Split in three on purpose. `uniqueFilenames` and `fetchScanFiles` are pure
 * enough to test in this app's node test environment; `downloadScanFiles`
 * is the thin browser half that reaches for `file-saver`, which needs a DOM.
 *
 * `jszip` and `file-saver` are imported dynamically so neither lands in the
 * first-paint bundle: most sessions never download anything.
 */

import { mediaFetchUrl } from './media-proxy-url';

export type DownloadableFile = { url: string; filename: string };

export type DownloadResult = {
  /** Files whose bytes arrived. */
  downloaded: number;
  /** Filenames whose fetch failed, in input order. */
  failed: string[];
};

export class ScanDownloadError extends Error {
  readonly failed: string[];

  constructor(message: string, failed: string[]) {
    super(message);
    this.name = 'ScanDownloadError';
    this.failed = failed;
  }
}

const FALLBACK_FILENAME = 'file';

/** Characters a filesystem rejects in a name. Separators are handled separately. */
const UNSAFE_FILENAME = /[\\/:*?"<>|]+/g;

/**
 * Reduce an uploaded filename to one safe zip entry name.
 *
 * Filenames cross a trust boundary — they are whatever the uploader's device
 * called the file — and `../../evil.mp4` handed to `zip.file()` writes outside
 * the target directory in a permissive extractor.
 *
 * Takes the BASENAME rather than replacing separators, because a zip entry
 * here is always a flat file: `a/b/c.png` is `c.png`, and `../../../evil.mp4`
 * is `evil.mp4`. Replacing separators with a dash would leave the `..` hops in
 * the name as literal text. A leading dot is preserved — `.hidden` is a real
 * filename — but a name that is ONLY dots is not one.
 */
export function safeFilename(raw: string): string {
  const basename = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = basename.trim().replace(UNSAFE_FILENAME, '-').trim();
  if (!cleaned || /^\.+$/.test(cleaned)) return FALLBACK_FILENAME;
  return cleaned;
}

/**
 * Make every name safe and unique, preserving order and extension.
 *
 * Old scans were not written by the current wizard and can carry two files
 * with the same name; JSZip would silently keep only the last one.
 */
export function uniqueFilenames(names: readonly string[]): string[] {
  const used = new Map<string, number>();

  return names.map((raw) => {
    const name = safeFilename(raw);
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);

    if (seen === 0) return name;

    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    return `${stem} (${seen + 1})${ext}`;
  });
}

/**
 * Fetch every file, keeping going past the ones that fail.
 *
 * The URL is passed through `toFetchUrl` first, because the media CDN serves
 * no CORS headers and the browser will not let this read bytes straight from
 * it; in development that returns a same-origin dev-server route to the same
 * object. See media-proxy-url.ts.
 *
 * A presigned URL can legitimately 403 — it expires, and in the local setup
 * every scan submitted after 2025-11-10 answers 403 because the database holds
 * production records while the bucket is staging. A partial archive is still
 * worth having, but the caller has to be able to say which files are missing
 * from it, so failures are collected rather than thrown.
 */
export async function fetchScanFiles(
  files: readonly DownloadableFile[],
  fetchImpl: typeof fetch = fetch,
  toFetchUrl: (url: string) => string = mediaFetchUrl,
): Promise<{ fetched: Array<{ filename: string; blob: Blob }>; failed: string[] }> {
  const names = uniqueFilenames(files.map((file) => file.filename));

  const settled = await Promise.all(
    files.map(async (file, index) => {
      try {
        const response = await fetchImpl(toFetchUrl(file.url));
        if (!response.ok) return { filename: names[index] as string, blob: null };
        return { filename: names[index] as string, blob: await response.blob() };
      } catch {
        return { filename: names[index] as string, blob: null };
      }
    }),
  );

  const fetched: Array<{ filename: string; blob: Blob }> = [];
  const failed: string[] = [];

  for (const entry of settled) {
    if (entry.blob) fetched.push({ filename: entry.filename, blob: entry.blob });
    else failed.push(entry.filename);
  }

  return { fetched, failed };
}

/** A scan title turned into something safe to use as a zip filename. */
export function zipFilename(scanTitle: string): string {
  const safe = scanTitle.trim().replace(UNSAFE_FILENAME, '-').trim();
  return `${safe || 'scan'}.zip`;
}

export type DownloadScanFilesOptions = {
  files: readonly DownloadableFile[];
  /** Used as the archive name when there is more than one file. */
  zipName: string;
};

/**
 * One file saves as itself; more than one saves as a zip.
 *
 * Throws `ScanDownloadError` when nothing could be fetched — there is no
 * useful empty archive — and resolves with the failures otherwise, so the
 * caller can name the files that are missing from what it just saved.
 */
export async function downloadScanFiles({
  files,
  zipName,
}: DownloadScanFilesOptions): Promise<DownloadResult> {
  if (files.length === 0) {
    throw new ScanDownloadError('This scan has no files to download.', []);
  }

  const { fetched, failed } = await fetchScanFiles(files);

  if (fetched.length === 0) {
    throw new ScanDownloadError(
      files.length === 1
        ? 'The file could not be downloaded. Its link may have expired.'
        : 'None of the files could be downloaded. Their links may have expired.',
      failed,
    );
  }

  const { saveAs } = await import('file-saver');

  if (fetched.length === 1 && files.length === 1) {
    const only = fetched[0] as { filename: string; blob: Blob };
    saveAs(only.blob, only.filename);
    return { downloaded: 1, failed };
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const entry of fetched) zip.file(entry.filename, entry.blob);

  saveAs(await zip.generateAsync({ type: 'blob' }), zipFilename(zipName));
  return { downloaded: fetched.length, failed };
}
