import { mediaFormatLabel, mediaKindFor } from '@scanvault/api-client';
import { Button, cn, EmptyState } from '@scanvault/ui';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatBytes } from '@/lib/format';

import { playableSources, type StageSource } from './media-source';
import { ScanMediaStage } from './scan-media-stage';

type ScanMediaViewerProps = {
  /** Every file on the scan. Ones with no bytes are dropped from the stage. */
  files: StageSource[];
  className?: string;
  /**
   * Which keys step between files.
   *
   * Arrows on the reviewer's detail page, where the surrounding pane is mostly
   * read-only. Brackets where the pane beside the viewer is entirely form
   * controls — the findings options are toggle groups that claim arrow keys
   * for roving focus, and widening the "is the user typing" guard until it
   * covers every one of them makes the guard unreadable and still wrong.
   */
  navigationKeys?: 'arrows' | 'brackets';
};

/**
 * The media stage: one file at a time, with a thumbnail strip and arrow keys.
 *
 * Images and video play natively — no player library. Every URL is a
 * short-lived CloudFront presign, so nothing here is cached or persisted; the
 * element re-reads whatever the current query data holds.
 */
export function ScanMediaViewer({
  files: allFiles,
  className,
  navigationKeys = 'arrows',
}: ScanMediaViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const files = playableSources(allFiles);
  const withoutBytes = allFiles.length - files.length;
  const count = files.length;
  const safeIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);
  const active = files[safeIndex];

  const goPrevious = useCallback(() => {
    setActiveIndex((current) => (current - 1 + count) % Math.max(count, 1));
  }, [count]);

  const goNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % Math.max(count, 1));
  }, [count]);

  useEffect(() => {
    thumbnailRefs.current[safeIndex]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [safeIndex]);

  useEffect(() => {
    if (count < 2) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Arrow keys belong to whatever the reviewer is typing in.
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;

      const [previousKey, nextKey] =
        navigationKeys === 'brackets' ? ['[', ']'] : ['ArrowLeft', 'ArrowRight'];

      if (event.key === previousKey) goPrevious();
      else if (event.key === nextKey) goNext();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [count, goNext, goPrevious, navigationKeys]);

  if (count === 0 || !active) {
    return (
      <EmptyState
        className={className}
        icon={<ImageOff className="h-5 w-5" aria-hidden />}
        title={withoutBytes > 0 ? 'No preview available' : 'No media on this scan'}
        description={
          withoutBytes > 0
            ? `${withoutBytes} ${withoutBytes === 1 ? 'file' : 'files'} cannot be previewed here. The file list below names each one and its status.`
            : 'The upload never produced a file. The file list below shows what was expected.'
        }
      />
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative overflow-hidden rounded-token bg-scan-ground">
        <div className="flex aspect-video max-h-[68vh] w-full items-center justify-center">
          <ScanMediaStage file={active} />
        </div>

        {count > 1 ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous file"
              onClick={goPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/55 text-white hover:bg-black/75"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next file"
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/55 text-white hover:bg-black/75"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : null}

        {/* Text over ultrasound media is white with opacity: no palette token
            stays legible against a fixed near-black in both themes. */}
        <p className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/90 sv-num">
          {safeIndex + 1} / {count}
        </p>
      </div>

      <p className="truncate text-[12px] text-ink-dim" title={active.filename}>
        {active.filename}
        {typeof active.filesize === 'number' ? ` · ${formatBytes(active.filesize)}` : ''} ·{' '}
        {mediaFormatLabel(active) || 'unknown type'}
      </p>

      {withoutBytes > 0 ? (
        <p className="text-[12px] text-warn">
          {withoutBytes} more {withoutBytes === 1 ? 'file' : 'files'} cannot be previewed here. The
          list below names {withoutBytes === 1 ? 'it' : 'them'} and {withoutBytes === 1 ? 'its' : 'their'}{' '}
          status.
        </p>
      ) : null}

      {count > 1 ? (
        <div className="flex gap-2 overflow-x-auto rounded-token border border-line bg-surface-2 p-2">
          {files.map((file, index) => (
            <button
              key={file.id}
              type="button"
              ref={(node) => {
                thumbnailRefs.current[index] = node;
              }}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${file.filename}`}
              aria-current={index === safeIndex}
              className={cn(
                'h-14 w-20 shrink-0 overflow-hidden rounded border bg-scan-ground',
                index === safeIndex ? 'border-accent-ink ring-1 ring-accent-ink' : 'border-line',
              )}
            >
              <Thumbnail file={file} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Thumbnail({ file }: { file: StageSource }) {
  const kind = mediaKindFor(file);
  // Video renditions carry a poster; a still is its own thumbnail. Legacy rows
  // store the extension alone as `filetype`, so the kind has to be resolved
  // rather than read off a MIME prefix.
  const source = file.urlThumbnail ?? (kind === 'image' ? file.url : null);

  if (!source) {
    return (
      <span className="flex h-full w-full items-center justify-center text-[10px] text-white/70">
        {kind === 'video' ? 'VIDEO' : 'FILE'}
      </span>
    );
  }

  return <img src={source} alt="" className="h-full w-full object-cover" loading="lazy" />;
}
