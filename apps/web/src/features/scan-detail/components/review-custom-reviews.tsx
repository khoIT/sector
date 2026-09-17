import { Button, Textarea } from '@sector/ui';
import { Plus, X } from 'lucide-react';

import { QuestionSuggestInput } from './question-suggest-input';
import { useTranslation } from 'react-i18next';

export type CustomReviewEntry = { question: string; answer: string };

type ReviewCustomReviewsProps = {
  entries: CustomReviewEntry[];
  onChange: (entries: CustomReviewEntry[]) => void;
  /** `scanType.questions` — the organisation's standard questions, if any. */
  suggestions?: readonly string[];
  disabled?: boolean;
};

/**
 * Free-form question/answer pairs attached to a review.
 *
 * Some organisations code their exports against these, so the question text
 * matters: the scan type's standard questions are offered as suggestions to
 * keep wording consistent across reviewers, while still allowing anything.
 */
export function ReviewCustomReviews({
  entries,
  onChange,
  suggestions,
  disabled,
}: ReviewCustomReviewsProps) {
  const { t } = useTranslation();
  function update(index: number, field: keyof CustomReviewEntry, value: string) {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-ink-dim">{t('scanDetail.custom.title')}</p>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...entries, { question: '', answer: '' }])}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('scanDetail.custom.add')}
        </Button>
      </div>

      {entries.length === 0 ? null : (
        <ol className="space-y-2">
          {entries.map((entry, index) => (
            // Index-keyed on purpose: these rows have no id and are identified
            // only by position, which is also how the server stores them.
            <li
              key={index}
              className="space-y-2 rounded-token border border-line bg-surface-2 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-dim">
                  {t('scanDetail.custom.question', { number: index + 1 })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('scanDetail.custom.remove', { number: index + 1 })}
                  disabled={disabled}
                  onClick={() => onChange(entries.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4 text-crit" aria-hidden />
                </Button>
              </div>

              <QuestionSuggestInput
                label={t('scanDetail.custom.questionLabel')}
                placeholder={t('scanDetail.custom.questionPlaceholder')}
                value={entry.question}
                suggestions={suggestions}
                onChange={(value) => update(index, 'question', value)}
              />

              <Textarea
                label={t('scanDetail.custom.answerLabel')}
                rows={2}
                value={entry.answer}
                disabled={disabled}
                onChange={(event) => update(index, 'answer', event.target.value)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
