import {
  isApiError,
  reviewKeys,
  scanKeys,
  useApiClient,
  useFindingDefinitions,
  useScanUserGroups,
} from '@sector/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { Button, cn } from '@sector/ui';
import { ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAuth } from '@/auth/auth-context';

import type { SubmitOutcome } from '../model/draft-types';
import { countStored, countTracked } from '../model/file-counts';
import { missingRequiredFindings } from '../model/finding-controls';
import { defaultGroupCohort } from '../model/group-cohort';
import type { ReadinessItem } from '../model/readiness';
import { submitBlockers } from '../model/readiness';
import { submitFacts } from '../model/submit-facts';
import { NoStoredFilesError, submitDraft } from '../model/submit-draft';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import { SubmitConfirmDialog } from './submit-confirm-dialog';

export type CommitBarProps = {
  draft: UseCreateScanDraft;
  readiness: readonly ReadinessItem[];
  onSubmitted: (outcome: SubmitOutcome) => void;
};

/**
 * What is still missing, and the one button that ends the study.
 *
 * There is no review screen behind this any more. That screen restated the
 * exam type, the file count, the findings and the identifiers — all of which
 * are on the surface it was covering — so the only part worth keeping was the
 * pause before an irreversible act, and a dialog does that without a
 * navigation.
 *
 * Submit is never disabled. A study missing something is stopped at the
 * confirm, where the reason can be read, rather than by a grey button that
 * explains nothing.
 */
export function CommitBar({ draft, readiness, onSubmitted }: CommitBarProps) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { state, update } = draft;
  const { data: groups } = useScanUserGroups();
  const { data: definitions } = useFindingDefinitions(state.scanTypeId, state.organizationId);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const groupIds = state.groupIds ?? defaultGroupCohort(groups);
  // Memoised because it feeds a memo: a fresh array every render would defeat
  // the one below it.
  const groupNames = useMemo(
    () =>
      groupIds
        .map((id) => groups?.find((group) => group.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    [groupIds, groups],
  );
  const blockers = submitBlockers(readiness);

  const facts = useMemo(() => {
    const items = definitions?.items ?? [];
    return submitFacts({
      scanTypeName: state.scanTypeName,
      stored: countStored(state.files),
      tracked: countTracked(state.files),
      answered: Object.values(state.findings).filter((value) => value).length,
      definitions: items.length,
      missingRequired: missingRequiredFindings(items, state.findings).length,
      groupNames,
      expertReviewLabel: state.expertReview?.label ?? null,
    });
  }, [state, definitions, groupNames]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const outcome = await submitDraft({
        client,
        state,
        groupIds,
        // Named, not counted: the submission email lists them, and an id in an
        // email tells the reader nothing.
        groupNames,
        userId: user?.id ?? '',
        // Persist the new scan id before the per-file confirmations run, so a
        // failure halfway through resumes on this scan instead of making a
        // second one.
        onScanCreated: (scanId) => update({ scanId }),
      });
      // submitDraft calls the review endpoint directly rather than through
      // useRequestExpertScanReview, so nothing has invalidated the balance it
      // just spent, or the list the new study belongs in.
      void queryClient.invalidateQueries({ queryKey: reviewKeys.credits() });
      void queryClient.invalidateQueries({ queryKey: scanKeys.listRoot('my') });
      onSubmitted(outcome);
    } catch (error) {
      setSubmitError(
        error instanceof NoStoredFilesError
          ? error.message
          : isApiError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : 'The study could not be created.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-token border border-line',
          'bg-surface-2 px-3 py-2',
        )}
      >
        <p className="min-w-0 flex-1 text-[12px] text-ink-dim">
          {/* Only files and an exam type ever block. Findings and the note are
              advisory, so "ready" is the honest claim on the other branch —
              the confirm names anything still blank before it is acted on. */}
          {blockers.length > 0 ? (
            <>
              Still needed:{' '}
              <span className="text-ink">
                {blockers.map((item) => item.label.toLowerCase()).join(', ')}
              </span>
            </>
          ) : (
            <span className="text-ok">Ready to submit.</span>
          )}
        </p>

        <Button size="sm" onClick={() => setConfirmOpen(true)}>
          Review &amp; submit
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>

      <SubmitConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        facts={facts}
        submitting={submitting}
        error={submitError}
        onConfirm={() => void submit()}
      />
    </>
  );
}
