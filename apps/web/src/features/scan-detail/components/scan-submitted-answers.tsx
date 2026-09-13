import type { ScanFinding, ScanFormResponse, ScanTypeItems } from '@sector/api-client';
import { useScanTypeItems } from '@sector/api-client';
import { Skeleton } from '@sector/ui';
import { useMemo } from 'react';

type ScanSubmittedAnswersProps = {
  scanTypeId: string | undefined;
  findings: ScanFinding[];
  form: ScanFormResponse[];
};

type Row = { id: string; group: string | null; label: string; value: string };

/**
 * The interpretation the learner submitted, in the words the form used.
 *
 * Neither collection is self-describing: a finding stores a machine `key`
 * (`v5_echo_ejection_fraction`) and a dynamic-form answer stores nothing but
 * `{ formId, scanFormFieldId, value }`. The scan type's definitions are what
 * turn those into "View: Longitudinal IVC", so they are fetched and joined
 * here. When the definitions are missing the raw key is shown rather than an
 * empty panel — a reviewer can still read `v5_echo_ejection_fraction`.
 */
export function ScanSubmittedAnswers({ scanTypeId, findings, form }: ScanSubmittedAnswersProps) {
  const hasAnswers = findings.length > 0 || form.length > 0;
  const { data: definitions, isPending } = useScanTypeItems(scanTypeId, hasAnswers);

  const rows = useMemo(
    () => buildRows(findings, form, definitions),
    [findings, form, definitions],
  );

  if (!hasAnswers) {
    return (
      <p className="text-body text-ink-dim">
        Nothing was submitted with this scan — no findings and no form answers.
      </p>
    );
  }

  if (isPending && !definitions) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  let lastGroup: string | null | undefined;

  return (
    <dl className="space-y-2">
      {rows.map((row) => {
        const showGroup = row.group && row.group !== lastGroup;
        lastGroup = row.group;

        return (
          <div key={row.id}>
            {showGroup ? (
              <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-dim first:mt-0">
                {row.group}
              </p>
            ) : null}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line pb-1.5">
              <dt className="text-[12px] text-ink-dim">{row.label}</dt>
              <dd className="text-body font-medium text-ink">{row.value}</dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}

function buildRows(
  findings: ScanFinding[],
  form: ScanFormResponse[],
  definitions: ScanTypeItems | undefined,
): Row[] {
  const itemByKey = new Map((definitions?.items ?? []).map((item) => [item.key, item]));

  const findingRows: Row[] = findings.map((finding) => ({
    id: `finding-${finding.id}`,
    group: 'Findings',
    label: itemByKey.get(finding.key)?.name ?? finding.key,
    value: finding.value || '—',
  }));

  const fieldById = new Map(
    (definitions?.forms ?? []).flatMap((definition) =>
      definition.fields.map((field) => [field.id, { field, formName: definition.name }] as const),
    ),
  );

  const formRows: Row[] = form.map((answer, index) => {
    const match = fieldById.get(answer.scanFormFieldId);
    const label = match?.field.label ?? match?.field.fieldName ?? answer.scanFormFieldId;
    const option = match?.field.options.find((entry) => entry.value === answer.value);

    return {
      id: answer.id ?? answer._id ?? `form-${index}`,
      group: match?.formName ?? 'Form answers',
      label,
      value: option?.label ?? formatAnswerValue(answer.value),
    };
  });

  return [...findingRows, ...formRows];
}

/** Values are `string | number | boolean | string[] | null` on the wire. */
function formatAnswerValue(value: ScanFormResponse['value']): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  return String(value);
}
