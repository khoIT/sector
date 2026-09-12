import {
  useFindingDefinitions,
  useFindingDefinitionsFetcher,
  useUserOrganizations,
  type ScanTypeSummary,
} from '@scanvault/api-client';
import { Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@scanvault/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/auth/auth-context';

import { ScanMediaViewer } from '@/features/scan-detail/components/scan-media-viewer';

import { FindingsPanel } from '../components/findings-panel';
import { InlineNotice } from '../components/inline-notice';
import { ScanTypePicker } from '../components/scan-type-picker';
import { SwitchScanTypeDialog } from '../components/switch-scan-type-dialog';
import { missingRequiredFindings } from '../model/finding-controls';
import {
  revokeAllObjectUrls,
  syncObjectUrls,
  viewableDraftFiles,
  type ObjectUrlMap,
} from '../model/draft-file-sources';
import { planFindingTransfer, type FindingTransferPlan } from '../model/transfer-findings';
import { anyOrganizationCollectsScanIdentifier } from '../model/identifier-gate';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';

export type StepInterpretationProps = {
  draft: UseCreateScanDraft;
};

export function StepInterpretation({ draft }: StepInterpretationProps) {
  const { user } = useAuth();
  const { data: organizations } = useUserOrganizations(user?.id);
  const { state, update } = draft;

  // Required findings are advisory here: the server does not enforce them, and
  // blocking on a row the user genuinely did not assess would push people to
  // invent an answer. They are named and highlighted instead.
  const { data: definitions } = useFindingDefinitions(state.scanTypeId, state.organizationId);
  const missingRequired = useMemo(
    () => missingRequiredFindings(definitions?.items ?? [], state.findings),
    [definitions, state.findings],
  );

  // ONE gate, used for collecting the identifier and (by the same helper) for
  // showing it back. See model/identifier-gate.ts for why the legacy pair
  // pointed in opposite directions.
  const collectsScanIdentifier = useMemo(
    () => anyOrganizationCollectsScanIdentifier(organizations),
    [organizations],
  );

  /**
   * The study, on screen while it is being interpreted.
   *
   * The learner was the person holding the probe and is the only one who can
   * say whether the window was adequate — and they were the one asked to
   * answer blind, with the images one wizard step away. The reviewer has had
   * media-left/form-right since day one; this is the same geometry.
   *
   * The URL map is a ref, not state: creating object URLs during render leaks
   * one per frame, which on a 148 MB study is hundreds of megabytes within
   * seconds of typing in the note field.
   */
  const objectUrls = useRef<ObjectUrlMap>(new Map());
  const sources = syncObjectUrls(viewableDraftFiles(state.files), objectUrls.current);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => revokeAllObjectUrls(urls);
  }, []);

  const fetchDefinitions = useFindingDefinitionsFetcher();
  const [pendingTypeId, setPendingTypeId] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<
    { scanType: ScanTypeSummary; plan: FindingTransferPlan } | null
  >(null);

  function applySwitch(scanType: ScanTypeSummary, findings: Record<string, string>) {
    update({ scanTypeId: scanType.id, scanTypeName: scanType.name, findings });
  }

  /**
   * Choosing a different scan type used to discard every answer with no dialog
   * and no undo. Now the destination's definitions are fetched first, the
   * transfer is planned, and the learner only sees a dialog when something
   * would actually be lost.
   */
  async function chooseScanType(scanType: ScanTypeSummary) {
    // Re-selecting the current type is a no-op, and must stay one: the legacy
    // version cleared the findings here and unmounted the whole block.
    if (scanType.id === state.scanTypeId) return;

    const answered = Object.values(state.findings).some((value) => value);
    if (!answered) {
      applySwitch(scanType, {});
      return;
    }

    setPendingTypeId(scanType.id);
    try {
      const destination = await fetchDefinitions(scanType.id, state.organizationId);
      const plan = planFindingTransfer(
        definitions?.items ?? [],
        destination.items ?? [],
        state.findings,
      );

      // Nothing lost, nothing to confirm.
      if (plan.cleared.length === 0) applySwitch(scanType, plan.carried);
      else setPendingSwitch({ scanType, plan });
    } catch {
      // The switch must not be blocked by a failed lookup. Fall back to the
      // old behaviour — clear everything — but say so rather than doing it
      // silently, which is the defect this phase exists to fix.
      setPendingSwitch({
        scanType,
        plan: {
          carried: {},
          kept: [],
          cleared: Object.entries(state.findings)
            .filter(([, value]) => value)
            .map(([key, value]) => ({ key, name: key, value })),
        },
      });
    } finally {
      setPendingTypeId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan type</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            Required, and fixed once the study is submitted — the API has no way to change a scan's
            type afterwards.
          </p>
        </CardHeader>
        <CardContent>
          <ScanTypePicker
            value={state.scanTypeId}
            pendingTypeId={pendingTypeId}
            onChange={(scanType) => void chooseScanType(scanType)}
          />

          {pendingSwitch ? (
            <SwitchScanTypeDialog
              open
              onOpenChange={(next) => {
                if (!next) setPendingSwitch(null);
              }}
              currentTypeName={state.scanTypeName ?? ''}
              nextTypeName={pendingSwitch.scanType.name}
              kept={pendingSwitch.plan.kept}
              cleared={pendingSwitch.plan.cleared}
              onConfirm={() => {
                applySwitch(pendingSwitch.scanType, pendingSwitch.plan.carried);
                setPendingSwitch(null);
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Media left, form right — the geometry the reviewer's detail page has
          always used, so a learner and their reviewer read the same study the
          same way. Stacks media-first below xl, where a 450px findings rail
          would be worse than a full-width one. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
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

      <Card>
        <CardHeader>
          <CardTitle>Clinical note</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            Context a reviewer needs: presentation, the question the scan was answering, anything
            the findings list cannot hold.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            label="Note"
            placeholder="e.g. 62M with flank pain, ruling out AAA. Limited windows due to bowel gas."
            value={state.note}
            rows={6}
            onChange={(event) => update({ note: event.target.value })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="External patient ID"
              hint="Optional. Your own record number, up to 100 characters."
              maxLength={100}
              value={state.externalPatientId}
              onChange={(event) => update({ externalPatientId: event.target.value })}
            />

            {collectsScanIdentifier ? (
              <Input
                label="Scan identifier"
                hint="Optional. Shown back on the study and included in your organization's export."
                value={state.scanIdentifier}
                onChange={(event) => update({ scanIdentifier: event.target.value })}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

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
