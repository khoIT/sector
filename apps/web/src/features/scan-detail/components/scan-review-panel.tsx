import type { ReviewCompetencyMeasure, Scan } from '@scanvault/api-client';
import { isApiError, useAddScanReviewMutation } from '@scanvault/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from '@scanvault/ui';
import { useEffect, useRef, useState } from 'react';

import {
  clearReviewDraft,
  draftHasContent,
  readReviewDraft,
  writeReviewDraft,
} from '../review-draft-store';
import { findLearnerQuestion, noteAuthorName } from '../scan-detail-format';
import { LearnerQuestionCallout } from './learner-question-callout';
import { ReviewCustomReviews, type CustomReviewEntry } from './review-custom-reviews';

/** How long the reviewer must pause before the draft is written to storage. */
const DRAFT_SAVE_DEBOUNCE_MS = 600;

type ScanReviewPanelProps = {
  scan: Scan;
  /** True on the expert queue: it also unlocks re-reviewing a reviewed scan. */
  isExpertScan: boolean;
  onSubmitted: (scanId: string) => void;
};

type FormState = {
  competencyMeasure: ReviewCompetencyMeasure | null;
  overAllFeed: string;
  technicalFeed: string;
  teachingPoints: string;
  note: string;
  customReviews: CustomReviewEntry[];
};

function emptyForm(scan: Scan): FormState {
  return {
    competencyMeasure: null,
    overAllFeed: '',
    technicalFeed: '',
    teachingPoints: '',
    note: '',
    // An expert re-review starts from the group reviewer's questions so the
    // expert edits them rather than retyping them.
    customReviews: scan.review?.customReviews?.map((entry) => ({ ...entry })) ?? [],
  };
}

/** The reviewer's form. */
export function ScanReviewPanel({ scan, isExpertScan, onSubmitted }: ScanReviewPanelProps) {
  const [form, setForm] = useState<FormState>(() => {
    const draft = readReviewDraft(scan.id);
    if (!draft) return emptyForm(scan);
    return {
      competencyMeasure: draft.competencyMeasure ?? null,
      overAllFeed: draft.overAllFeed ?? '',
      technicalFeed: draft.technicalFeed ?? '',
      teachingPoints: draft.teachingPoints ?? '',
      note: draft.note ?? '',
      customReviews: draft.customReviews?.map((entry) => ({ ...entry })) ?? emptyForm(scan).customReviews,
    };
  });
  const [restoredAt] = useState(() => readReviewDraft(scan.id)?.savedAt ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(restoredAt);
  const [showErrors, setShowErrors] = useState(false);

  const addReview = useAddScanReviewMutation();
  // Skips the autosave on the very first render, so opening a scan and walking
  // away never fabricates an empty draft.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (!draftHasContent(form)) {
        clearReviewDraft(scan.id);
        setSavedAt(null);
        return;
      }
      setSavedAt(writeReviewDraft(scan.id, form));
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [form, scan.id]);

  const learnerQuestion = findLearnerQuestion(scan, scan.notes);
  const competencyMissing = showErrors && !form.competencyMeasure;
  const overallMissing = showErrors && !form.overAllFeed.trim();

  async function submit() {
    setShowErrors(true);
    if (!form.competencyMeasure || !form.overAllFeed.trim()) return;

    try {
      const review = await addReview.mutateAsync({
        scanId: scan.id,
        payload: {
          competencyMeasure: form.competencyMeasure,
          overAllFeed: form.overAllFeed.trim(),
          technicalFeed: form.technicalFeed.trim(),
          teachingPoints: form.teachingPoints.trim(),
          note: form.note.trim() || undefined,
          // Blank rows are the reviewer changing their mind, not data.
          customReviews: form.customReviews.filter(
            (entry) => entry.question.trim() && entry.answer.trim(),
          ),
          isExpertScan,
        },
      });

      clearReviewDraft(scan.id);
      onSubmitted(review.scan);
    } catch {
      // Rendered below. The draft is left in place so a failed submit — an
      // expired token, a lost connection — never costs the written feedback.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isExpertScan ? 'Expert review' : 'Review'}</CardTitle>
        <DraftStatus savedAt={savedAt} onDiscard={() => {
          clearReviewDraft(scan.id);
          setForm(emptyForm(scan));
          setSavedAt(null);
          setShowErrors(false);
        }} />
      </CardHeader>

      <CardContent className="space-y-4">
        {learnerQuestion ? (
          <LearnerQuestionCallout
            note={learnerQuestion.note}
            author={noteAuthorName(learnerQuestion.user)}
            createdAt={learnerQuestion.createdAt}
          />
        ) : null}

        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-ink-dim">
            Competency measure <span className="text-crit">*</span>
          </legend>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ['achieved', 'Achieved'],
                ['not_achieved', 'Not achieved'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5 text-body text-ink">
                <input
                  type="radio"
                  name={`competency-${scan.id}`}
                  value={value}
                  checked={form.competencyMeasure === value}
                  onChange={() => setForm((prev) => ({ ...prev, competencyMeasure: value }))}
                  className="accent-[var(--accent)]"
                />
                {label}
              </label>
            ))}
          </div>
          {competencyMissing ? (
            <p className="text-[12px] text-crit">Choose achieved or not achieved.</p>
          ) : null}
        </fieldset>

        <Textarea
          label={
            <>
              Overall feedback <span className="text-crit">*</span>
            </>
          }
          rows={5}
          value={form.overAllFeed}
          onChange={(event) => setForm((prev) => ({ ...prev, overAllFeed: event.target.value }))}
          error={overallMissing ? 'Overall feedback is required.' : undefined}
        />

        <Textarea
          label="Technical feedback"
          hint="Probe handling, gain, depth, orientation."
          rows={3}
          value={form.technicalFeed}
          onChange={(event) => setForm((prev) => ({ ...prev, technicalFeed: event.target.value }))}
        />

        <Textarea
          label="Teaching points"
          rows={3}
          value={form.teachingPoints}
          onChange={(event) => setForm((prev) => ({ ...prev, teachingPoints: event.target.value }))}
        />

        <ReviewCustomReviews
          entries={form.customReviews}
          suggestions={scan.scanType.questions}
          disabled={addReview.isPending}
          onChange={(customReviews) => setForm((prev) => ({ ...prev, customReviews }))}
        />

        <Textarea
          label="Note to the learner (optional)"
          hint="Posted to the note thread as well as emailed with the review."
          rows={2}
          value={form.note}
          onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
        />

        {addReview.isError ? (
          <p className="rounded-token border border-crit/30 bg-crit-soft p-2 text-[12px] text-crit">
            {isApiError(addReview.error) ? addReview.error.message : 'Could not submit the review.'}
          </p>
        ) : null}

        <Button className="w-full" disabled={addReview.isPending} onClick={() => void submit()}>
          {addReview.isPending ? 'Submitting…' : 'Submit review'}
        </Button>
      </CardContent>
    </Card>
  );
}

function DraftStatus({ savedAt, onDiscard }: { savedAt: number | null; onDiscard: () => void }) {
  if (!savedAt) return null;

  return (
    <span className="flex items-center gap-2 text-[11px] text-ink-dim">
      Draft saved {new Date(savedAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}
      <Button variant="link" size="sm" className="h-auto text-[11px]" onClick={onDiscard}>
        Discard
      </Button>
    </span>
  );
}
