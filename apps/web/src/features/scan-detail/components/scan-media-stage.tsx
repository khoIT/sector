import { isPendingFilePlaceholder, mediaFormatLabel, mediaKindFor } from '@sector/api-client';
import { FileWarning, Layers } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import type { StageSource } from './media-source';

/**
 * What actually fills the media stage for one file.
 *
 * Images and video play natively — no player library. The URL is either a
 * short-lived CloudFront presign on a saved scan or a local object URL on an
 * unsubmitted draft; nothing here is cached or persisted either way, and the
 * element re-reads whatever the current source holds.
 *
 * DICOM gets a labelled placeholder and a download link rather than a viewer:
 * Sector ships no DICOM renderer, and drawing a frame that is not the study
 * would be worse than saying so.
 */
export function ScanMediaStage({ file }: { file: StageSource }) {
  // Some formats resolve to a viewable kind but still fail in this particular
  // browser — HEIC outside Safari, TIFF almost everywhere, a codec the machine
  // lacks. Guessing which in advance gets it wrong both ways, so the element is
  // given a chance to load and the failure message is driven by what happened.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [file.id, file.url]);

  const kind = mediaKindFor(file);

  // A synthetic `pending-N` entry, or a real file whose presign came back null:
  // the bytes are not there to show, so say that rather than render a broken box.
  if (isPendingFilePlaceholder(file) || !file.url) {
    return (
      <StageMessage
        icon={<FileWarning className="h-6 w-6" aria-hidden />}
        title="File not available"
        detail="This file never finished uploading, so there is nothing to display."
      />
    );
  }

  if (kind === 'dicom') {
    return (
      <StageMessage
        icon={<Layers className="h-6 w-6" aria-hidden />}
        title="DICOM preview not supported"
        detail="Sector has no DICOM renderer. Download the file and open it in a DICOM viewer."
        action={<OpenOriginal url={file.url} />}
      />
    );
  }

  if (kind === 'image' && !failed) {
    return (
      <img
        key={file.id}
        src={file.url}
        alt={file.filename}
        onError={() => setFailed(true)}
        className="max-h-full max-w-full object-contain"
      />
    );
  }

  if (kind === 'video' && !failed) {
    return (
      <video
        // Keyed so switching files tears the element down instead of leaving
        // the previous clip's buffered frame on screen.
        key={file.id}
        src={file.url}
        poster={file.urlThumbnail ?? undefined}
        controls
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        className="max-h-full max-w-full"
      >
        <track kind="captions" />
      </video>
    );
  }

  const format = mediaFormatLabel(file);
  return (
    <StageMessage
      icon={<FileWarning className="h-6 w-6" aria-hidden />}
      title={
        failed
          ? `This browser cannot play ${format || 'this file'}`
          : `Cannot preview ${format || 'this file type'}`
      }
      detail="The file is stored and can be downloaded, but the browser cannot display it inline."
      action={<OpenOriginal url={file.url} />}
    />
  );
}

function OpenOriginal({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-[12px] text-white underline underline-offset-2"
    >
      Open original file
    </a>
  );
}

/**
 * Text over ultrasound media is white, dimmed with opacity: the stage is a
 * fixed near-black in both themes, so no palette token stays legible on it.
 */
function StageMessage({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-1.5 px-6 text-center text-white">
      <span className="text-white/80">{icon}</span>
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="text-[12px] text-white/70">{detail}</p>
      {action}
    </div>
  );
}
