import { playableSources } from '@/features/scan-detail/components/media-source';
import { ScanMediaViewer } from '@/features/scan-detail/components/scan-media-viewer';

import type { StageSource } from '../model/draft-file-sources';

import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import { FilesPanel } from './files-panel';
import { useTranslation } from 'react-i18next';

export type StudyRailProps = {
  draft: UseCreateScanDraft;
  sources: StageSource[];
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * The media and its files, in a column of their own.
 *
 * Upload used to be the first and largest thing on the page — a full-width
 * drop slab above every question the study actually asks. It gates nothing and
 * blocks nothing, so it has no business leading. Here it has its own column,
 * out of the reading order of the work, and the drop target is the whole
 * surface anyway.
 *
 * `FilesPanel` is reused whole rather than reimplemented as a strip. It knows
 * how to retry a failed part, reattach a file this browser no longer holds,
 * explain a rejected format, and refuse to fold while any of that is
 * outstanding — none of which is worth rewriting smaller, and all of which is
 * how a broken study gets caught before submit.
 *
 * Sticky, because the viewer is only useful while the findings beside it are
 * being answered.
 */
export function StudyRail({ draft, sources, collapsed, onToggle }: StudyRailProps) {
  const { t } = useTranslation();
  // Playable, not merely present. A draft restored from its manifest still
  // lists its files, but their bytes are in S3 and not in this browser, so
  // there is nothing to put on a stage — and a viewer frame offering to step
  // between files it cannot show is worse than no viewer.
  const playable = playableSources(sources);

  return (
    // At 2xl the rail is a column of its own; a long file list scrolling
    // inside it beats the page growing to the rail's height while the findings
    // beside it end half a screen up.
    <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-y-auto">
      {playable.length > 0 ? (
        <div className="min-w-0">
          <ScanMediaViewer
            files={playable}
            // The column beside this one is entirely form controls, and the
            // findings options claim the arrow keys for roving focus.
            navigationKeys="brackets"
          />
          <p className="mt-1 text-[11px] text-ink-dim">
            {t('createScan.rail.localPlayback')}{' '}
            <kbd className="rounded border border-line px-1">[</kbd> {t('createScan.rail.and')}{' '}
            <kbd className="rounded border border-line px-1">]</kbd>{' '}
            {t('createScan.rail.stepBetween')}
          </p>
        </div>
      ) : sources.length > 0 ? (
        <p className="text-[11px] text-ink-dim">{t('createScan.rail.noPreviews')}</p>
      ) : null}

      <FilesPanel draft={draft} collapsed={collapsed} onToggle={onToggle} />
    </div>
  );
}
