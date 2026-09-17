import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@sector/ui';
import { Send } from 'lucide-react';

import { InlineNotice } from './inline-notice';
import { useTranslation } from 'react-i18next';

export type SubmitFact = {
  label: string;
  value: string;
  /** Drawn in the warning colour: true but not what the learner intended. */
  concerning?: boolean;
};

export type SubmitConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facts: readonly SubmitFact[];
  submitting: boolean;
  error: string | null;
  onConfirm: () => void;
};

/**
 * What is about to be sent, and the last chance to stop.
 *
 * This replaced a whole second screen. Everything that screen restated was
 * already on the surface behind it, so the only thing worth keeping was the
 * pause before an irreversible act — and the parts that are irreversible are
 * exactly what this lists.
 *
 * Group routing is named here because the API has no route that adds a group
 * to an existing scan, and the summary it replaced never mentioned groups at
 * all: a learner could submit a study to nobody and only find out later.
 */
export function SubmitConfirmDialog({
  open,
  onOpenChange,
  facts,
  submitting,
  error,
  onConfirm,
}: SubmitConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createScan.submitConfirm.title')}</DialogTitle>
          <DialogDescription>{t('createScan.submitConfirm.blurb')}</DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex items-start gap-3 border-b border-line py-2 last:border-b-0"
            >
              <dt className="w-32 shrink-0 text-[12px] text-ink-dim">{fact.label}</dt>
              <dd
                className={cn(
                  'min-w-0 flex-1 text-body font-medium',
                  fact.concerning ? 'text-warn' : 'text-ink',
                )}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        {error ? (
          <InlineNotice tone="crit" title={t('createScan.submitConfirm.error')}>
            {error}
          </InlineNotice>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('createScan.submitConfirm.keepEditing')}
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            <Send className="h-3.5 w-3.5" aria-hidden />
            {submitting
              ? t('createScan.submitConfirm.submitting')
              : t('createScan.submitConfirm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
