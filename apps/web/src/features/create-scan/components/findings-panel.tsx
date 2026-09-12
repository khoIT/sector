import { useFindingDefinitions } from '@scanvault/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@scanvault/ui';
import { HeartPulse, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';

import {
  applyNoPathologyDefaults,
  clearNoPathologyDefaults,
  isNoPathologyApplied,
  sortFindingDefinitions,
  type FindingAnswers,
} from '../model/finding-controls';
import { FindingRow } from './finding-row';
import { InlineNotice } from './inline-notice';

export type FindingsPanelProps = {
  scanTypeId: string;
  organizationId: string | null;
  answers: FindingAnswers;
  onChange: (answers: FindingAnswers) => void;
  /** Keys the user must still answer. Highlighted, not silently rejected. */
  invalidKeys?: string[];
};

export function FindingsPanel({
  scanTypeId,
  organizationId,
  answers,
  onChange,
  invalidKeys = [],
}: FindingsPanelProps) {
  const { data, isPending, isError, error, refetch } = useFindingDefinitions(
    scanTypeId,
    organizationId,
  );

  const definitions = useMemo(() => sortFindingDefinitions(data?.items ?? []), [data]);
  const applied = isNoPathologyApplied(definitions, answers);
  const invalid = new Set(invalidKeys);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Findings</CardTitle>
          <p className="mt-0.5 text-[12px] text-ink-dim">
            What the study shows. Every option the scan type defines is offered — leave a row
            untouched if it was not assessed.
          </p>
        </div>

        {definitions.length > 0 ? (
          <Button
            variant={applied ? 'secondary' : 'primary'}
            size="sm"
            onClick={() =>
              onChange(
                applied
                  ? clearNoPathologyDefaults(definitions, answers)
                  : applyNoPathologyDefaults(definitions, answers),
              )
            }
          >
            {applied ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Clear defaults
              </>
            ) : (
              <>
                <HeartPulse className="h-3.5 w-3.5" aria-hidden /> No pathology
              </>
            )}
          </Button>
        ) : null}
      </CardHeader>

      {/* The container the rows measure themselves against, so a row renders
          for the width it actually has rather than for the window's. */}
      <CardContent className="@container">
        {isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : isError ? (
          <InlineNotice
            tone="crit"
            title="This scan type's findings form could not be loaded"
            action={
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          >
            {error instanceof Error ? error.message : 'The request failed.'} You can still submit
            the study with a note instead, or retry.
          </InlineNotice>
        ) : definitions.length === 0 ? (
          <p className="text-body text-ink-dim">
            This scan type has no structured findings. Record what you saw in the clinical note
            below.
          </p>
        ) : (
          <ul className="flex flex-col">
            {definitions.map((definition) => (
              <FindingRow
                key={definition.key}
                definition={definition}
                value={answers[definition.key] ?? ''}
                invalid={invalid.has(definition.key)}
                onChange={(key, value) => onChange({ ...answers, [key]: value })}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
