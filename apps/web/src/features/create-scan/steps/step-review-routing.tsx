import {
  isApiError,
  useApiClient,
  useScanUserGroups,
  useUserOrganizations,
  userDisplayName,
} from '@scanvault/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@scanvault/ui';
import { ArrowLeft, Send } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/auth/auth-context';

import { ExpertReviewPanel } from '../components/expert-review-panel';
import { InlineNotice } from '../components/inline-notice';
import { StudySummary } from '../components/study-summary';
import type { SubmitOutcome } from '../model/draft-types';
import { defaultGroupCohort } from '../model/group-cohort';
import { anyOrganizationCollectsScanIdentifier } from '../model/identifier-gate';
import { NoStoredFilesError, submitDraft } from '../model/submit-draft';
import { countStored, countTracked } from '../model/file-counts';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';

export type StepReviewRoutingProps = {
  draft: UseCreateScanDraft;
  onBack: () => void;
  onSubmitted: (outcome: SubmitOutcome) => void;
};

export function StepReviewRouting({ draft, onBack, onSubmitted }: StepReviewRoutingProps) {
  const client = useApiClient();
  const { user } = useAuth();
  const { data: groups } = useScanUserGroups();
  const { data: organizations } = useUserOrganizations(user?.id);
  const { state, update } = draft;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stored = countStored(state.files);
  const tracked = countTracked(state.files);
  const stillMoving = tracked - stored;
  const groupIds = state.groupIds ?? defaultGroupCohort(groups);
  const collectsScanIdentifier = anyOrganizationCollectsScanIdentifier(organizations);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const outcome = await submitDraft({
        client,
        state,
        groupIds,
        // Persist the new scan id before the per-file confirmations run, so a
        // failure halfway through resumes on this scan instead of making a
        // second one.
        onScanCreated: (scanId) => update({ scanId }),
      });
      onSubmitted(outcome);
    } catch (error) {
      setSubmitError(
        error instanceof NoStoredFilesError
          ? error.message
          : isApiError(error)
            ? `The study could not be created: ${error.message}`
            : error instanceof Error
              ? error.message
              : 'The study could not be created.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <StudySummary
        state={state}
        onEdit={onBack}
        collectsScanIdentifier={collectsScanIdentifier}
      />

      {user ? (
        <ExpertReviewPanel
          userId={user.id}
          userName={userDisplayName(user)}
          value={state.expertReview}
          onChange={(expertReview) => update({ expertReview })}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Submit</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            Your files are already in storage. Submitting records the study's details against them —
            it does not start another upload.
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">

          {stillMoving > 0 ? (
            <InlineNotice
              tone="warn"
              title={`${stillMoving} ${stillMoving === 1 ? 'file has' : 'files have'} not finished uploading`}
              action={
                <Button variant="secondary" size="sm" onClick={onBack}>
                  Back to the study
                </Button>
              }
            >
              Submitting now creates the study with the {stored} already in storage and leaves the
              rest out. Wait for them to finish, or go back and deal with the ones that failed.
            </InlineNotice>
          ) : null}

          {stored === 0 ? (
            <InlineNotice
              tone="crit"
              title="Nothing is in storage yet"
              action={
                <Button variant="secondary" size="sm" onClick={onBack}>
                  Back to the study
                </Button>
              }
            >
              A study cannot be created without at least one uploaded file — the API rejects a file
              total of zero.
            </InlineNotice>
          ) : null}

          {/* The server requires a scan type and the findings are keyed to it,
              so a study submitted without one is unreviewable. The working
              surface lets you reach this screen without it deliberately — this
              is where it is named. */}
          {!state.scanTypeId ? (
            <InlineNotice
              tone="crit"
              title="No exam type chosen"
              action={
                <Button variant="secondary" size="sm" onClick={onBack}>
                  Choose exam type
                </Button>
              }
            >
              A study needs an exam type: it decides which findings a reviewer is asked, and it
              cannot be changed once the study exists.
            </InlineNotice>
          ) : null}

          {submitError ? (
            <InlineNotice
              tone="crit"
              title="The study was not submitted"
              action={
                <Button variant="secondary" size="sm" onClick={() => void submit()}>
                  Try again
                </Button>
              }
            >
              {submitError} Your uploaded files are still in storage and this draft is saved, so
              nothing has to be re-done.
            </InlineNotice>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the study
        </Button>
        <Button
          onClick={() => void submit()}
          disabled={submitting || stored === 0 || !state.scanTypeId}
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {submitting ? 'Recording the study…' : 'Submit study'}
        </Button>
      </div>
    </div>
  );
}
