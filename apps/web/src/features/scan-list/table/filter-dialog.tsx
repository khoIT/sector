import {
  useGroupFilterOptions,
  useScanTypeFilterOptions,
  useScanUsers,
  userDisplayName,
} from '@scanvault/api-client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@scanvault/ui';
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CheckboxFilterList, RadioFilterList, type FilterOption } from './filter-controls';
import { useDebouncedValue } from './use-debounced-value';
import {
  SHARE_STATUS_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TAG_FILTER_OPTIONS,
  type FilterSpec,
} from './filter-spec';
import { filterValue, filterValues, setFilter, type FilterState } from './list-url-state';

export type FilterDialogProps = {
  spec: FilterSpec;
  filters: FilterState[];
  onApply: (filters: FilterState[]) => void;
};

/**
 * The filter panel.
 *
 * Edits a DRAFT and only writes to the URL on Apply. Filtering 2,000 scans one
 * checkbox at a time would fire a request per click; batching them means one
 * request per decision.
 */
export function FilterDialog({ spec, filters, onApply }: FilterDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState[]>(filters);

  // Re-seed the draft whenever the panel opens, so it reflects a filter that
  // was cleared from the empty state while the dialog was closed.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const wantsScanTypes = spec.sections.includes('scanType');
  const wantsGroups = spec.sections.includes('groups');
  const wantsUsers = spec.sections.includes('users');

  // Only fetch a dropdown's source once the panel is open; a reviewer who never
  // filters should not pay for 1,334 users on every page view.
  const scanTypes = useScanTypeFilterOptions(open && wantsScanTypes);
  // NOT useScanUserGroups: that answers with the caller's own memberships,
  // which is empty for the administrators who see every scan and a superset of
  // the led groups for a scoped leader — picking a group they belong to but do
  // not lead silently returned nothing. /api/groups/filter-options answers with
  // what the caller may actually filter by, and searches server-side.
  const [groupSearch, setGroupSearch] = useState('');
  const debouncedGroupSearch = useDebouncedValue(groupSearch, 250);
  const groups = useGroupFilterOptions(
    { keyword: debouncedGroupSearch, limit: 50 },
    open && wantsGroups,
  );
  const users = useScanUsers(spec.userType, open && wantsUsers);

  const scanTypeOptions = useMemo<FilterOption[]>(
    () =>
      (scanTypes.data ?? []).map((type) => ({
        value: type.baseKey,
        label: type.name,
      })),
    [scanTypes.data],
  );

  const groupOptions = useMemo<FilterOption[]>(
    () =>
      (groups.data?.items ?? []).map((group) => ({
        value: group.id,
        label: group.name,
      })),
    [groups.data],
  );

  const userOptions = useMemo<FilterOption[]>(
    () =>
      (users.data ?? []).map((user) => ({
        value: user.id,
        label: `${userDisplayName(user)} · ${user.email}`,
      })),
    [users.data],
  );

  const activeCount = filters.length;

  function update(id: string, value: string | string[] | undefined) {
    setDraft((current) => setFilter(current, id, value));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {t('toolbar.filters')}
          {activeCount > 0 ? (
            <span className="sv-num rounded-full bg-accent px-1.5 text-[11px] text-scan-ground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('toolbar.filters')}</DialogTitle>
          <DialogDescription>{t('toolbar.filtersDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-1">
          {wantsScanTypes ? (
            <CheckboxFilterList
              legend="Scan type"
              options={scanTypeOptions}
              selected={filterValues(draft, 'scanTypeKeys')}
              onChange={(value) => update('scanTypeKeys', value)}
              searchable
              searchPlaceholder="Search scan types"
              loading={scanTypes.isPending}
            />
          ) : null}

          {spec.sections.includes('status') ? (
            <RadioFilterList
              legend="Status"
              options={STATUS_FILTER_OPTIONS}
              value={filterValue(draft, 'status') as string | undefined}
              onChange={(value) => update('status', value)}
              anyLabel="Any status"
            />
          ) : null}

          {spec.sections.includes('shareStatus') ? (
            <RadioFilterList
              legend="Share status"
              options={SHARE_STATUS_FILTER_OPTIONS}
              value={filterValue(draft, 'status') as string | undefined}
              onChange={(value) => update('status', value)}
              anyLabel="Any"
            />
          ) : null}

          {spec.sections.includes('tags') ? (
            <RadioFilterList
              legend="Completeness tag"
              options={TAG_FILTER_OPTIONS}
              value={filterValue(draft, 'tags') as string | undefined}
              onChange={(value) => update('tags', value)}
              anyLabel="Any"
            />
          ) : null}

          {wantsGroups ? (
            <CheckboxFilterList
              legend="Group"
              options={groupOptions}
              selected={filterValues(draft, 'groupIds')}
              onChange={(value) => {
                // A learner filter is only meaningful inside the chosen groups,
                // and the server intersects the two. Clearing it avoids an
                // empty result that looks like a bug.
                setDraft((current) =>
                  setFilter(setFilter(current, 'groupIds', value), 'userIds', undefined),
                );
              }}
              searchable
              searchPlaceholder="Search groups by name"
              onSearchChange={setGroupSearch}
              emptyHint={
                debouncedGroupSearch.trim()
                  ? `No group matches “${debouncedGroupSearch.trim()}”.`
                  : 'There are no groups you can filter by.'
              }
              loading={groups.isPending}
            />
          ) : null}

          {wantsUsers ? (
            <CheckboxFilterList
              legend="Learner"
              options={userOptions}
              selected={filterValues(draft, 'userIds')}
              onChange={(value) => update('userIds', value)}
              searchable
              searchPlaceholder="Search learners by name or email"
              loading={users.isPending}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft([]);
              onApply([]);
              setOpen(false);
            }}
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
