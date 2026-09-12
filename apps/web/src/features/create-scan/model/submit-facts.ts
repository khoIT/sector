/**
 * The lines in the submit confirm, and which of them should look worrying.
 *
 * Separated from the dialog so the wording rules can be tested. The rules are
 * the point: a confirm that reports the optimistic number for everything is a
 * confirm nobody reads twice.
 */

export type SubmitFact = {
  label: string;
  value: string;
  /** True but not what the learner intended. Drawn in the warning colour. */
  concerning?: boolean;
};

export type SubmitFactsInput = {
  scanTypeName: string | null;
  /** Files that reached storage, and files the study is tracking. */
  stored: number;
  tracked: number;
  /** Answered findings, and how many the scan type declares. */
  answered: number;
  definitions: number;
  /** Required rows left blank. */
  missingRequired: number;
  groupNames: readonly string[];
  /** The chosen credit source, or null when no review was requested. */
  expertReviewLabel: string | null;
};

export function submitFacts(input: SubmitFactsInput): SubmitFact[] {
  const facts: SubmitFact[] = [
    {
      label: 'Scan type',
      value: input.scanTypeName ?? 'Not chosen',
      concerning: !input.scanTypeName,
    },
    filesFact(input.stored, input.tracked),
    findingsFact(input.answered, input.definitions, input.missingRequired),
    groupsFact(input.groupNames),
  ];

  facts.push({
    label: 'Expert review',
    value: input.expertReviewLabel ?? 'Not requested',
  });

  return facts;
}

/**
 * Only what is in storage is going to be sent.
 *
 * The shortfall is named rather than folded into a total, because "3 files"
 * over a study where one upload failed is the single most expensive thing this
 * dialog could say.
 */
function filesFact(stored: number, tracked: number): SubmitFact {
  if (tracked === 0) return { label: 'Files', value: 'None', concerning: true };
  if (stored === 0) {
    return { label: 'Files', value: `None of ${tracked} in storage yet`, concerning: true };
  }
  if (stored < tracked) {
    return {
      label: 'Files',
      value: `${stored} of ${tracked} — the rest will be left out`,
      concerning: true,
    };
  }
  return { label: 'Files', value: `${stored} in storage` };
}

function findingsFact(answered: number, definitions: number, missingRequired: number): SubmitFact {
  if (definitions === 0) return { label: 'Findings', value: 'None for this scan type' };

  const value = `${answered} of ${definitions} answered`;
  if (missingRequired === 0) return { label: 'Findings', value };

  return {
    label: 'Findings',
    value: `${value} · ${missingRequired} required still blank`,
    concerning: true,
  };
}

/**
 * Who will see it — the one thing on this dialog that cannot be repaired
 * afterwards, since the API has no route that adds a group to an existing scan.
 */
function groupsFact(groupNames: readonly string[]): SubmitFact {
  if (groupNames.length === 0) {
    return { label: 'Shared with', value: 'Nobody — no group selected', concerning: true };
  }
  return { label: 'Shared with', value: groupNames.join(', ') };
}
