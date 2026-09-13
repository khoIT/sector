import { cn } from '@sector/ui';
import { Check } from 'lucide-react';

import { CLASSIC_STEPS, WIZARD_STEP_LABEL, type WizardStep } from '../model/draft-types';

/** The ordered steps plus the receipt: what the classic wizard walks through. */
const STEPS: readonly WizardStep[] = [...CLASSIC_STEPS, 'submitted'];

export type WizardStepperProps = {
  current: WizardStep;
  /** Steps the user may jump to. Without it every step is inert. */
  onSelect?: (step: WizardStep) => void;
  canSelect?: (step: WizardStep) => boolean;
};

/**
 * Where you are in the classic wizard, and what you can jump to.
 *
 * Only the classic flow has one. The study flow's surfaces are not a sequence
 * — a stepper over two items would be telling the user about a boundary they
 * can already see.
 */
export function WizardStepper({ current, onSelect, canSelect }: WizardStepperProps) {
  const currentIndex = STEPS.indexOf(current);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const selectable = Boolean(onSelect) && (canSelect?.(step) ?? done);

        const content = (
          <>
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                active && 'bg-accent text-scan-ground',
                done && 'bg-ok-soft text-ok',
                !active && !done && 'bg-surface-2 text-ink-dim',
              )}
            >
              {done ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span className={cn('text-[12px]', active ? 'font-semibold text-ink' : 'text-ink-dim')}>
              {WIZARD_STEP_LABEL[step]}
            </span>
          </>
        );

        return (
          <li key={step} className="flex items-center gap-2">
            {selectable ? (
              <button
                type="button"
                onClick={() => onSelect?.(step)}
                className="flex items-center gap-1.5 rounded-token px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                aria-current={active ? 'step' : undefined}
              >
                {content}
              </button>
            ) : (
              <span
                className="flex items-center gap-1.5 px-1 py-0.5"
                aria-current={active ? 'step' : undefined}
              >
                {content}
              </span>
            )}
            {index < STEPS.length - 1 ? (
              <span aria-hidden className="h-px w-5 bg-line sm:w-8" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
