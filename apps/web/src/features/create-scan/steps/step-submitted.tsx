import { Button, Card, CardContent, CardHeader, CardTitle, StatusPill } from '@sector/ui';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { scanDetailPathFor } from '@/features/scan-detail/scan-detail-links';
import { SCAN_VAULT_PATH } from '@/features/scan-list/scan-list-views';

import { InlineNotice } from '../components/inline-notice';
import type { SubmitOutcome } from '../model/draft-types';
import { isFullySubmitted } from '../model/submit-outcome';

export type StepSubmittedProps = {
  outcome: SubmitOutcome;
  onCreateAnother: () => void;
  /**
   * Present only when the submit landed short of every intended file. Goes
   * back to the working surface with the draft and its blobs intact, so the
   * next submit resumes against the SAME scan (`state.scanId`) instead of
   * creating a second one.
   */
  onTryAgain?: () => void;
};

/**
 * The confirmation step reports what actually happened, per part.
 *
 * A study can be created, have one file's confirmation fail, and have its
 * expert-review request rejected for want of credits — all at once. Collapsing
 * that into one "Success!" is the lie this flow is trying to stop telling, so
 * each outcome gets its own line and its own next action.
 */
export function StepSubmitted({ outcome, onCreateAnother, onTryAgain }: StepSubmittedProps) {
  const complete = isFullySubmitted(outcome);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {complete ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
            )}
            <div>
              <CardTitle>{outcome.scanTitle ?? 'Study submitted'}</CardTitle>
              <p className="mt-0.5 text-[12px] text-ink-dim">
                {complete
                  ? 'The study is in your vault. Processing and de-identification finish on the server a few seconds from now; the list updates itself.'
                  : 'The study was created, but it does not yet hold every file this draft intended.'}
              </p>
            </div>
          </div>
          <StatusPill
            tone={complete ? 'ok' : 'warn'}
            label={complete ? 'Submitted' : 'Incomplete'}
          />
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <dl className="grid gap-x-6 gap-y-1.5 text-body sm:grid-cols-2">
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-dim">Files attached</dt>
              <dd className="sv-num text-ink">
                {outcome.filesConfirmed} of {outcome.filesTotal}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-dim">Expert review</dt>
              <dd className="text-ink">
                {outcome.expertReview === 'requested'
                  ? 'Requested'
                  : outcome.expertReview === 'failed'
                    ? 'Request failed'
                    : 'Not requested'}
              </dd>
            </div>
          </dl>

          {!complete ? (
            <InlineNotice
              tone="warn"
              title={`${outcome.filesConfirmed} of ${outcome.filesTotal} files attached — the study was not fully submitted`}
              action={
                onTryAgain ? (
                  <Button variant="secondary" size="sm" onClick={onTryAgain}>
                    Try again
                  </Button>
                ) : outcome.scanId ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link to={scanDetailPathFor('my', outcome.scanId)}>Open the study</Link>
                  </Button>
                ) : undefined
              }
            >
              <ul className="flex flex-col gap-0.5">
                {outcome.unconfirmed.map((file) => (
                  <li key={file.name}>
                    <span className="font-medium">{file.name}</span> — {file.message}
                  </li>
                ))}
              </ul>
              The draft and every uploaded file are still here — nothing was thrown away. Try again
              to resume this same study, or open it to see exactly what landed.
            </InlineNotice>
          ) : null}

          {outcome.expertReview === 'failed' ? (
            <InlineNotice
              tone="warn"
              title="The expert review request did not go through"
              action={
                outcome.scanId ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link to={scanDetailPathFor('my', outcome.scanId)}>Open the study</Link>
                  </Button>
                ) : undefined
              }
            >
              {outcome.expertReviewError ?? 'The request was rejected.'} The study itself is saved
              and routed to your groups, and no credit was spent.
            </InlineNotice>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={onCreateAnother}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Create another study
        </Button>
        <Button asChild>
          {/* The study it just made, not the list it is somewhere in. The id
              is right here in the outcome; making the learner find the row
              they cannot yet see was the long way round. */}
          <Link to={outcome.scanId ? scanDetailPathFor('my', outcome.scanId) : SCAN_VAULT_PATH.my}>
            {outcome.scanId ? 'Open the study' : 'Go to my scans'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
