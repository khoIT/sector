import { useFindingDefinitions } from '@scanvault/api-client';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@scanvault/ui';
import { ChevronDown, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ScanMediaViewer } from '@/features/scan-detail/components/scan-media-viewer';

import { ClinicalNotePanel } from '../components/clinical-note-panel';
import { FindingsPanel } from '../components/findings-panel';
import { InlineNotice } from '../components/inline-notice';
import { ScanTypePicker } from '../components/scan-type-picker';
import { SwitchScanTypeDialog } from '../components/switch-scan-type-dialog';
import { missingRequiredFindings } from '../model/finding-controls';
import { useDraftMediaSources } from '../model/use-draft-media-sources';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import { useScanTypeSwitch } from '../model/use-scan-type-switch';

export type StepInterpretationProps = {
  draft: UseCreateScanDraft;
  /**
   * Whether the scan-type grid may fold itself to a summary row once a type is
   * chosen. Off for the classic wizard, where the picker IS the step.
   */
  collapsibleScanType?: boolean;
};

export function StepInterpretation({
  draft,
  collapsibleScanType = false,
}: StepInterpretationProps) {
  const { state, update } = draft;

  // Required findings are advisory here: the server does not enforce them, and
  // blocking on a row the user genuinely did not assess would push people to
  // invent an answer. They are named and highlighted instead.
  const { data: definitions } = useFindingDefinitions(state.scanTypeId, state.organizationId);
  const missingRequired = useMemo(
    () => missingRequiredFindings(definitions?.items ?? [], state.findings),
    [definitions, state.findings],
  );

  const sources = useDraftMediaSources(state.files);
  const switcher = useScanTypeSwitch(draft);
  const { pendingTypeId, pendingSwitch } = switcher;

  /**
   * The 22-tile grid folds to one row once a type is chosen.
   *
   * It used to stay open forever, which left the longest panel on the page
   * showing a decision that had already been made.
   *
   * Keyed on the id rather than set once: picking a DIFFERENT type has to fold
   * it again, and a restored draft has to render folded rather than flashing
   * the grid first. Expanding is always manual, so re-opening it and then
   * choosing the type that is already selected leaves it open — that click is
   * a deliberate no-op, and folding on it would read as a rejection.
   */
  const [typeCollapsed, setTypeCollapsed] = useState(
    () => collapsibleScanType && Boolean(state.scanTypeId),
  );
  useEffect(() => {
    if (collapsibleScanType && state.scanTypeId) setTypeCollapsed(true);
  }, [collapsibleScanType, state.scanTypeId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Outside the panel below, not inside it: a dialog a fold could unmount
          is a dialog that can vanish mid-decision. */}
      {pendingSwitch ? (
        <SwitchScanTypeDialog
          open
          onOpenChange={(next) => {
            if (!next) switcher.cancelSwitch();
          }}
          currentTypeName={state.scanTypeName ?? ''}
          nextTypeName={pendingSwitch.scanType.name}
          kept={pendingSwitch.plan.kept}
          cleared={pendingSwitch.plan.cleared}
          onConfirm={switcher.confirmSwitch}
        />
      ) : null}

      {typeCollapsed && state.scanTypeName ? (
        <button
          type="button"
          onClick={() => setTypeCollapsed(false)}
          aria-expanded={false}
          className="flex w-full items-center gap-2 rounded-token border border-line bg-surface px-3 py-2.5 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <Stethoscope className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
          <span className="sr-only">Scan type: </span>
          <span className="min-w-0 truncate text-body text-ink">{state.scanTypeName}</span>
          {/* "Change", not a bare chevron. The type is fixed for good once the
              study is submitted, so the row names what opening it is for. */}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[12px] text-ink-dim">
            Change
            <ChevronDown className="h-4 w-4" aria-hidden />
          </span>
        </button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Scan type</CardTitle>
            <p className="mt-0.5 text-[12px] text-ink-dim">
              Required, and fixed once the study is submitted — the API has no way to change a
              scan's type afterwards.
            </p>
          </CardHeader>
          <CardContent>
            <ScanTypePicker
              value={state.scanTypeId}
              pendingTypeId={pendingTypeId}
              onChange={(scanType) => void switcher.chooseScanType(scanType)}
            />
          </CardContent>
        </Card>
      )}

      {/* Media left, form right — the geometry the reviewer's detail page has
          always used, so a learner and their reviewer read the same study the
          same way. Stacks media-first below xl, where a 450px findings rail
          would be worse than a full-width one. */}
      <div
        className={cn(
          'grid gap-4 xl:items-start',
          // Two columns only when there is something to put in the first one.
          // Unconditionally, a study with no playable file left the findings
          // at half width against an empty half-screen.
          sources.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        )}
      >
        {sources.length > 0 ? (
          <div className="xl:sticky xl:top-4">
            <ScanMediaViewer
              files={sources}
              // The pane beside this one is entirely form controls, and the
              // findings options claim the arrow keys for roving focus.
              navigationKeys="brackets"
            />
            <p className="mt-1 text-[11px] text-ink-dim">
              Playing from this browser — nothing is fetched back from storage. Use{' '}
              <kbd className="rounded border border-line px-1">[</kbd> and{' '}
              <kbd className="rounded border border-line px-1">]</kbd> to step between files.
            </p>
          </div>
        ) : null}

        <div className="min-w-0">
          {state.scanTypeId ? (
            <FindingsPanel
              scanTypeId={state.scanTypeId}
              organizationId={state.organizationId}
              answers={state.findings}
              invalidKeys={missingRequired.map((definition) => definition.key)}
              onChange={(findings) => update({ findings })}
            />
          ) : (
            <InlineNotice tone="info" title="Pick a scan type to see its findings">
              Findings differ per scan type, so the form appears once a type is chosen. Your files
              keep uploading in the background meanwhile.
            </InlineNotice>
          )}
        </div>
      </div>

      <ClinicalNotePanel draft={draft} />

      {missingRequired.length > 0 ? (
        <InlineNotice
          tone="warn"
          title={`${missingRequired.length} required ${missingRequired.length === 1 ? 'finding is' : 'findings are'} still blank`}
        >
          {missingRequired.map((definition) => definition.name).join(', ')}. You can submit without
          them, but a reviewer will not know whether they were normal or not assessed.
        </InlineNotice>
      ) : null}

    </div>
  );
}
