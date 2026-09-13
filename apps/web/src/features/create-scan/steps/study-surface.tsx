import { useFindingDefinitions, useUserOrganizations, userDisplayName } from '@sector/api-client';
import { cn } from '@sector/ui';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/auth-context';

import { ClinicalNotePanel } from '../components/clinical-note-panel';
import { CommitBar } from '../components/commit-bar';
import { ExpertReviewPanel } from '../components/expert-review-panel';
import { FindingsPanel } from '../components/findings-panel';
import { InlineNotice } from '../components/inline-notice';
import { SetupBar } from '../components/setup-bar';
import { StudyRail } from '../components/study-rail';
import { SwitchScanTypeDialog } from '../components/switch-scan-type-dialog';
import type { SubmitOutcome } from '../model/draft-types';
import { shouldShowFileCountNudge } from '../model/file-count-nudge';
import { canAutoCollapseFiles, countTracked } from '../model/file-counts';
import { missingRequiredFindings } from '../model/finding-controls';
import { readinessFor } from '../model/readiness';
import { useDraftMediaSources } from '../model/use-draft-media-sources';
import type { UseCreateScanDraft } from '../model/use-create-scan-draft';
import { useScanTypeSwitch } from '../model/use-scan-type-switch';

export type StudySurfaceProps = {
  draft: UseCreateScanDraft;
  onSubmitted: (outcome: SubmitOutcome) => void;
};

/**
 * Set up, work, commit.
 *
 * The job this page does has one dependency in it — the findings form is
 * fetched per scan type and cannot be drawn before one is picked — and two
 * things that hang off nothing at all: who the study is shared with, and
 * getting the bytes off the learner's machine. Arranged that way it is three
 * blocks.
 *
 * It was eight, and they repeated each other: a draft-saved line and a files
 * summary row said "3 of 3 files in storage" a hundred pixels apart, the exam
 * type was named by a chip, a folded row and a readiness counter, and a study
 * bar summarised panels that had each learned to summarise themselves. Two
 * summary systems, both right, endlessly agreeing. Only one layer describes
 * the study now, and it is the panels.
 *
 * Media sits in a sticky column beside the findings rather than inside them,
 * which is the geometry the reviewer's detail page has always used — a learner
 * and their reviewer now read the same study the same way.
 */
export function StudySurface({ draft, onSubmitted }: StudySurfaceProps) {
  const { user } = useAuth();
  const { state, update } = draft;
  const { data: definitions } = useFindingDefinitions(state.scanTypeId, state.organizationId);

  const switcher = useScanTypeSwitch(draft);
  const sources = useDraftMediaSources(state.files);
  const { data: organizations } = useUserOrganizations(user?.id);

  // The moment every file finishes is also the moment the study is about to
  // be submitted — which used to be exactly when the "most studies have at
  // least three files" nudge disappeared, folded away inside the collapsed
  // files panel. A study short on files needs that reminder MOST right before
  // Submit, so the panel is not allowed to fold itself away while it applies.
  const showFileCountNudge = shouldShowFileCountNudge(countTracked(state.files), organizations);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const collapsible = canAutoCollapseFiles(state.files) && !showFileCountNudge;

  // Fold the files away once they are all safely stored, and unfold the moment
  // anything needs attention again — a retry, a new file, a restored draft.
  // Never the other way round: a panel that hides a failed upload is how a
  // failed upload reaches Submit.
  useEffect(() => {
    setFilesCollapsed(collapsible);
  }, [collapsible]);

  const missingRequired = useMemo(
    () => missingRequiredFindings(definitions?.items ?? [], state.findings),
    [definitions, state.findings],
  );

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

  return (
    <div className="flex flex-col gap-4">
      <SetupBar draft={draft} switcher={switcher} />

      {switcher.pendingSwitch ? (
        <SwitchScanTypeDialog
          open
          onOpenChange={(next) => {
            if (!next) switcher.cancelSwitch();
          }}
          currentTypeName={state.scanTypeName ?? ''}
          nextTypeName={switcher.pendingSwitch.scanType.name}
          kept={switcher.pendingSwitch.plan.kept}
          cleared={switcher.pendingSwitch.plan.cleared}
          onConfirm={switcher.confirmSwitch}
        />
      ) : null}

      {/* Media left, work right. Stacks media-first below xl, where a 450px
          findings column would be worse than a full-width one. */}
      <div
        className={cn('grid gap-4 xl:items-start', 'xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]')}
      >
        <StudyRail
          draft={draft}
          sources={sources}
          collapsed={filesCollapsed}
          onToggle={() => setFilesCollapsed((collapsed) => !collapsed)}
        />

        <div className="flex min-w-0 flex-col gap-4">
          {state.scanTypeId ? (
            <FindingsPanel
              scanTypeId={state.scanTypeId}
              organizationId={state.organizationId}
              answers={state.findings}
              invalidKeys={missingRequired.map((definition) => definition.key)}
              onChange={(findings) => update({ findings })}
            />
          ) : (
            <InlineNotice tone="info" title="Pick a scan type to see its findings">
              Findings differ per scan type, so the form appears once a type is chosen. Your files
              keep uploading in the background meanwhile.
            </InlineNotice>
          )}

          {/* Beside the rows it is about, rather than two blocks below them
              where it used to sit. */}
          {missingRequired.length > 0 ? (
            <InlineNotice
              tone="warn"
              title={`${missingRequired.length} required ${missingRequired.length === 1 ? 'finding is' : 'findings are'} still blank`}
            >
              {missingRequired.map((definition) => definition.name).join(', ')}. You can submit
              without them, but a reviewer will not know whether they were normal or not assessed.
            </InlineNotice>
          ) : null}

          <ClinicalNotePanel draft={draft} rows={4} />

          {/* Its own block rather than a line in the commit bar: requesting a
              review spends a credit and can open a purchase, which is more
              than a bar should hold. */}
          {user ? (
            <ExpertReviewPanel
              userId={user.id}
              userName={userDisplayName(user)}
              value={state.expertReview}
              onChange={(expertReview) => update({ expertReview })}
            />
          ) : null}
        </div>
      </div>

      <CommitBar draft={draft} readiness={readiness} onSubmitted={onSubmitted} />
    </div>
  );
}
