import type { EmbeddedScanNote, Scan, UserBasic } from '@scanvault/api-client';
import { userDisplayName } from '@scanvault/api-client';

/**
 * Small derivations over scan/note shapes, specific to the detail surface.
 *
 * Generic display formatters (dates, byte sizes) are NOT here — they are shared
 * with the list and create-scan surfaces and live in `@/lib/format`.
 */

/** Notes embed their author either populated or as a bare ObjectId string. */
export function noteAuthorId(user: string | UserBasic): string {
  return typeof user === 'string' ? user : user.id;
}

export function noteAuthorName(user: string | UserBasic): string {
  return typeof user === 'string' ? 'Unknown user' : userDisplayName(user);
}

type NoteLike = Pick<EmbeddedScanNote, 'id' | 'note' | 'createdAt'> & {
  user: string | UserBasic;
};

/**
 * The learner's own note on their scan — in practice the question they are
 * asking the reviewer ("is this effusion or fat pad?").
 *
 * It is stored as an ordinary scan note, indistinguishable in the data from a
 * reviewer's reply except by author, so it is found by matching the note author
 * against the scan owner and taking the EARLIEST such note: later ones are the
 * learner answering back in the thread, not the original question.
 */
export function findLearnerQuestion<T extends NoteLike>(
  scan: Pick<Scan, 'user'>,
  notes: readonly T[],
): T | null {
  const ownerId = scan.user.id;
  let earliest: T | null = null;

  for (const note of notes) {
    if (noteAuthorId(note.user) !== ownerId) continue;
    if (!earliest || note.createdAt < earliest.createdAt) earliest = note;
  }

  return earliest;
}

export type ClinicalNote = {
  note: string;
  author: string;
  createdAt: string;
};

/**
 * The learner's question, shaped for the context panel's callout.
 *
 * Generic over the note type because the two detail pages read DIFFERENT note
 * shapes off the wire — `/api/scan/*` embeds `scanNoteSchema`, the shared-scan
 * route embeds its own narrower note — and both satisfy `NoteLike`.
 */
export function clinicalNoteFor<T extends NoteLike>(
  scan: Pick<Scan, 'user'> & { notes: readonly T[] },
): ClinicalNote | null {
  const note = findLearnerQuestion(scan, scan.notes);
  if (!note) return null;
  return { note: note.note, author: noteAuthorName(note.user), createdAt: note.createdAt };
}
