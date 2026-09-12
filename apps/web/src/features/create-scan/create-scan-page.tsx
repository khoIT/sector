import { Button } from '@scanvault/ui';
import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

import { DraftIndicator } from './components/draft-indicator';
import { InlineNotice } from './components/inline-notice';
import { useCreateScanDraft } from './model/use-create-scan-draft';
import { StepReviewRouting } from './steps/step-review-routing';
import { StepSubmitted } from './steps/step-submitted';
import { StudySurface } from './steps/study-surface';

/**
 * Create Scan Study.
 *
 * Two surfaces over one draft that starts transferring bytes the moment a file
 * is chosen: the STUDY you work on, and the SUBMIT screen you commit from.
 *
 * It was four ordered steps. The order protected nothing — files commit on
 * selection, and neither the interpretation nor the routing step wrote anything
 * the previous one had to finish first — while the learner's real loop of add a
 * file, change the exam type, answer a finding, add another file cost Back,
 * Back, click, Next, Next. One boundary genuinely survives, and it is the only
 * one: everything before Submit is reversible in the app and Submit is not.
 *
 * Nothing here tells the user not to close the browser, because nothing in it
 * depends on the tab staying open: uploaded objects live in S3 and the draft
 * manifest lives in localStorage. The persistent "Draft saved" line is the
 * honest version of that warning.
 *
 * State, transfers and persistence are all in model/use-create-scan-draft.ts.
 */
export function CreateScanPage() {
  const draft = useCreateScanDraft();
  const { state } = draft;

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
          A saved draft was found in this browser. Files that finished uploading are already in
          storage, and anything that was still transferring picks up where it stopped. Only a
          file this browser no longer holds has to be chosen again — those are listed as such.
        </InlineNotice>
      ) : null}

      {state.step === 'study' ? (
        <StudySurface draft={draft} onReview={() => draft.goToStep('submit')} />
      ) : null}

      {state.step === 'submit' ? (
        <StepReviewRouting
          draft={draft}
          onBack={() => draft.goToStep('study')}
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
