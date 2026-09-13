import type { Db, Document } from 'mongodb';
import type { ZodIssue, ZodTypeAny } from 'zod';

import { RefCache } from './wire';

/**
 * Replay every document of a collection through the schema that parses its
 * API route, and group the failures by SHAPE.
 *
 * The output of a replay over 31,000 scans is useless if it is 31,000 lines.
 * What a maintainer needs is "1,204 rows where `groups` is absent", "2 rows
 * where `review.competencyMeasure` is a boolean" — the distinct ways
 * production disagrees with the schema, each with a count and one document id
 * to go and look at. That is what a shape signature is: the sorted set of
 * (path, issue) pairs, with array indexes collapsed so the seventh file and
 * the first file are the same shape.
 */

export type ReplayContext = {
  db: Db;
  refs: RefCache;
};

export type KnownShape = {
  signature: string;
  /** Why the schema does not accept it — a decision, with the evidence. */
  reason: string;
};

export type ReplayEntry = {
  /** Shown in the report. Name the collection and the route whose shape is emulated. */
  name: string;
  collection: string;
  schema: ZodTypeAny;
  /**
   * The exported schema names this entry proves, including the component
   * schemas composed into the one parsed. The manifest guard checks that
   * every exported schema is either listed here by some entry or explicitly
   * excused in NOT_REPLAYED.
   */
  proves: readonly string[];
  /**
   * Which documents the API would ever serve. Defaults to `deletedAt: null`,
   * the filter the soft-delete plugin adds to every query.
   */
  filter?: Document;
  /** Load whatever `project` will need for this batch of documents. */
  prefetch?: (batch: Document[], context: ReplayContext) => Promise<void>;
  /**
   * Documents the route drops before it serialises anything — a `$unwind` on
   * a join that found nothing, typically. Runs after `prefetch`, so it can
   * consult the references. Dropped documents are counted, not parsed.
   */
  include?: (doc: Document, context: ReplayContext) => boolean;
  /** Raw document → what the route puts on the wire. */
  project: (doc: Document, context: ReplayContext) => unknown;
  /** Shapes production holds that the schema deliberately rejects. */
  knownShapes?: readonly KnownShape[];
};

export type ShapeFailure = {
  signature: string;
  count: number;
  /** One document that has this shape, for `db.<collection>.findOne({_id})`. */
  sampleId: string;
  /** The issues from that sample, so the report can print a message. */
  sampleIssues: ZodIssue[];
};

export type ReplayResult = {
  name: string;
  collection: string;
  total: number;
  parsed: number;
  /** Documents `include` declined: the route would never have sent them. */
  skipped: number;
  shapes: ShapeFailure[];
  durationMs: number;
};

/** Array indexes become `[]` so rows differ only by WHICH field failed and HOW. */
function normalisePath(path: (string | number)[]): string {
  return (
    path.map((segment) => (typeof segment === 'number' ? '[]' : segment)).join('.') || '<root>'
  );
}

/**
 * The part of an issue worth keeping in a signature.
 *
 * Type names and enum options are shapes; string values are data, and some of
 * that data is personal, so a received string is never copied into a
 * signature or a report.
 */
function detail(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return `(${issue.expected}←${issue.received})`;
    case 'invalid_enum_value':
      return typeof issue.received === 'string' && issue.received.length <= 32
        ? `(${issue.received})`
        : `(${typeof issue.received})`;
    case 'too_small':
      return `(min ${String(issue.minimum)})`;
    case 'too_big':
      return `(max ${String(issue.maximum)})`;
    default:
      return '';
  }
}

export function issueSignature(issues: ZodIssue[]): string {
  const parts = new Set<string>();
  for (const issue of issues) {
    parts.add(`${normalisePath(issue.path)}:${issue.code}${detail(issue)}`);
  }
  return [...parts].sort().join(' | ');
}

export type ReplayOptions = {
  batchSize?: number;
  /** Stop after this many documents; for a quick local run, never for the gate. */
  limit?: number;
};

export async function replayEntry(
  db: Db,
  entry: ReplayEntry,
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  const { batchSize = 500, limit } = options;
  const started = Date.now();
  const context: ReplayContext = { db, refs: new RefCache(db) };

  const shapes = new Map<string, ShapeFailure>();
  let total = 0;
  let parsed = 0;
  let skipped = 0;

  const cursor = db
    .collection(entry.collection)
    .find(entry.filter ?? { deletedAt: null })
    .sort({ _id: 1 });
  if (limit) cursor.limit(limit);

  let batch: Document[] = [];
  const flush = async () => {
    if (batch.length === 0) return;
    await entry.prefetch?.(batch, context);
    for (const doc of batch) {
      if (entry.include && !entry.include(doc, context)) {
        skipped += 1;
        continue;
      }
      total += 1;
      const wire = entry.project(doc, context);
      const result = entry.schema.safeParse(wire);
      if (result.success) {
        parsed += 1;
        continue;
      }
      const signature = issueSignature(result.error.issues);
      const existing = shapes.get(signature);
      if (existing) {
        existing.count += 1;
      } else {
        shapes.set(signature, {
          signature,
          count: 1,
          sampleId: String(doc._id),
          sampleIssues: result.error.issues,
        });
      }
    }
    batch = [];
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= batchSize) await flush();
  }
  await flush();

  return {
    name: entry.name,
    collection: entry.collection,
    total,
    parsed,
    skipped,
    shapes: [...shapes.values()].sort((a, b) => b.count - a.count),
    durationMs: Date.now() - started,
  };
}

/** The shapes an entry did not expect: what makes the gate fail. */
export function unexpectedShapes(result: ReplayResult, entry: ReplayEntry): ShapeFailure[] {
  const known = new Set((entry.knownShapes ?? []).map((shape) => shape.signature));
  return result.shapes.filter((shape) => !known.has(shape.signature));
}
