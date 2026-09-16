import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { filterComboboxOptions, nextHighlight, type ComboboxOption } from './combobox-filter';

export type { ComboboxOption } from './combobox-filter';

/**
 * An option's picture, shown only in lists that have them.
 *
 * Falls back to an empty slot of the same size when the image is missing or
 * fails to load — a presigned URL can expire while the popover sits open — so
 * the labels in a list stay on one vertical line either way.
 */
function OptionThumb({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className="h-6 w-6 shrink-0 rounded-token bg-surface-2" aria-hidden />;
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-6 w-6 shrink-0 rounded-token bg-surface-2 object-contain p-0.5"
    />
  );
}

export type ComboboxProps = {
  /** Small label inside the trigger, above the value. */
  label: string;
  options: readonly ComboboxOption[];
  /** Chosen values. One entry unless `multiple`. */
  selected: readonly string[];
  onSelect: (value: string) => void;
  /** What the trigger reads. Defaults to the selected option's label. */
  display?: string;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Keeps the popover open after a pick, and shows a tick per row. */
  multiple?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Rendered before the value, e.g. a small status dot. */
  icon?: ReactNode;
  className?: string;
};

/**
 * A searchable single- or multi-select.
 *
 * Not `<Select>`: that is a native-feeling list with no search, which is fine
 * for five options and useless for twenty-two. Not `<DropdownMenu>` either —
 * Radix menus claim printable keys for typeahead, so a text input inside one
 * never receives what is typed.
 *
 * The popover is plain absolute positioning rather than a portal. Every use is
 * inside a normal document flow near the top of its container, and a portal
 * would cost a positioning dependency the package does not otherwise carry.
 */
export function Combobox({
  label,
  options,
  selected,
  onSelect,
  display,
  placeholder = 'Choose…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'Nothing matches.',
  multiple = false,
  loading = false,
  disabled = false,
  icon,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const visible = useMemo(() => filterComboboxOptions(options, query), [options, query]);

  // Reserve the picture column for the whole list, not per row: a scan-type
  // list is all icons, a group list has none, and mixing the two inside one
  // list would step the labels in and out as the search narrows.
  const showThumbs = useMemo(() => options.some((option) => option.imageUrl), [options]);

  // Reopening should start clean rather than resuming someone's half-typed
  // search from minutes ago.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(-1);
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    // Document level, not on the search input: in a multi-select the focus
    // moves to the option button as soon as one is ticked, and an Escape that
    // only works while the caret is in the search box is an Escape that stops
    // working the moment the control is used.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const chosen = options.find((option) => selected.includes(option.value));
  const triggerText = display ?? chosen?.label ?? placeholder;
  const isEmpty = !display && !chosen;

  function choose(option: ComboboxOption) {
    onSelect(option.value);
    if (!multiple) setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) =>
        nextHighlight(current, visible.length, event.key === 'ArrowDown' ? 1 : -1),
      );
      return;
    }
    if (event.key === 'Enter') {
      const option = visible[highlight];
      if (option) {
        event.preventDefault();
        choose(option);
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          // Arrowing from the closed trigger opens onto the list, which is what
          // every native select does.
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-token border border-line bg-surface-2',
          'px-2.5 py-1.5 text-left outline-none transition-colors',
          'hover:border-accent-ink/40 focus-visible:ring-2 focus-visible:ring-accent-ink',
          'disabled:pointer-events-none disabled:opacity-50',
          open && 'border-accent-ink/50',
        )}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-[0.08em] text-ink-dim">
            {label}
          </span>
          <span
            className={cn(
              'block truncate text-body',
              isEmpty ? 'text-ink-dim' : 'font-medium text-ink',
            )}
            title={triggerText}
          >
            {triggerText}
          </span>
        </span>
        <Chevron
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-ink-dim transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute left-0 top-[calc(100%+4px)] z-30 w-[max(100%,16rem)] overflow-hidden',
            'rounded-token border border-line bg-surface shadow-lg',
          )}
        >
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-controls={listId}
            className={cn(
              'w-full border-0 border-b border-line bg-transparent px-3 py-2 text-body',
              'text-ink outline-none placeholder:text-ink-dim',
            )}
          />

          <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <li className="px-3 py-3 text-body text-ink-dim">Loading…</li>
            ) : visible.length === 0 ? (
              <li className="px-3 py-3 text-body text-ink-dim">{emptyLabel}</li>
            ) : (
              visible.map((option, index) => {
                const isSelected = selected.includes(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(option)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-token px-2 py-1.5 text-left text-body',
                        'outline-none transition-colors',
                        index === highlight && 'bg-surface-2',
                        isSelected && 'bg-accent-soft text-accent-ink',
                      )}
                    >
                      {showThumbs ? <OptionThumb src={option.imageUrl} /> : null}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate', isSelected && 'font-medium')}>
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="block truncate text-[11px] text-ink-dim">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      <Tick
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* The same two glyphs <Select> draws inline, for the same reason: this package
   carries no icon dependency, and its consumers pass lucide elements in. */
function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
