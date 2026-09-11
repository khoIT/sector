/**
 * What kind of media a scan file is, from values the database actually holds.
 *
 * `filetype` is NOT reliably a MIME type. Of 108,577 file rows in `gusi_dev`,
 * 20,317 — 18.7% — store a bare extension instead: `mp4` 9,960, `jpg` 4,929,
 * `png` 2,023, `jpeg` 1,674, `bmp` 1,038, `mov` 637, and a tail of avi/gif/
 * pdf/webm. They cluster in the pre-GUSI import era, which is precisely the
 * oldest data — and the review queues open longest-waiting-first, so a naive
 * `filetype.startsWith('image')` fails on the very first row a reviewer sees.
 *
 * The filename is the last resort rather than the first, because a filename
 * can lie about its contents and `filetype` at least came from the uploader.
 */

export type MediaKind = 'image' | 'video' | 'dicom' | 'document' | 'unknown';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'bmp',
  'gif',
  'webp',
  'tif',
  'tiff',
  'heic',
  'heif',
  'avif',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'm4v',
  'avi',
  'webm',
  'mkv',
  'mpeg',
  'mpg',
  'wmv',
  'flv',
]);

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'zip', 'csv', 'txt', 'xls', 'xlsx', 'doc', 'docx']);

/** Lowercased extension with no dot, or '' when the name carries none. */
export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

function kindFromExtension(extension: string): MediaKind {
  if (extension === 'dcm' || extension === 'dicom') return 'dicom';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'unknown';
}

export type MediaKindInput = {
  filetype?: string | null;
  filename?: string | null;
};

/**
 * Resolve a file to one media kind, trying the MIME type, then `filetype` read
 * as a bare extension, then the filename extension.
 */
export function mediaKindFor(file: MediaKindInput): MediaKind {
  const fromFiletype = kindFromFiletype((file.filetype ?? '').trim().toLowerCase());
  if (fromFiletype !== 'unknown') return fromFiletype;

  const filename = (file.filename ?? '').trim();
  if (filename.toLowerCase().endsWith('.dcm')) return 'dicom';
  return kindFromExtension(extensionOf(filename));
}

function kindFromFiletype(filetype: string): MediaKind {
  if (!filetype) return 'unknown';
  if (filetype.includes('dicom')) return 'dicom';
  if (!filetype.includes('/')) return kindFromExtension(filetype);

  const [group, subtype = ''] = filetype.split('/');
  if (group === 'image') return 'image';
  if (group === 'video') return 'video';

  // `application/octet-stream` and `binary/octet-stream` describe bytes, not
  // contents — S3 hands them back for plenty of real images. Saying "unknown"
  // lets the filename decide instead of mislabelling a scan as a document.
  if (subtype === 'octet-stream') return 'unknown';

  // application/* and text/* split: a few are media containers, most are not.
  const fromSubtype = kindFromExtension(subtype.replace(/^x-/, ''));
  if (fromSubtype !== 'unknown') return fromSubtype;
  return group === 'application' || group === 'text' ? 'document' : 'unknown';
}

/**
 * A short human label for the format — `JPG`, `MP4` — taken from whichever of
 * filetype/filename actually names one. Used where a row has room for the
 * format but not for a full MIME type.
 */
export function mediaFormatLabel(file: MediaKindInput): string {
  const filetype = (file.filetype ?? '').trim().toLowerCase();
  const subtype = filetype.includes('/') ? (filetype.split('/')[1] ?? '') : filetype;
  const candidate = subtype.replace(/^x-/, '') || extensionOf(file.filename ?? '');

  if (!candidate) return '';
  // MIME subtypes like `vnd.openxmlformats-officedocument…` are unreadable.
  if (candidate.length > 6) return extensionOf(file.filename ?? '').toUpperCase();
  return candidate.toUpperCase();
}
