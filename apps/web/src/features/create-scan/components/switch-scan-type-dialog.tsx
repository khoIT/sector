import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@scanvault/ui';

import type { LabelledAnswer } from '../model/transfer-findings';

export type SwitchScanTypeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTypeName: string;
  nextTypeName: string;
  kept: readonly LabelledAnswer[];
  cleared: readonly LabelledAnswer[];
  onConfirm: () => void;
};

/**
 * Confirm a scan-type change that would discard answers.
 *
 * It names them. "4 answers will be cleared" does not let anyone judge whether
 * to proceed; "LV systolic function — Normal" does, because the learner can
 * see at a glance whether it was the one that took ten minutes to decide.
 *
 * The loss comes first and the survivors second, which is the opposite of the
 * usual ordering and is what the data asks for: measured across every pair of
 * v2 scan types, 28 of 4,655 answered rows transfer. Scan types share almost
 * nothing, so on nearly every switch the kept list is empty and the cleared
 * list is the entire message.
 *
 * This dialog only appears when something is actually lost. A switch with
 * nothing answered, or with everything transferable, applies straight away.
 */
export function SwitchScanTypeDialog({
  open,
  onOpenChange,
  currentTypeName,
  nextTypeName,
  kept,
  cleared,
  onConfirm,
}: SwitchScanTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to {nextTypeName}?</DialogTitle>
          <DialogDescription>
            {cleared.length === 1
              ? 'One answer has no equivalent on the new scan type and will be cleared.'
              : `${cleared.length} answers have no equivalent on the new scan type and will be cleared.`}
          </DialogDescription>
        </DialogHeader>

        <AnswerList
          title={`Cleared${currentTypeName ? ` from ${currentTypeName}` : ''}`}
          tone="crit"
          answers={cleared}
        />

        {kept.length > 0 ? (
          <AnswerList title={`Carried over to ${nextTypeName}`} tone="ok" answers={kept} />
        ) : null}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Keep {currentTypeName || 'the current type'}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Switch to {nextTypeName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnswerList({
  title,
  tone,
  answers,
}: {
  title: string;
  tone: 'crit' | 'ok';
  answers: readonly LabelledAnswer[];
}) {
  if (answers.length === 0) return null;

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h3
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          tone === 'crit' ? 'text-crit' : 'text-ok'
        }`}
      >
        {title}
      </h3>
      {/* Scrolls rather than growing: a fully answered study can carry 40 rows,
          and a dialog taller than the viewport hides its own buttons. */}
      <ul className="max-h-[34dvh] divide-y divide-line overflow-y-auto rounded-token border border-line">
        {answers.map((answer) => (
          <li key={answer.key} className="flex gap-2 px-3 py-1.5 text-body">
            <span className="min-w-0 flex-1 truncate text-ink" title={answer.name}>
              {answer.name}
            </span>
            <span className="min-w-0 max-w-[45%] truncate text-ink-dim" title={answer.value}>
              {answer.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
