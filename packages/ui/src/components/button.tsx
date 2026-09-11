import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/**
 * `primary` is the only orange fill in the system. Its label is --scan-ground,
 * not --ink: the near-black is the one colour that clears AA on the orange in
 * BOTH themes (light --ink would drop to 2.4:1 once the palette flips).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-token font-medium ' +
    'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-scan-ground hover:brightness-95 active:brightness-90',
        secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface',
        ghost: 'bg-transparent text-ink hover:bg-surface-2',
        link: 'bg-transparent text-accent-ink underline underline-offset-2 hover:no-underline px-0',
        danger: 'bg-crit-soft text-crit border border-crit/30 hover:brightness-95',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-8 px-3 text-body',
        lg: 'h-10 px-4 text-[14px]',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Render the single child element instead of a <button>, keeping styles. */
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      // A bare <button> inside a form defaults to submit, which is a common
      // accidental-submit bug. Only set it when we are really a <button>.
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
});

export { buttonVariants };
