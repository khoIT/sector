import { useFindingDefinitions, useUserOrganizations } from '@scanvault/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@scanvault/ui';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

import { useAuth } from '@/auth/auth-context';

import { FindingsPanel } from '../components/findings-panel';
import { InlineNotice } from '../components/inline-notice';
import { ScanTypePicker } from '../components/scan-type-picker';
import { missingRequiredFindings } from '../model/finding-controls';
import { anyOrganizationCollectsScanIdentifier } from '../model/identifier-gate';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';

export type StepInterpretationProps = {
  draft: UseCreateScanDraft;
  onBack: () => void;
  onNext: () => void;
};

export function StepInterpretation({ draft, onBack, onNext }: StepInterpretationProps) {
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
            onChange={(scanType) => {
              // Findings are keyed per scan type, so switching type clears them
              // rather than carrying answers that no longer have a question.
              update({
                scanTypeId: scanType.id,
                scanTypeName: scanType.name,
                findings: scanType.id === state.scanTypeId ? state.findings : {},
              });
            }}
          />
        </CardContent>
      </Card>

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
          Findings differ per scan type, so the form appears once a type is chosen. Your files keep
          uploading in the background meanwhile.
        </InlineNotice>
      )}

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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Files
        </Button>

        <div className="flex items-center gap-2">
          {!state.scanTypeId ? (
            <span className="text-[12px] text-ink-dim">Choose a scan type to continue.</span>
          ) : null}
          <Button onClick={onNext} disabled={!state.scanTypeId}>
            Review routing <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
