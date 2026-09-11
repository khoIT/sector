import type { HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Loading placeholder. Respects prefers-reduced-motion (the pulse is disabled
 * in tokens.css). Give it explicit width/height classes at the call site.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('sv-skeleton rounded-token bg-surface-2', className)}
      {...props}
    />
  );
}

export type SkeletonTableProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

/**
 * Row-shaped skeletons sized to a table. Render it inside <TableBody> replaced
 * by real rows once data arrives, so the list does not jump.
 */
export function SkeletonTable({ rows = 6, columns = 5, className }: SkeletonTableProps) {
  return (
    <div className={cn('flex flex-col gap-2 p-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-3">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-4 flex-1', columnIndex === 0 && 'max-w-[36%] flex-[2]')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
