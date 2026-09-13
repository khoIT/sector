import type { ScanGroupRef } from '@sector/api-client';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sector/ui';
import { useId, useMemo, useState } from 'react';

import {
  filterGroups,
  groupDisplayName,
  shouldOfferGroupFilter,
  sortGroupsByName,
} from './group-list';

export type ScanGroupsDialogProps = {
  groups: readonly ScanGroupRef[];
  scanTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Every group one scan routes to.
 *
 * This exists because the row cannot show them. A scan in this database can
 * belong to 705 groups, and a third of all scans belong to more than one, so
 * the `+N` badge the row used to expand into a `title` tooltip was expanding
 * into something no browser will render and no reader can scan.
 *
 * No fetch: the list response already carries every group for every row —
 * the server's batch loader applies no limit — so this is a pure expansion of
 * data the table already has.
 */
export function ScanGroupsDialog({ groups, scanTitle, open, onOpenChange }: ScanGroupsDialogProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const filterId = useId();

  const sorted = useMemo(() => sortGroupsByName(groups), [groups]);
  const shown = useMemo(() => filterGroups(sorted, keyword), [sorted, keyword]);
  const withFilter = shouldOfferGroupFilter(groups.length);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setKeyword('');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('groupsDialog.title')}{' '}
            <span className="sv-num font-normal text-ink-dim">({groups.length})</span>
          </DialogTitle>
          <DialogDescription>
            {t('groupsDialog.description', { title: scanTitle })}
          </DialogDescription>
        </DialogHeader>

        {withFilter ? (
          <div className="mb-2">
            <label htmlFor={filterId} className="sr-only">
              {t('groupsDialog.filter')}
            </label>
            <Input
              id={filterId}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('groupsDialog.filter')}
              autoComplete="off"
            />
          </div>
        ) : null}

        {shown.length === 0 ? (
          <p className="py-6 text-center text-body text-ink-dim">
            {t('groupsDialog.noMatch', { keyword: keyword.trim() })}
          </p>
        ) : (
          <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto rounded-token border border-line">
            {shown.map((group) => (
              <li key={group.id} className="px-3 py-2 text-body text-ink">
                {groupDisplayName(group)}
              </li>
            ))}
          </ul>
        )}

        {withFilter && shown.length !== groups.length ? (
          <p className="mt-2 text-[11px] text-ink-dim">
            <span className="sv-num">{shown.length}</span> of{' '}
            <span className="sv-num">{groups.length}</span> shown
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
