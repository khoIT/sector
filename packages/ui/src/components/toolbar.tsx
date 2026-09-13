import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/**
 * A row for a search box, filter chips and a primary action — the shape the
 * prototype calls `.toolbar` (see the Question Banks and Scan Vault index
 * screens). Deliberately a plain flex row rather than a Radix Toolbar: nothing
 * in it composes interactive widgets that need roving-tabindex arrow-key
 * navigation, which is the entire reason that primitive exists.
 */
export const Toolbar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Toolbar(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-center gap-2 py-3', className)}
      {...props}
    />
  );
});
