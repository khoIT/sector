import * as TabsPrimitive from '@radix-ui/react-tabs';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

import { cn } from '../lib/cn';

/**
 * Radix Tabs, token-styled with an underline active state in --accent-ink.
 *
 * Route-driven tab bars (the Scan Vault tab strip) should NOT use Radix's
 * internal state: render <Tabs value={activeRoute}> and navigate from
 * onValueChange, so the URL stays the single source of truth.
 */
export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'flex items-stretch gap-1 overflow-x-auto border-b border-line',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2',
        'text-body font-medium text-ink-dim outline-none transition-colors',
        'hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-ink',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:text-accent-ink',
        'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent',
        'data-[state=active]:after:bg-accent-ink',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('outline-none focus-visible:ring-2 focus-visible:ring-accent-ink', className)}
      {...props}
    />
  );
});
