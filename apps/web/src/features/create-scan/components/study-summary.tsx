import { useFindingDefinitions, useScanUserGroups, type FindingDefinition } from '@scanvault/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from '@scanvault/ui';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatBytes } from '@/lib/format';

import {
  findingControlKind,
  missingRequiredFindings,
  sortFindingDefinitions,
  type FindingAnswers,
} from '../model/finding-controls';
import { countStored, countTracked, trackedBytes } from '../model/file-counts';
import { defaultGroupCohort, isWiderThanCohort } from '../model/group-cohort';
import type { DraftState } from '../model/draft-types';

export type StudySummaryProps = {
  state: DraftState;
  /** Back to the working surface, so a value can be corrected in place. */
  onEdit: () => void;
  collectsScanIdentifier: boolean;
};

/**
 * Everything that is about to be sent, read-only.
 *
 * Submission is the one irreversible act in this flow, and it was the one
 * screen that did not show the learner what they were committing: scan type, a
 * file count, a group COUNT and an expert-review label — no findings, no note,
 * no identifiers, no files, and no way to tell which three groups `3` meant.
 *
 * Group routing matters most here because it cannot be repaired afterwards:
 * the API has no route that adds a group to an existing scan.
 */
export function StudySummary({ state, onEdit, collectsScanIdentifier }: StudySummaryProps) {
  const { data: definitionData } = useFindingDefinitions(state.scanTypeId, state.organizationId);
  const { data: groups } = useScanUserGroups();

  const definitions = definitionData?.items ?? [];
  const groupIds = state.groupIds ?? defaultGroupCohort(groups);
  const chosenGroups = (groups ?? []).filter((group) => groupIds.includes(group.id));

  const stored = countStored(state.files);
  const tracked = countTracked(state.files);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>What will be sent</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            Everything below is recorded against the files already in storage. Group routing
            cannot be changed afterwards.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit study
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Section title="The study">
          <Fact label="Exam type" value={state.scanTypeName} />
          <Fact
            label="Files"
            value={
              tracked === 0
                ? null
                : `${stored} of ${tracked} in storage · ${formatBytes(trackedBytes(state.files))}`
            }
          />
          {collectsScanIdentifier ? (
            <Fact label="Scan identifier" value={state.scanIdentifier} />
          ) : null}
          <Fact label="External patient ID" value={state.externalPatientId} />
        </Section>

        <Section title="Findings">
          <FindingsSummary definitions={definitions} answers={state.findings} />
        </Section>

        <Section title="Clinical note">
          {state.note.trim() ? (
            <p className="whitespace-pre-wrap text-body text-ink">{state.note}</p>
          ) : (
            <Empty>No note. A reviewer will see the findings and the images only.</Empty>
          )}
        </Section>

        <Section title="Who sees this study">
          {chosenGroups.length === 0 ? (
            <Empty>
              No groups. Only you will see this study, and it cannot be shared with a group later.
            </Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {chosenGroups.map((group) => (
                <li key={group.id} className="flex flex-wrap items-center gap-2 text-body">
                  <span className="text-ink">{group.name}</span>
                  {/* Named, not counted, and the broad ones marked: routing to a
                      university-wide parent group puts the study in front of
                      reviewers it was never meant for. */}
                  {isWiderThanCohort(group, groups) ? (
                    <span className="rounded-full border border-warn/25 bg-warn-soft px-2 py-0.5 text-[11px] text-warn">
                      wider than your cohort
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <Fact label="Expert review" value={state.expertReview?.label} empty="Not requested" />
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-body text-ink-dim">{children}</p>;
}

/**
 * A label/value row that renders even when the value is blank.
 *
 * An omitted row and a blank row look identical on a summary and mean opposite
 * things — one says "nothing to say", the other says "this screen forgot".
 */
function Fact({
  label,
  value,
  empty = 'Not set',
}: {
  label: string;
  value: string | null | undefined;
  empty?: string;
}) {
  const filled = Boolean(value && value.trim());

  return (
    <div className="flex justify-between gap-3 border-b border-line py-1 last:border-b-0">
      <dt className="shrink-0 text-ink-dim">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right', filled ? 'text-ink' : 'text-ink-dim')}>
        {filled ? value : empty}
      </dd>
    </div>
  );
}

/**
 * The learner's own answers, with the blanks named.
 *
 * A required row left blank reads "not assessed" rather than being dropped.
 * Dropping it makes an unexamined item indistinguishable from a normal one on
 * the very screen where the learner still has time to go back and answer it.
 */
function FindingsSummary({
  definitions,
  answers,
}: {
  definitions: readonly FindingDefinition[];
  answers: FindingAnswers;
}) {
  const missing = new Set(
    missingRequiredFindings(definitions, answers).map((definition) => definition.key),
  );

  const rows = sortFindingDefinitions(definitions).filter(
    (definition) =>
      findingControlKind(definition) !== 'heading' &&
      (Boolean(answers[definition.key]?.trim()) || missing.has(definition.key)),
  );

  if (rows.length === 0) {
    return <Empty>No findings recorded.</Empty>;
  }

  return (
    <dl className="grid gap-x-6 sm:grid-cols-2">
      {rows.map((definition) => (
        <Fact
          key={definition.key}
          label={definition.name}
          value={answers[definition.key]}
          empty="not assessed"
        />
      ))}
    </dl>
  );
}
