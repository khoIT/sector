import { Button } from '@scanvault/ui';
import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

import { DraftIndicator } from './components/draft-indicator';
import { InlineNotice } from './components/inline-notice';
import { WizardStepper } from './components/wizard-stepper';
import type { WizardStep } from './model/draft-types';
import { countStored } from './model/file-counts';
import { useCreateScanDraft } from './model/use-create-scan-draft';
import { StepFiles } from './steps/step-files';
import { StepInterpretation } from './steps/step-interpretation';
import { StepReviewRouting } from './steps/step-review-routing';
import { StepSubmitted } from './steps/step-submitted';

/**
 * Create Scan Study.
 *
 * Four steps — Files, Interpretation, Review routing, Submitted — over one
 * draft that starts transferring bytes the moment a file is chosen. Nothing in
 * this flow tells the user not to close the browser, because nothing in it
 * depends on the tab staying open: uploaded objects live in S3 and the draft
 * manifest lives in localStorage. The persistent "Draft saved" line is the
 * honest version of that warning.
 *
 * State, transfers and persistence are all in model/use-create-scan-draft.ts;
 * this file is the shell and the step routing.
 */
export function CreateScanPage() {
  const draft = useCreateScanDraft();
  const { state } = draft;

  const canSelectStep = (step: WizardStep): boolean => {
    if (state.step === 'submitted') return false;
    if (step === 'files') return true;
    if (step === 'interpretation') return state.files.length > 0;
    if (step === 'routing') return Boolean(state.scanTypeId) && countStored(state.files) > 0;
    return false;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">
              Create scan study
            </h1>
            <p className="mt-0.5 text-[12px] text-ink-dim">
              Files upload while you work. Submitting records the details against them.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {state.step !== 'submitted' && state.files.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={draft.reset}
                title="Discard this draft and start again"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Discard draft
              </Button>
            ) : null}
            <Button asChild variant="secondary" size="sm">
              <Link to={SCAN_VAULT_PATH.my}>My scans</Link>
            </Button>
          </div>
        </div>

        <WizardStepper current={state.step} onSelect={draft.goToStep} canSelect={canSelectStep} />

        {state.step !== 'submitted' ? <DraftIndicator files={state.files} /> : null}
      </header>

      {draft.wasRestored && state.step !== 'submitted' ? (
        <InlineNotice
          tone="info"
          title="Picked up where you left off"
          action={
            <Button variant="ghost" size="sm" onClick={draft.reset}>
              Start fresh
            </Button>
          }
        >
          A saved draft was found in this browser. Files that finished uploading are still in
          storage and are listed as such; anything that had not finished needs choosing again.
        </InlineNotice>
      ) : null}

      {state.step === 'files' ? (
        <StepFiles draft={draft} onNext={() => draft.goToStep('interpretation')} />
      ) : null}

      {state.step === 'interpretation' ? (
        <StepInterpretation
          draft={draft}
          onBack={() => draft.goToStep('files')}
          onNext={() => draft.goToStep('routing')}
        />
      ) : null}

      {state.step === 'routing' ? (
        <StepReviewRouting
          draft={draft}
          onBack={() => draft.goToStep('interpretation')}
          onSubmitted={draft.finish}
        />
      ) : null}

      {state.step === 'submitted' && state.submitOutcome ? (
        <StepSubmitted outcome={state.submitOutcome} onCreateAnother={draft.reset} />
      ) : null}
    </div>
  );
}

export default CreateScanPage;
