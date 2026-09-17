import type { FindingDefinition } from '@sector/api-client';
import { Input, cn } from '@sector/ui';
import { useTranslation } from 'react-i18next';

import {
  findingControlKind,
  parseMultiValue,
  serializeMultiValue,
} from '../model/finding-controls';

export type FindingRowProps = {
  definition: FindingDefinition;
  value: string;
  onChange: (key: string, value: string) => void;
  invalid?: boolean;
};

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-token border px-2.5 py-1 text-[12px] transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
        selected
          ? 'border-accent-ink bg-accent-soft font-medium text-accent-ink'
          : 'border-line bg-surface text-ink hover:bg-surface-2',
      )}
    >
      {label}
    </button>
  );
}

/**
 * One findings row.
 *
 * Both option controls render EVERY option the scan type declares, and the
 * multi-select stays a multi-select. That is not decoration: a row like
 * "≤ 3cm / >3 cm / Indeterminate / Not Examined" carries a clinical
 * distinction between "indeterminate" and "not examined" that a yes/no control
 * destroys, and a "TA / TV" row records that both windows were used.
 *
 * A selected single-choice option can be clicked again to clear it, so a row
 * touched by mistake can be returned to genuinely unanswered rather than being
 * stuck on whichever option was hit first.
 */
export function FindingRow({ definition, value, onChange, invalid }: FindingRowProps) {
  const { t } = useTranslation();
  const kind = findingControlKind(definition);

  if (kind === 'heading') {
    return (
      <li className="pt-2 first:pt-0">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink-dim">
          {definition.name}
        </h4>
      </li>
    );
  }

  const label = (
    // Capped so the eye's travel from label to control stays readable: the
    // controls already take at most 60% of the row, and 38ch of label beside
    // them keeps the run under ~70ch however wide the column gets.
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md:max-w-[38ch]">
      <span className="text-body font-medium text-ink">
        {definition.level && definition.level > 1
          ? `${definition.name} (${definition.level})`
          : definition.name}
        {definition.required ? (
          <span className="ml-1 text-crit" aria-label={t('createScan.findingRow.required')}>
            *
          </span>
        ) : null}
      </span>
      {definition.description ? (
        <span className="text-[12px] text-ink-dim">{definition.description}</span>
      ) : null}
    </div>
  );

  return (
    <li
      className={cn(
        // Container queries, not viewport ones. This row now renders both full
        // width and in a ~600px rail beside the media pane, and `sm:` would
        // read the WINDOW — putting the label and a six-option grid side by
        // side inside a rail far too narrow for them.
        'flex flex-col gap-2 border-b border-line py-2.5 last:border-b-0',
        '@md:flex-row @md:items-start @md:gap-4',
        invalid && 'rounded-token bg-crit-soft px-2',
      )}
    >
      {label}

      <div className="flex flex-wrap gap-1.5 @md:max-w-[60%] @md:justify-end">
        {kind === 'single'
          ? definition.options.map((option) => (
              <OptionButton
                key={option}
                label={option}
                selected={value === option}
                onClick={() => onChange(definition.key, value === option ? '' : option)}
              />
            ))
          : null}

        {kind === 'multi'
          ? definition.options.map((option) => {
              const selected = parseMultiValue(value).includes(option);
              return (
                <OptionButton
                  key={option}
                  label={option}
                  selected={selected}
                  onClick={() => {
                    const current = parseMultiValue(value);
                    const next = selected
                      ? current.filter((entry) => entry !== option)
                      : [...current, option];
                    onChange(definition.key, serializeMultiValue(next));
                  }}
                />
              );
            })
          : null}

        {kind === 'text' || kind === 'number' ? (
          <div className="flex w-full items-center gap-1.5 @md:w-52">
            {definition.prefixLabel ? (
              <span className="shrink-0 text-[12px] text-ink-dim">{definition.prefixLabel}</span>
            ) : null}
            <Input
              type={kind === 'number' ? 'number' : 'text'}
              numeric={kind === 'number'}
              placeholder={definition.placeholder ?? undefined}
              value={value}
              aria-label={definition.name}
              onChange={(event) => onChange(definition.key, event.target.value)}
            />
            {definition.suffixLabel ? (
              <span className="shrink-0 text-[12px] text-ink-dim">{definition.suffixLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
