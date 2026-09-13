import type { FindingDefinition } from '@sector/api-client';

/**
 * How one findings row is captured, and how its answer is encoded on the wire.
 *
 * The control kind comes from `type` AND `dataType` together. Reading `type`
 * alone is the mistake that flattens the form: 189 of the 232 definitions on
 * the local database are `type: 'select'`, and six of those are multi-selects
 * that happen to carry `dataType: 'array'`. Collapsing a four-option row
 * ("≤ 3cm" / ">3 cm" / "Indeterminate" / "Not Examined") into a yes/no, or a
 * multi-select ("TA" / "TV") into a single choice, silently destroys findings.
 */
export type FindingControlKind = 'single' | 'multi' | 'text' | 'number' | 'heading';

export function findingControlKind(definition: FindingDefinition): FindingControlKind {
  const type = definition.type ?? null;

  if (type === null) return 'heading';

  if (type === 'input') {
    return definition.dataType === 'number' ? 'number' : 'text';
  }

  if (type === 'select' || type === 'toggle') {
    // dataType 'array' is the ONLY marker of a multi-select. It is not implied
    // by the option count: plenty of single-choice rows have 4+ options.
    return definition.dataType === 'array' ? 'multi' : 'single';
  }

  return 'text';
}

/**
 * Multi-select answers travel as ONE comma-joined string, because
 * `findings[].value` is a plain string server-side. Matches the legacy
 * encoding exactly, so old and new scans read back identically.
 */
export const MULTI_VALUE_SEPARATOR = ',';

export function parseMultiValue(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(MULTI_VALUE_SEPARATOR).filter(Boolean);
}

export function serializeMultiValue(values: readonly string[]): string {
  return values.join(MULTI_VALUE_SEPARATOR);
}

export type FindingAnswers = Record<string, string>;

/**
 * The rows "No Pathology" acts on: answerable rows that ship a default.
 *
 * Apply, clear and the applied-check all read this ONE predicate. They used to
 * disagree about headings — a section heading can carry a `default` in the
 * data even though it has no control — and the button then rendered as
 * "Clear defaults" on a state it had never produced.
 */
function hasApplicableDefault(definition: FindingDefinition): boolean {
  return Boolean(definition.default) && findingControlKind(definition) !== 'heading';
}

/**
 * The "No Pathology" bulk action: write every definition's own `default` — the
 * normal/absent answer the scan type ships with. Rows with no default keep
 * whatever the user already entered rather than being blanked.
 */
export function applyNoPathologyDefaults(
  definitions: readonly FindingDefinition[],
  current: FindingAnswers,
): FindingAnswers {
  const next: FindingAnswers = { ...current };

  for (const definition of definitions) {
    if (hasApplicableDefault(definition)) next[definition.key] = definition.default as string;
  }

  return next;
}

/** Undo of the above: drop only the rows the action wrote. */
export function clearNoPathologyDefaults(
  definitions: readonly FindingDefinition[],
  current: FindingAnswers,
): FindingAnswers {
  const next: FindingAnswers = { ...current };

  for (const definition of definitions) {
    if (hasApplicableDefault(definition)) delete next[definition.key];
  }

  return next;
}

/** True when every row the action touches currently holds its default. */
export function isNoPathologyApplied(
  definitions: readonly FindingDefinition[],
  answers: FindingAnswers,
): boolean {
  const applicable = definitions.filter(hasApplicableDefault);
  if (applicable.length === 0) return false;
  return applicable.every((definition) => answers[definition.key] === definition.default);
}

/** Rows the server will reject as missing. */
export function missingRequiredFindings(
  definitions: readonly FindingDefinition[],
  answers: FindingAnswers,
): FindingDefinition[] {
  return definitions.filter(
    (definition) =>
      definition.required &&
      findingControlKind(definition) !== 'heading' &&
      !(answers[definition.key] ?? '').trim(),
  );
}

/** Answers as the create payload wants them: blank rows dropped. */
export function toFindingsPayload(
  answers: FindingAnswers,
): Array<{ key: string; value: string }> {
  return Object.entries(answers)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => ({ key, value }));
}

/**
 * Definitions in render order, with headings kept in place. `order` is the
 * authored sequence; ties fall back to the array order the API sent.
 */
export function sortFindingDefinitions(
  definitions: readonly FindingDefinition[],
): FindingDefinition[] {
  return [...definitions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
