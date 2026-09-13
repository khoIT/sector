import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { EmptyState } from './empty-state';

export type EmptyGridProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'crit';
  className?: string;
};

/**
 * The "nothing here" state for a card grid (question banks, courses) rather
 * than a table — a thin wrapper over <EmptyState> that spans every column of
 * the CSS grid it sits in, so it does not collapse into one narrow cell.
 * Give the grid container `className="grid ..."` and drop this in as a
 * sibling of the cards; `col-span-full` does the rest.
 */
export function EmptyGrid({ className, ...props }: EmptyGridProps) {
  return <EmptyState className={cn('col-span-full', className)} {...props} />;
}
