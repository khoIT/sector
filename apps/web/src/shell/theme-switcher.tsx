import { cn, useTheme, type ThemePreference } from '@sector/ui';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

type Option = { value: ThemePreference; label: string; Icon: LucideIcon };

/**
 * `system` is a real third state, not "whatever we defaulted to": it removes
 * data-theme from <html> so the OS preference keeps driving the palette after
 * the user flips it. A two-way toggle cannot express that, which is why this
 * is a three-way control.
 */
const OPTIONS: readonly Option[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-token border border-line bg-surface-2 p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            title={value === 'system' ? `System (currently ${resolvedTheme})` : `${label} theme`}
            className={cn(
              'flex h-6 w-7 items-center justify-center rounded-[5px] transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-1',
              'focus-visible:ring-offset-surface-2',
              active
                ? 'bg-surface text-accent-ink'
                : 'text-ink-dim hover:bg-surface hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">
              {value === 'system' ? `System theme, currently ${resolvedTheme}` : `${label} theme`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
