import type { FindingDefinition } from '@sector/api-client';

import { countStored, countTracked } from './file-counts';
import { missingRequiredFindings, type FindingAnswers } from './finding-controls';
import type { DraftFile } from './draft-types';

/**
 * What is still missing, as four counters.
 *
 * The stepper answered "where am I", which is the wrong question for a
 * document: nothing in this flow has to happen in an order, and the gates that
 * enforced one protected nothing — neither `interpretation` nor `routing`
 * wrote anything the previous step had to finish first.
 *
 * The question a learner actually asks before submitting is "what is still
 * missing". These counters answer it, from state the inline warnings already
 * compute, and the submit surface reads the same function so the two screens
 * cannot disagree.
 */

export type ReadinessState = 'done' | 'partial' | 'empty';

export type ReadinessItem = {
  id: 'files' | 'exam' | 'findings' | 'note';
  label: string;
  state: ReadinessState;
  /** Short status, or null when the label alone says it. */
  detail: string | null;
};

export type ReadinessInput = {
  files: DraftFile[];
  scanTypeId: string | null;
  definitions: readonly FindingDefinition[];
  findings: FindingAnswers;
  note: string;
};

function filesReadiness(files: DraftFile[]): ReadinessItem {
  const tracked = countTracked(files);
  const stored = countStored(files);

  if (tracked === 0) {
    return { id: 'files', label: 'Files', state: 'empty', detail: 'none yet' };
  }

  // `partial` while any tracked file is short of storage — that covers
  // uploading, failed and detached alike, which is what the caller needs to
  // know: the study is not yet safe to submit.
  return {
    id: 'files',
    label: 'Files',
    state: stored === tracked ? 'done' : 'partial',
    detail: stored === tracked ? `${stored}` : `${stored} of ${tracked}`,
  };
}

function findingsReadiness(
  scanTypeId: string | null,
  definitions: readonly FindingDefinition[],
  findings: FindingAnswers,
): ReadinessItem {
  if (!scanTypeId) {
    return { id: 'findings', label: 'Findings', state: 'empty', detail: null };
  }

  const missing = missingRequiredFindings(definitions, findings);
  const answered = Object.values(findings).filter((value) => value).length;

  if (missing.length > 0) {
    // Counted against the REQUIRED rows, not every row: a study with 40
    // optional rows and 7 required ones is ready at 7, and a counter reading
    // "4 of 40" would say the opposite.
    const required = definitions.filter(
      (definition) => definition.required && !missing.includes(definition),
    ).length;
    return {
      id: 'findings',
      label: 'Findings',
      state: required > 0 ? 'partial' : 'empty',
      detail: `${required} of ${required + missing.length}`,
    };
  }

  return {
    id: 'findings',
    label: 'Findings',
    state: answered > 0 ? 'done' : 'empty',
    detail: answered > 0 ? `${answered}` : null,
  };
}

export function readinessFor(input: ReadinessInput): ReadinessItem[] {
  return [
    filesReadiness(input.files),
    {
      id: 'exam',
      label: 'Exam',
      state: input.scanTypeId ? 'done' : 'empty',
      detail: null,
    },
    findingsReadiness(input.scanTypeId, input.definitions, input.findings),
    {
      // The note is genuinely optional, so it is never `partial` and its empty
      // state is not a warning — it is the difference between "nothing here"
      // and "not applicable", which the learner is entitled to decide.
      id: 'note',
      label: 'Note',
      state: input.note.trim() ? 'done' : 'empty',
      detail: null,
    },
  ];
}

/**
 * What stops a submit, in the order a learner should fix it.
 *
 * Only files and exam type are blocking: the server rejects a study with no
 * scan type, and submitting before the bytes land loses them. Unanswered
 * findings are not blocking — the server does not enforce them either, and
 * refusing to submit over a row someone genuinely could not assess pushes
 * people to invent an answer.
 */
export function submitBlockers(items: readonly ReadinessItem[]): ReadinessItem[] {
  return items.filter(
    (item) => (item.id === 'files' || item.id === 'exam') && item.state !== 'done',
  );
}
