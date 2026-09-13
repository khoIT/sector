import { cn } from '@sector/ui';
import { useState } from 'react';

import {
  readCreateScanFlow,
  writeCreateScanFlow,
  type CreateScanFlow,
} from '@/features/create-scan/model/create-scan-flow';

type Choice = { value: CreateScanFlow; title: string; description: string };

const CHOICES: readonly Choice[] = [
  {
    value: 'study',
    title: 'One working surface',
    description:
      'Files, exam type, findings, note and groups on a single page, in any order, with a bar showing what is still missing. A separate screen shows what is about to be sent.',
  },
  {
    value: 'classic',
    title: 'Step by step',
    description:
      'The four-step wizard: files, then interpretation, then review and routing. One thing at a time, with Back and Next.',
  },
];

/**
 * Which way through Create Scan Study this browser takes.
 *
 * Both flows share one draft and every panel, so a study started in one opens
 * in the other — the page maps the step it was parked on. The choice is about
 * arrangement, nothing else.
 *
 * Native radios rather than the segmented-button pattern used for the theme:
 * this is a mutually exclusive choice between two things that each need a
 * sentence of explanation, so it wants labels and real arrow-key behaviour,
 * which the platform control gives for free.
 *
 * Saved immediately. There is no Save button on this card because there is
 * nothing to validate and nothing to send.
 */
export function CreateScanFlowSetting() {
  const [flow, setFlow] = useState<CreateScanFlow>(() =>
    readCreateScanFlow(globalThis.localStorage),
  );

  function choose(next: CreateScanFlow) {
    setFlow(next);
    writeCreateScanFlow(globalThis.localStorage, next);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Create scan study layout</legend>

      {CHOICES.map((choice) => {
        const active = flow === choice.value;
        return (
          <label
            key={choice.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-token border p-3 transition-colors',
              // Only the chosen one is filled. Giving the other a surface of
              // its own makes two boxes that both read as picked.
              active
                ? 'border-accent-ink/40 bg-accent-soft'
                : 'border-line bg-transparent hover:bg-surface-2',
            )}
          >
            <input
              type="radio"
              name="create-scan-flow"
              value={choice.value}
              checked={active}
              onChange={() => choose(choice.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-ink)]"
            />
            <span className="min-w-0">
              <span className="block text-body font-medium text-ink">{choice.title}</span>
              <span className="mt-0.5 block text-[12px] text-ink-dim">{choice.description}</span>
            </span>
          </label>
        );
      })}

      {/* Said plainly rather than discovered: the page reads this once when it
          opens, so a change while a study is already on screen does nothing
          until the next visit. */}
      <p className="text-[12px] text-ink-dim">
        Applies the next time you open Create scan study. Saved in this browser only — like your
        theme and language, it will not follow you to another device.
      </p>
    </fieldset>
  );
}
