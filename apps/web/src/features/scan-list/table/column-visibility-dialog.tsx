import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@sector/ui';
import { Columns3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ListColumn } from './column-model';

export type ColumnVisibilityDialogProps<TRow> = {
  columns: Array<ListColumn<TRow>>;
  hidden: ReadonlySet<string>;
  onChange: (hidden: string[]) => void;
  onReset: () => void;
};

/**
 * Column visibility.
 *
 * A dialog rather than a dropdown because the queue tables carry up to nine
 * columns and the list needs to stay readable on a phone, where a menu
 * anchored to a toolbar button would run off the edge.
 *
 * Choices persist per user and per view (see column-visibility-store), so a
 * reviewer who hides Tags does not get it back on every navigation the way the
 * legacy table did — its visibility lived in component state and reset on
 * every remount.
 */
export function ColumnVisibilityDialog<TRow>({
  columns,
  hidden,
  onChange,
  onReset,
}: ColumnVisibilityDialogProps<TRow>) {
  const { t } = useTranslation();
  const hiddenCount = columns.filter(
    (column) => !column.alwaysVisible && hidden.has(column.id),
  ).length;

  function toggle(id: string, visible: boolean) {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Columns3 className="h-4 w-4" aria-hidden />
          {t('toolbar.columns')}
          {hiddenCount > 0 ? (
            <span className="sv-num text-ink-dim">{t('toolbar.columnsHidden', { count: hiddenCount })}</span>
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('toolbar.columns')}</DialogTitle>
          <DialogDescription>Choose what this table shows.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 py-1">
          {columns.map((column) => {
            const isVisible = column.alwaysVisible || !hidden.has(column.id);
            return (
              <label
                key={column.id}
                className="flex cursor-pointer items-center gap-2 rounded-token px-2 py-1.5 text-body hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                  checked={isVisible}
                  disabled={column.alwaysVisible}
                  onChange={(event) => toggle(column.id, event.target.checked)}
                />
                <span className={column.alwaysVisible ? 'text-ink-dim' : 'text-ink'}>
                  {column.header}
                </span>
                {column.alwaysVisible ? (
                  <span className="ml-auto text-[11px] text-ink-dim">always shown</span>
                ) : null}
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
