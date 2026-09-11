import * as SelectPrimitive from '@radix-ui/react-select';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * Radix Select, token-styled. Compose it the Radix way:
 *
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger placeholder="Any status" />
 *     <SelectContent>
 *       <SelectItem value="pending">Pending</SelectItem>
 *     </SelectContent>
 *   </Select>
 */
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export type SelectTriggerProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
  /** Shown when nothing is selected. Renders a <SelectValue> for you. */
  placeholder?: string;
};

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(function SelectTrigger({ className, children, placeholder, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex h-8 w-full items-center justify-between gap-2 rounded-token border border-line',
        'bg-surface px-2.5 text-body text-ink outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:border-accent-ink',
        'data-[placeholder]:text-ink-dim disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children ?? <SelectValue placeholder={placeholder} />}
      <SelectPrimitive.Icon asChild>
        <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60">
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-token border border-line bg-surface',
          'text-ink shadow-lg shadow-black/10',
          position === 'popper' && 'translate-y-1',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="max-h-72 p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn('px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-dim', className)}
      {...props}
    />
  );
});

export type SelectItemProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
  children: ReactNode;
};

export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, SelectItemProps>(
  function SelectItem({ className, children, ...props }, ref) {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex cursor-pointer select-none items-center rounded-[calc(var(--radius)-4px)]',
          'py-1.5 pl-2 pr-7 text-body outline-none',
          'data-[highlighted]:bg-surface-2 data-[state=checked]:text-accent-ink',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
          <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5">
            <path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </SelectPrimitive.ItemIndicator>
      </SelectPrimitive.Item>
    );
  },
);

export const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-line', className)}
      {...props}
    />
  );
});
