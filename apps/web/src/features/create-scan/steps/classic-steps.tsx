import { Button } from '@sector/ui';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { FilesPanel } from '../components/files-panel';
import { canEnterClassicStep } from '../model/classic-steps';
import { countTracked } from '../model/file-counts';
import type { SubmitOutcome } from '../model/draft-types';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';

import { StepInterpretation } from './step-interpretation';
import { StepReviewRouting } from './step-review-routing';

export type ClassicStepsProps = {
  draft: UseCreateScanDraft;
  onSubmitted: (outcome: SubmitOutcome) => void;
};

/**
 * The ordered wizard: Files, then Interpretation, then Review routing.
 *
 * This is a SHELL. Every panel it shows is the same component the study
 * surface uses — one findings panel, one file list, one routing panel — so a
 * fix to any of them lands in both flows. What differs is only the
 * arrangement: one panel at a time behind Back and Next, instead of all of
 * them at once.
 *
 * Navigation lives here rather than inside the step components for the same
 * reason: a panel that knows where Next goes cannot be reused by a flow with
 * a different Next.
 *
 * Two deliberate departures from the retired build:
 *
 *  - Interpretation shows the media beside the findings. Answering findings
 *    from memory was the four-step flow's real defect, and that viewer now
 *    lives inside the interpretation panel itself.
 *  - One gate predicate decides both what Next allows and what the stepper
 *    allows. See model/classic-steps.ts for the pair that disagreed.
 */
export function ClassicSteps({ draft, onSubmitted }: ClassicStepsProps) {
  const { state } = draft;

  if (state.step === 'files') {
    const tracked = countTracked(state.files);
    const canContinue = canEnterClassicStep('interpretation', state);

    return (
      <div className="flex flex-col gap-4">
        {/* No collapse affordance: this step IS the file list, and a step that
            can fold itself to one row is a step showing nothing. */}
        <FilesPanel draft={draft} />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {tracked === 0 ? (
            <span className="text-[12px] text-ink-dim">Add at least one file to continue.</span>
          ) : null}
          <Button onClick={() => draft.goToStep('interpretation')} disabled={!canContinue}>
            Interpretation <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  if (state.step === 'interpretation') {
    const canContinue = canEnterClassicStep('routing', state);

    return (
      <div className="flex flex-col gap-4">
        <StepInterpretation draft={draft} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => draft.goToStep('files')}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Files
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {!canContinue ? (
              <span className="text-[12px] text-ink-dim">Choose a scan type to continue.</span>
            ) : null}
            <Button onClick={() => draft.goToStep('routing')} disabled={!canContinue}>
              Review routing <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StepReviewRouting
      draft={draft}
      onBack={() => draft.goToStep('interpretation')}
      onSubmitted={onSubmitted}
      // The study flow puts routing on its working surface. This flow has no
      // working surface, so its last step is the only place it can be — and
      // routing cannot be repaired after submission.
      showGroupRouting
      backLabel="Interpretation"
    />
  );
}
