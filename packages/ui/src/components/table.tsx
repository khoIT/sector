import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';

import { cn } from '../lib/cn';
import { TABLE_SCROLL_CONTAINER_CLASS } from './table-scroll-container';

/**
 * Unopinionated table primitives. They render real <table> semantics and carry
 * no data logic, so a TanStack Table flexRender loop drops straight in.
 *
 * Set `numeric` on Th/Td for figures: it right-aligns and switches on
 * tabular-nums so columns line up across rows.
 */
export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  ref,
) {
  return (
    <div className={TABLE_SCROLL_CONTAINER_CLASS}>
      <table
        ref={ref}
        className={cn('w-full border-collapse text-body text-ink', className)}
        {...props}
      />
    </div>
  );
});

export const TableHead = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableHead({ className, ...props }, ref) {
  return <thead ref={ref} className={cn('bg-surface-2', className)} {...props} />;
});

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={className} {...props} />;
});

export type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  /** Adds hover + pointer affordance. Pair it with an onClick row handler. */
  interactive?: boolean;
  selected?: boolean;
};

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow(
  { className, interactive, selected, ...props },
  ref,
) {
  return (
    <tr
      ref={ref}
      data-selected={selected ? '' : undefined}
      className={cn(
        'border-b border-line last:border-b-0',
        interactive && 'cursor-pointer hover:bg-surface-2',
        selected && 'bg-accent-soft',
        className,
      )}
      {...props}
    />
  );
});

export type TableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export const TableHeaderCell = forwardRef<HTMLTableCellElement, TableHeaderCellProps>(
  function TableHeaderCell({ className, numeric, ...props }, ref) {
    return (
      <th
        ref={ref}
        scope="col"
        className={cn(
          'border-b border-line px-3 py-2 text-left align-middle',
          'text-[11px] font-semibold uppercase tracking-wide text-ink-dim',
          numeric && 'sv-num text-right',
          className,
        )}
        {...props}
      />
    );
  },
);

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell(
  { className, numeric, ...props },
  ref,
) {
  return (
    <td
      ref={ref}
      className={cn('px-3 py-2 align-middle', numeric && 'sv-num text-right', className)}
      {...props}
    />
  );
});

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn('px-3 py-2 text-left text-[12px] text-ink-dim', className)}
      {...props}
    />
  );
});
