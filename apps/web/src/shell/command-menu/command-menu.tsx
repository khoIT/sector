import { courseKeys, SCAN_LIST_VIEWS, scanKeys } from '@sector/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { cn, Dialog, DialogContent, DialogTitle } from '@sector/ui';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';

import { visibleNavGroups } from '../nav-config';
import { commandSources, type CachedQuery } from './command-sources';
import { COMMAND_GROUP_ORDER, filterCommands, type CommandItem } from './filter-commands';

export type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Jump anywhere: every nav destination this role may see, plus the scans and
 * courses already in the query cache.
 *
 * The legacy dashboard had one of these and Sector shipped without it, which
 * on a 46-item course library and five scan queues means the only way to any
 * surface is the rail. Opening it costs nothing — the sources are read from
 * the cache at open, never fetched, so a cold cache simply shows fewer
 * sections.
 *
 * Built on the app's own `Dialog` rather than a command-menu library: three
 * fixed sources capped at eight rows each do not need fuzzy scoring, and
 * Radix already brings the focus trap, the ESC handling and focus restoration.
 */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const listId = useId();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly CommandItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Read once per opening, not per keystroke: `getQueriesData` walks the whole
  // cache, and the rows cannot change while the dialog is up.
  useEffect(() => {
    if (!open) return;

    setQuery('');
    setActiveIndex(0);
    setItems(
      commandSources({
        navGroups: visibleNavGroups(user),
        scanQueries: SCAN_LIST_VIEWS.flatMap(
          (view) =>
            queryClient.getQueriesData({ queryKey: scanKeys.listRoot(view) }) as CachedQuery[],
        ),
        courseQueries: queryClient.getQueriesData({
          queryKey: courseKeys.listRoot(),
        }) as CachedQuery[],
        translate: t,
      }),
    );
  }, [open, user, queryClient, t]);

  const results = useMemo(() => filterCommands(items, query), [items, query]);
  // The list shrinks as the query narrows; an index left past the end would
  // aim Enter at nothing.
  const active = Math.min(activeIndex, Math.max(results.length - 1, 0));

  function go(item: CommandItem | undefined) {
    if (!item) return;
    onOpenChange(false);
    navigate(item.path);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] translate-y-0 p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{t('command.title')}</DialogTitle>

        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) =>
                  results.length ? (index - 1 + results.length) % results.length : 0,
                );
              } else if (event.key === 'Enter') {
                event.preventDefault();
                go(results[active]);
              }
            }}
            placeholder={t('command.placeholder')}
            aria-label={t('command.placeholder')}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            className="w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-body text-ink-dim">{t('command.empty')}</p>
        ) : (
          <ul id={listId} role="listbox" className="max-h-[60dvh] overflow-y-auto p-1.5">
            {COMMAND_GROUP_ORDER.map((group) => {
              const rows = results.filter((item) => item.group === group);
              if (rows.length === 0) return null;

              return (
                <li key={group}>
                  <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
                    {t(`command.group.${group}`)}
                  </p>
                  <ul>
                    {rows.map((item) => {
                      const selected = results[active]?.id === item.id;

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            id={`${listId}-${item.id}`}
                            role="option"
                            aria-selected={selected}
                            // Pointer focus follows the pointer, so clicking a
                            // row and pressing Enter cannot disagree.
                            onMouseMove={() =>
                              setActiveIndex(results.findIndex((entry) => entry.id === item.id))
                            }
                            onClick={() => go(item)}
                            className={cn(
                              'flex w-full items-baseline gap-2 rounded-token px-2 py-1.5 text-left outline-none',
                              selected ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-surface-2',
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate text-body">{item.label}</span>
                            {item.hint ? (
                              <span className="shrink-0 truncate text-[11px] text-ink-dim">
                                {item.hint}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
