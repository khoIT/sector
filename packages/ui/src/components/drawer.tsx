import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

import { cn } from '../lib/cn';
import { DialogClose, DialogOverlay } from './dialog';
import { drawerContentClass, type DrawerSide } from './drawer-position';

/**
 * A side-sheet variant of <Dialog>: same Radix root (focus trap, ESC to
 * close, portal), a panel pinned to an edge instead of centred. Used for
 * secondary panels that want more room than a centred dialog without leaving
 * the page — a filter panel, a review sidebar.
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;

export type DrawerContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: DrawerSide;
  hideCloseButton?: boolean;
};

export const DrawerContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  function DrawerContent({ className, children, side = 'right', hideCloseButton, ...props }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            drawerContentClass(side),
            'z-50 overflow-y-auto border-line bg-surface p-4 text-ink shadow-xl shadow-black/20 outline-none',
            side === 'right' ? 'border-l' : 'border-r',
            className,
          )}
          {...props}
        >
          {children}
          {hideCloseButton ? null : (
            <DialogClose
              aria-label="Close"
              className={cn(
                'absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-token',
                'text-ink-dim outline-none transition-colors hover:bg-surface-2 hover:text-ink',
                'focus-visible:ring-2 focus-visible:ring-accent-ink',
              )}
            >
              <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </DialogClose>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);

export { DialogDescription as DrawerDescription, DialogTitle as DrawerTitle } from './dialog';
