import { useScan } from '@sector/api-client';
import { Button } from '@sector/ui';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

import { DiscardDraftDialog } from './components/discard-draft-dialog';
import { DraftIndicator } from './components/draft-indicator';
import { InlineNotice } from './components/inline-notice';
import { WizardStepper } from './components/wizard-stepper';
import { canEnterClassicStep } from './model/classic-steps';
import { draftHoldings } from './model/draft-holdings';
import { readCreateScanFlow } from './model/create-scan-flow';
import { isFullySubmitted } from './model/submit-outcome';
import { useCreateScanDraft } from './model/use-create-scan-draft';
import { ClassicSteps } from './steps/classic-steps';
import { StepSubmitted } from './steps/step-submitted';
import { StudySurface } from './steps/study-surface';

/**
 * Create Scan Study.
 *
 * Two ways through, chosen in the user's profile and read once here:
 *
 *   study (default)  one working surface, submitting through a confirm
 *   classic          the ordered four-step wizard
 *
 * They share one draft, one model and every panel. Only the shell differs, so
 * a fix to the file list or the findings lands in both.
 *
 * The study flow is the default because nothing in this feature has to happen
 * in an order: files commit on selection, and neither the interpretation nor
 * the routing step writes anything the previous one had to finish first, while
 * the learner's real loop of add a file, change the exam type, answer a
 * finding, add another file cost Back, Back, click, Next, Next. One boundary
 * genuinely survives, and both flows keep it: everything before Submit is
 * reversible in the app and Submit is not.
 *
 * The preference is read ONCE, into state. Re-reading it on every render would
 * let a change in another tab swap the shell out from under a half-finished
 * study.
 *
 * Nothing here tells the user not to close the browser, because nothing in it
 * depends on the tab staying open: uploaded objects live in S3 and the draft
 * manifest lives in localStorage. The persistent "Draft saved" line is the
 * honest version of that warning.
 *
 * State, transfers and persistence are all in model/use-create-scan-draft.ts.
 */
export function CreateScanPage() {
  const { t } = useTranslation();
  const [flow] = useState(() => readCreateScanFlow(globalThis.localStorage));
  const draft = useCreateScanDraft(flow);
  const { state } = draft;

  const classic = flow === 'classic';
  const submitted = state.step === 'submitted';

  const [discardOpen, setDiscardOpen] = useState(false);
  // Everything the draft holds, not just its files: a study with a scan type,
  // six findings and a note but no file yet is exactly the draft a learner
  // most wants to throw away, and the control used to be hidden for it.
  const holdings = draftHoldings(state);

  // ─── entering from "Reset for re-upload" ──────────────────────────────────
  //
  // The row action resets the scan server-side (status -> pending, fileCount
  // -> 0) and lands here with `?resetScanId=`. What this page needs is a FRESH
  // draft carrying that scan id and its scan type; submitDraft's resume branch
  // then reconciles the scan's File records against the re-uploaded keys.
  //
  // Seeding REPLACES whatever draft is open, and there is only one draft slot,
  // so arriving here can destroy a study in progress — files included. That is
  // the same irreversible loss "Discard draft" is guarded for, reached by a
  // different door, so it goes through the same confirm rather than happening
  // on navigation.
  const [searchParams] = useSearchParams();
  const resetScanId = searchParams.get('resetScanId');
  const resetScan = useScan({
    view: 'my',
    scanId: resetScanId ?? undefined,
    enabled: Boolean(resetScanId),
  });
  const seededResetId = useRef<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const seedFromReset = useCallback(() => {
    if (!resetScanId || !resetScan.data) return;
    seededResetId.current = resetScanId;
    draft.reset();
    draft.update({
      scanId: resetScanId,
      scanTypeId: resetScan.data.scanType.id,
      scanTypeName: resetScan.data.scanType.name,
      organizationId: resetScan.data.scanType.organization?.id ?? null,
    });
    // draft.reset / draft.update are stable (useCallback with fixed deps);
    // `draft` itself is a fresh object every render and must not be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetScanId, resetScan.data, draft.reset, draft.update]);

  useEffect(() => {
    if (!resetScanId || !resetScan.data) return;
    if (state.scanId === resetScanId) return;
    if (seededResetId.current === resetScanId) return;

    // An empty draft has nothing to lose, so it is seeded straight away.
    if (holdings.length === 0) {
      seedFromReset();
      return;
    }
    setResetConfirmOpen(true);
  }, [resetScanId, resetScan.data, state.scanId, holdings.length, seedFromReset]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">Create scan study</h1>
            <p className="mt-0.5 text-[12px] text-ink-dim">
              Files upload while you work. Submitting records the details against them.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!submitted && holdings.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDiscardOpen(true)}
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

        {/* Only the classic flow has a sequence to show. A stepper over the
            study flow's two surfaces would be narrating a boundary the user
            can already see. */}
        {classic ? (
          <WizardStepper
            current={state.step}
            onSelect={draft.goToStep}
            canSelect={(step) => !submitted && canEnterClassicStep(step, state)}
          />
        ) : null}

        {/* Only the wizard needs this line. On the working surface the files
            panel is on screen the whole time and says the same thing, which is
            how the page ended up stating one fact three times. */}
        {classic && !submitted ? <DraftIndicator files={state.files} /> : null}
      </header>

      {draft.wasRestored && !submitted ? (
        <InlineNotice
          tone="info"
          title="Picked up where you left off"
          action={
            <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(true)}>
              Start fresh
            </Button>
          }
        >
          A saved draft was found in this browser. Files that finished uploading are already in
          storage, and anything that was still transferring picks up where it stopped. Only a file
          this browser no longer holds has to be chosen again — those are listed as such.
        </InlineNotice>
      ) : null}

      {!submitted && draft.draftExpired ? (
        <InlineNotice tone="warn" title={draft.draftExpiredMessage.title}>
          {draft.draftExpiredMessage.body}
        </InlineNotice>
      ) : null}

      {!submitted && draft.blobStorageDegraded ? (
        <InlineNotice tone="warn" title={draft.storageDegradedMessage.title}>
          {draft.storageDegradedMessage.body}
        </InlineNotice>
      ) : null}

      {!submitted && resetScanId && state.scanId === resetScanId ? (
        <InlineNotice tone="info" title={t('createScan.resumingResetTitle')}>
          {t('createScan.resumingResetBody', { title: resetScan.data?.title ?? 'This study' })}
        </InlineNotice>
      ) : null}

      <DiscardDraftDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        holdings={holdings}
        onConfirm={draft.reset}
      />

      {/* Same dialog, same holdings, same irreversibility — the only
          difference is that confirming here hands the emptied draft to the
          study being recovered instead of leaving it blank. Declining leaves
          the open draft exactly as it was; the reset itself already happened
          server-side, so the study stays recoverable from My Scans. */}
      <DiscardDraftDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        holdings={holdings}
        onConfirm={seedFromReset}
      />

      {submitted && state.submitOutcome ? (
        <StepSubmitted
          outcome={state.submitOutcome}
          onCreateAnother={draft.reset}
          // Only offered when the submit landed short: a fully-confirmed
          // study has nothing left to retry, and the draft that would back
          // a retry has already been cleared by `finish()`.
          onTryAgain={isFullySubmitted(state.submitOutcome) ? undefined : draft.resumeSubmit}
        />
      ) : classic ? (
        <ClassicSteps draft={draft} onSubmitted={draft.finish} />
      ) : (
        <StudySurface draft={draft} onSubmitted={draft.finish} />
      )}
    </div>
  );
}

export default CreateScanPage;
