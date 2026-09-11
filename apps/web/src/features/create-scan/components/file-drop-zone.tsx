import { Button, cn } from '@scanvault/ui';
import { UploadCloud } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';

import { ALLOWED_MEDIA_TYPES } from '../model/validate-media-file';

export type FileDropZoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
};

export function FileDropZone({ onFiles, disabled, className }: FileDropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-token border border-dashed px-4 py-8 text-center transition-colors',
        dragging ? 'border-accent-ink bg-accent-soft' : 'border-line bg-surface-2',
        disabled && 'opacity-60',
        className,
      )}
    >
      <UploadCloud className="h-5 w-5 text-ink-dim" aria-hidden />
      <p className="text-body font-medium text-ink">Drop images or clips here</p>
      <p className="max-w-md text-[12px] text-ink-dim">
        Each file is checked and starts uploading straight away, while you fill in the rest of the
        study. JPEG, PNG, GIF, WebP, BMP, SVG, MP4, MOV, WebM, AVI and MKV.
      </p>

      <label htmlFor={inputId} className="sr-only">
        Choose scan files
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ALLOWED_MEDIA_TYPES.join(',')}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          // Allow re-picking the same file after removing it.
          event.target.value = '';
        }}
      />
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Browse files
      </Button>
    </div>
  );
}
