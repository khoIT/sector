import type { Document } from 'mongodb';

import type { ReplayContext } from '../replay';
import { toWire } from '../wire';
import { mediaFile, pendingFilePlaceholder, populatedScanTypeRef, populatedUser } from './common';

/**
 * A scan as GET /api/scan/:id/get (and the list routes) put it on the wire.
 *
 * Follows `scanService.populateScan` and `scan.controller.getScanById` in
 * gusi_nodejs_api: user, scanType, findings, files, review (with its user),
 * notes (with their users), form, logs and scanLogs are populated; files are
 * mapped to media objects; when no File document survived, `pendingFiles`
 * stands in with synthetic ids; `groups` comes from the groupuserscans join
 * that only the LIST routes perform. Emitting the union of both routes is
 * deliberate — the schema is shared between them and has to hold for either.
 *
 * `scanLogs` references the userlogs collection, which no dump holds, so the
 * emulated populate drops every entry and the field is an empty array here.
 * That is one shape the replay cannot test from the dumps; the live route
 * check covers it.
 */
export async function prefetchScans(batch: Document[], { refs }: ReplayContext): Promise<void> {
  await Promise.all([refs.loadAll('users'), refs.loadAll('scantypes'), refs.loadAll('groups')]);

  const files: unknown[] = [];
  const findings: unknown[] = [];
  const notes: unknown[] = [];
  const reviews: unknown[] = [];
  for (const scan of batch) {
    if (Array.isArray(scan.files)) files.push(...scan.files);
    if (Array.isArray(scan.findings)) findings.push(...scan.findings);
    if (Array.isArray(scan.notes)) notes.push(...scan.notes);
    if (scan.review) reviews.push(scan.review);
  }

  await Promise.all([
    refs.prefetch('files', files),
    refs.prefetch('scanfindings', findings),
    refs.prefetch('scannotes', notes),
    refs.prefetch('scanreviews', reviews),
    refs.prefetchChildren(
      'groupuserscans',
      'scan',
      batch.map((scan) => scan._id),
    ),
  ]);
}

export function projectScanReview(review: Document, { refs }: ReplayContext): unknown {
  return { ...(toWire(review) as Record<string, unknown>), user: populatedUser(refs, review.user) };
}

export function projectScan(scan: Document, context: ReplayContext): unknown {
  const { refs } = context;

  const files = refs.many('files', scan.files).map(mediaFile);
  const pending = Array.isArray(scan.pendingFiles)
    ? scan.pendingFiles.map((entry: Document, index: number) =>
        pendingFilePlaceholder(entry, index),
      )
    : [];

  const notes = refs.many('scannotes', scan.notes).map((note) => ({
    id: String(note._id),
    note: note.note,
    user: populatedUser(refs, note.user),
    createdAt: toWire(note.createdAt),
  }));

  const findings = refs
    .many('scanfindings', scan.findings)
    .map((finding) => ({ id: String(finding._id), key: finding.key, value: finding.value }));

  const review = refs.get('scanreviews', scan.review);

  // The LIST mapper (batchGetGroupsByScanIds) selects `_id name`, dedupes and
  // skips a membership whose group did not populate; the DETAIL route's
  // per-scan resolver keeps populate's null for a soft-deleted group. Emit the
  // detail behaviour — it is the stricter of the two for the shared schema.
  const groupIds = new Set<string>();
  const groups: unknown[] = [];
  for (const membership of refs.children('groupuserscans', 'scan', scan._id)) {
    const group = refs.get('groups', membership.group);
    if (!group) {
      groups.push(null);
      continue;
    }
    const id = String(group._id);
    if (groupIds.has(id)) continue;
    groupIds.add(id);
    groups.push({ _id: id, name: group.name });
  }

  const logs = Array.isArray(scan.logs)
    ? scan.logs.map((log: Document) => ({
        ...(toWire(log) as Record<string, unknown>),
        user: log.user ? populatedUser(refs, log.user) : log.user,
      }))
    : [];

  return {
    ...(toWire(scan) as Record<string, unknown>),
    user: populatedUser(refs, scan.user),
    scanType: populatedScanTypeRef(refs, scan.scanType),
    files: files.length > 0 ? files : pending,
    findings,
    notes,
    groups,
    review: review ? projectScanReview(review, context) : review === null ? null : undefined,
    logs,
    // userlogs is in no dump; see the module comment.
    scanLogs: [],
  };
}

/**
 * The scan summary embedded in a shared-scan list item: the shared-scan
 * service populates `scan` with its user and scanType, and the mapper replaces
 * `files` with media objects. Nothing else on the scan is reshaped.
 */
export function projectSharedScanSummary(scan: Document, { refs }: ReplayContext): unknown {
  return {
    ...(toWire(scan) as Record<string, unknown>),
    user: populatedUser(refs, scan.user),
    scanType: populatedScanTypeRef(refs, scan.scanType),
    files: refs.many('files', scan.files).map(mediaFile),
  };
}
