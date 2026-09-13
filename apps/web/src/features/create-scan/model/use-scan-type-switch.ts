import {
  useFindingDefinitions,
  useFindingDefinitionsFetcher,
  type ScanTypeSummary,
} from '@sector/api-client';
import { useState } from 'react';

import { planFindingTransfer, type FindingTransferPlan } from './transfer-findings';
import type { UseCreateScanDraft } from './use-create-scan-draft';

export type PendingSwitch = { scanType: ScanTypeSummary; plan: FindingTransferPlan };

/**
 * Choosing a scan type, including the part where answers are already on screen.
 *
 * Shared because the control that picks a type is in two places now — the
 * setup row of the one working surface, and the second step of the ordered
 * wizard — and the rule it has to obey is the same in both: choosing a
 * different type used to discard every answer with no dialog and no undo.
 * A second copy of that logic is a second chance to lose someone's findings.
 */
export function useScanTypeSwitch(draft: UseCreateScanDraft) {
  const { state, update } = draft;
  const { data: definitions } = useFindingDefinitions(state.scanTypeId, state.organizationId);
  const fetchDefinitions = useFindingDefinitionsFetcher();

  /** The tile or row waiting on its destination definitions. */
  const [pendingTypeId, setPendingTypeId] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  function applySwitch(scanType: ScanTypeSummary, findings: Record<string, string>) {
    update({ scanTypeId: scanType.id, scanTypeName: scanType.name, findings });
  }

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
      // silently, which is the defect this exists to fix.
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

  return {
    pendingTypeId,
    pendingSwitch,
    chooseScanType,
    confirmSwitch: () => {
      if (!pendingSwitch) return;
      applySwitch(pendingSwitch.scanType, pendingSwitch.plan.carried);
      setPendingSwitch(null);
    },
    cancelSwitch: () => setPendingSwitch(null),
  };
}
