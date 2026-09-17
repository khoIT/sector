import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sector/ui';

import type { LabelledAnswer } from '../model/transfer-findings';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createScan.switchType.title', { type: nextTypeName })}</DialogTitle>
          <DialogDescription>
            {cleared.length === 1
              ? t('createScan.switchType.clearedOne')
              : t('createScan.switchType.clearedMany', { count: cleared.length })}
          </DialogDescription>
        </DialogHeader>

        <AnswerList
          title={
            currentTypeName
              ? t('createScan.switchType.clearedFrom', { type: currentTypeName })
              : t('createScan.switchType.cleared')
          }
          tone="crit"
          answers={cleared}
        />

        {kept.length > 0 ? (
          <AnswerList
            title={t('createScan.switchType.carriedOver', { type: nextTypeName })}
            tone="ok"
            answers={kept}
          />
        ) : null}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            {currentTypeName
              ? t('createScan.switchType.keep', { type: currentTypeName })
              : t('createScan.switchType.keepCurrent')}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {t('createScan.switchType.confirm', { type: nextTypeName })}
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
