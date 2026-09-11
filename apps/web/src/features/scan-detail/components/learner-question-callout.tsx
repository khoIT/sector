import { MessageCircleQuestion } from 'lucide-react';

import { formatDateTime } from '@/lib/format';

type LearnerQuestionCalloutProps = {
  note: string;
  author: string;
  createdAt: string;
};

/**
 * The learner's question, pinned to the top of the reviewer's panel.
 *
 * On the legacy dashboard this sat inside a collapsed "Notes" accordion below
 * the review form, so the one thing the learner actually asked was the last
 * thing a reviewer saw — and routinely went unanswered. It is the first thing
 * here, above the form, because the answer belongs in the feedback fields
 * directly beneath it.
 */
export function LearnerQuestionCallout({ note, author, createdAt }: LearnerQuestionCalloutProps) {
  return (
    <div className="rounded-token border border-accent-ink/25 bg-accent-soft p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-ink">
        <MessageCircleQuestion className="h-4 w-4" aria-hidden />
        Learner asked
      </p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-body text-ink">{note}</p>
      <p className="mt-1.5 text-[11px] text-ink-dim">
        {author} · {formatDateTime(createdAt)}
      </p>
    </div>
  );
}
