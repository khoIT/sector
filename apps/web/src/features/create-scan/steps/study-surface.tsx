import { useFindingDefinitions, useScanUserGroups } from '@scanvault/api-client';
import { Stethoscope, Users2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { FilesPanel } from '../components/files-panel';
import { GroupRoutingPanel } from '../components/group-routing-panel';
import { StudyBar, StudyChip } from '../components/study-bar';
import { canAutoCollapseFiles } from '../model/file-counts';
import { defaultGroupCohort } from '../model/group-cohort';
import { readinessFor, submitBlockers } from '../model/readiness';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import { StepInterpretation } from './step-interpretation';

export type StudySurfaceProps = {
  draft: UseCreateScanDraft;
  onReview: () => void;
};

/**
 * The one surface a study is built on.
 *
 * Files, exam type, findings, the note and group routing all live here, so the
 * learner's real loop — add a file, change the exam type, answer a finding,
 * add another file — costs no navigation at all. It used to cost Back, Back,
 * click, Next, Next.
 *
 * The study bar above carries the controls and the readiness counters; the
 * panels below carry the work.
 */
export function StudySurface({ draft, onReview }: StudySurfaceProps) {
  const { state } = draft;
  const { data: definitions } = useFindingDefinitions(state.scanTypeId, state.organizationId);

  const [filesCollapsed, setFilesCollapsed] = useState(false);

  const collapsible = canAutoCollapseFiles(state.files);

  // Fold the files away once they are all safely stored, and unfold the moment
  // anything needs attention again — a retry, a new file, a restored draft.
  // Never the other way round: a panel that hides a failed upload is how a
  // failed upload reaches Submit.
  useEffect(() => {
    if (!collapsible) setFilesCollapsed(false);
    else setFilesCollapsed(true);
  }, [collapsible]);

  const readiness = useMemo(
    () =>
      readinessFor({
        files: state.files,
        scanTypeId: state.scanTypeId,
        definitions: definitions?.items ?? [],
        findings: state.findings,
        note: state.note,
      }),
    [state.files, state.scanTypeId, state.findings, state.note, definitions],
  );

  const blockers = submitBlockers(readiness);

  // `groupIds === null` means "no explicit choice yet", and the panel below
  // renders the DEFAULT cohort ticked in that case. Reading the raw length
  // here would put "No groups" in the bar directly above a panel showing a
  // group selected — the chip has to report the same effective set the panel
  // does, or it contradicts what is on screen a few pixels below it.
  const { data: groups } = useScanUserGroups();
  const effectiveGroupIds = state.groupIds ?? defaultGroupCohort(groups);
  const groupCount = effectiveGroupIds.length;

  return (
    <div className="flex flex-col gap-4">
      <StudyBar readiness={readiness} onReview={onReview}>
        {/* Both chips move the page to the panel they name rather than opening
            a popover copy of it. One control, one place — a popover holding a
            second scan-type grid is two things to keep in step. */}
        <StudyChip
          label="Exam type"
          value={state.scanTypeName ?? 'Choose exam type'}
          icon={<Stethoscope className="h-3.5 w-3.5 shrink-0 text-ink-dim" aria-hidden />}
          onClick={() => scrollToPanel('study-exam')}
        />
        <StudyChip
          label="Groups"
          value={groupCount === 0 ? 'No groups' : `${groupCount} group${groupCount === 1 ? '' : 's'}`}
          icon={<Users2 className="h-3.5 w-3.5 shrink-0 text-ink-dim" aria-hidden />}
          onClick={() => scrollToPanel('study-groups')}
        />
      </StudyBar>

      {/* Review is always reachable; it explains what is missing rather than
          being disabled without saying why. */}
      {blockers.length > 0 ? (
        <p className="text-[12px] text-ink-dim">
          Still needed before submitting:{' '}
          {blockers.map((item) => item.label.toLowerCase()).join(' and ')}.
        </p>
      ) : null}

      <FilesPanel
        draft={draft}
        collapsed={filesCollapsed}
        onToggle={() => setFilesCollapsed((collapsed) => !collapsed)}
      />

      <div id="study-exam">
        <StepInterpretation draft={draft} />
      </div>

      {/* Group routing lives here rather than on the submit screen, because it
          is the one thing on that screen that could still be changed — and the
          API has no route that adds a group to an existing scan, so getting it
          wrong is unrecoverable. */}
      <div id="study-groups">
        <GroupRoutingPanel
          selected={state.groupIds}
          onChange={(ids) => draft.update({ groupIds: ids })}
        />
      </div>
    </div>
  );
}

/** Move the page to a panel without changing what is rendered. */
function scrollToPanel(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
