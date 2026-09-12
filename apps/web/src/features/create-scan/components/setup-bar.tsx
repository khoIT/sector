import { useScanTypes, useScanUserGroups } from '@scanvault/api-client';
import { Combobox, cn } from '@scanvault/ui';
import { Stethoscope, Users2 } from 'lucide-react';
import { useMemo } from 'react';

import { defaultGroupCohort } from '../model/group-cohort';
import {
  groupOptions,
  groupTriggerLabel,
  scanTypeOptions,
  toggleGroup,
} from '../model/setup-options';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import type { useScanTypeSwitch } from '../model/use-scan-type-switch';

export type SetupBarProps = {
  draft: UseCreateScanDraft;
  switcher: ReturnType<typeof useScanTypeSwitch>;
};

/**
 * Everything a study needs set up, on one row.
 *
 * Scan type comes first because it is the only choice on this page that gates
 * anything: the findings form is fetched per type and cannot be drawn before
 * one is picked. Groups sit beside it not because they gate anything — they
 * are routing, and a group carries no organization — but because routing is
 * fixed at submit and an irreversible choice does not belong at the bottom of
 * a scrolling page, which is where it used to live.
 *
 * Files are not here at all. Uploading gates nothing and blocks nothing, and a
 * count in this row would be the third place the same number appears — the
 * rail already carries the panel that owns it.
 */
export function SetupBar({ draft, switcher }: SetupBarProps) {
  const { state, update } = draft;
  const { data: scanTypes, isPending: typesPending } = useScanTypes();
  const { data: groups, isPending: groupsPending } = useScanUserGroups();

  const typeOptions = useMemo(() => scanTypeOptions(scanTypes), [scanTypes]);
  const groupChoices = useMemo(() => groupOptions(groups), [groups]);

  // `groupIds === null` means "not touched", and the effective set is the
  // default cohort. The trigger has to report that same set, or it contradicts
  // what will actually be sent.
  const selectedGroups = state.groupIds ?? defaultGroupCohort(groups);

  return (
    <div
      className={cn(
        'flex flex-wrap items-stretch gap-2 rounded-token border border-line',
        'bg-surface px-2.5 py-2',
      )}
    >
      <Combobox
        className="min-w-[13rem] flex-1 sm:max-w-[18rem]"
        label="Scan type"
        placeholder="Choose a scan type"
        searchPlaceholder="AAA, Echo, Lung…"
        emptyLabel="No scan type matches."
        loading={typesPending}
        options={typeOptions}
        selected={state.scanTypeId ? [state.scanTypeId] : []}
        display={state.scanTypeName ?? undefined}
        icon={<Stethoscope className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />}
        onSelect={(id) => {
          const scanType = scanTypes?.find((type) => type.id === id);
          if (scanType) void switcher.chooseScanType(scanType);
        }}
      />

      <Combobox
        className="min-w-[13rem] flex-1 sm:max-w-[18rem]"
        label="Share with"
        searchPlaceholder="Search your groups…"
        emptyLabel="No group matches."
        loading={groupsPending}
        multiple
        options={groupChoices}
        selected={selectedGroups}
        display={groupTriggerLabel(selectedGroups, groups)}
        icon={<Users2 className="h-4 w-4 shrink-0 text-ink-dim" aria-hidden />}
        onSelect={(id) => update({ groupIds: toggleGroup(selectedGroups, id) })}
      />

    </div>
  );
}
