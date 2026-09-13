import { Binary, Decimal128, Long, ObjectId, type Db, type Document } from 'mongodb';

/**
 * What a raw document looks like once the API has serialised it.
 *
 * Every Mongoose model in gusi_nodejs_api carries `transformIdPlugin`, whose
 * toJSON does exactly three things at every level of the document: copies
 * `_id` to `id`, deletes `_id` and deletes `__v`. JSON then turns ObjectIds
 * into hex strings and Dates into ISO strings. Reproducing that here is what
 * lets a raw BSON document be parsed by the same schema that parses the wire,
 * so that the replay tests the schema against production shapes rather than
 * against a hand-written fixture of what production is believed to hold.
 *
 * Anything the API adds on top of toJSON — populated references, presigned
 * media URLs, the pendingFiles fallback — is the job of a per-collection
 * projection in ./projections, because it differs per route.
 */
export function toWire(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Decimal128) return Number(value.toString());
  if (value instanceof Long) return value.toNumber();
  if (value instanceof Binary) return value.toString('base64');
  if (Array.isArray(value)) return value.map(toWire);

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__v') continue;
      if (key === '_id') {
        out.id = toWire(inner);
        continue;
      }
      out[key] = toWire(inner);
    }
    return out;
  }

  return value;
}

/** `select: 'a b c'` on a populate: the subset of fields plus the id. */
export function pick(doc: Document, fields: readonly string[]): Document {
  const out: Document = { _id: doc._id };
  for (const field of fields) {
    if (field in doc) out[field] = doc[field];
  }
  return out;
}

function keyOf(id: unknown): string | null {
  if (id instanceof ObjectId) return id.toHexString();
  if (typeof id === 'string') return id;
  return null;
}

/**
 * The documents a populate would have fetched, by collection and id.
 *
 * Two loading strategies, chosen per collection by the projection that needs
 * it: `loadAll` reads a whole collection once (users, scan types, groups —
 * everything under a few thousand documents), and `prefetch` reads exactly
 * the ids a batch of parent documents references (files, findings, notes,
 * reviews — the collections with tens of thousands of rows). Both remember
 * what they did not find, so a dangling reference is looked up once.
 *
 * `get` applies the soft-delete plugin's rule: every Mongoose query in the
 * API has `deletedAt: null` injected, populate included, so a reference to a
 * soft-deleted document resolves to nothing on the wire, exactly as if the
 * document were gone.
 */
export class RefCache {
  private readonly byCollection = new Map<string, Map<string, Document | null>>();
  private readonly whole = new Set<string>();
  /** Child documents grouped by a foreign key, for one-to-many joins. */
  private readonly byForeignKey = new Map<string, Map<string, Document[]>>();

  constructor(private readonly db: Db) {}

  private bucket(collection: string): Map<string, Document | null> {
    let bucket = this.byCollection.get(collection);
    if (!bucket) {
      bucket = new Map();
      this.byCollection.set(collection, bucket);
    }
    return bucket;
  }

  async loadAll(collection: string): Promise<void> {
    if (this.whole.has(collection)) return;
    const bucket = this.bucket(collection);
    for await (const doc of this.db.collection(collection).find()) {
      bucket.set((doc._id as ObjectId).toHexString(), doc);
    }
    this.whole.add(collection);
  }

  async prefetch(collection: string, ids: Iterable<unknown>): Promise<void> {
    if (this.whole.has(collection)) return;
    const bucket = this.bucket(collection);

    const missing: ObjectId[] = [];
    for (const id of ids) {
      const key = keyOf(id);
      if (key && !bucket.has(key) && ObjectId.isValid(key)) missing.push(new ObjectId(key));
    }
    if (missing.length === 0) return;

    for await (const doc of this.db.collection(collection).find({ _id: { $in: missing } })) {
      bucket.set((doc._id as ObjectId).toHexString(), doc);
    }
    // Anything still absent was not in the collection. Remember that too.
    for (const id of missing) {
      const key = id.toHexString();
      if (!bucket.has(key)) bucket.set(key, null);
    }
  }

  /**
   * Load every child whose `field` points at one of `parentIds`, for joins
   * that run the other way (groupuserscans → scan, scanformfields → form).
   */
  async prefetchChildren(
    collection: string,
    field: string,
    parentIds: Iterable<unknown>,
  ): Promise<void> {
    const name = `${collection}.${field}`;
    let index = this.byForeignKey.get(name);
    if (!index) {
      index = new Map();
      this.byForeignKey.set(name, index);
    }

    const missing: ObjectId[] = [];
    for (const id of parentIds) {
      const key = keyOf(id);
      if (key && !index.has(key) && ObjectId.isValid(key)) missing.push(new ObjectId(key));
    }
    if (missing.length === 0) return;

    for (const id of missing) index.set(id.toHexString(), []);
    for await (const doc of this.db.collection(collection).find({ [field]: { $in: missing } })) {
      const key = keyOf(doc[field]);
      if (key) index.get(key)?.push(doc);
    }
  }

  children(collection: string, field: string, parentId: unknown): Document[] {
    const key = keyOf(parentId);
    if (!key) return [];
    return (this.byForeignKey.get(`${collection}.${field}`)?.get(key) ?? []).filter(
      (doc) => doc.deletedAt === null || doc.deletedAt === undefined,
    );
  }

  /** The referenced document, or null when absent or soft-deleted. */
  get(collection: string, id: unknown): Document | null {
    const key = keyOf(id);
    if (!key) return null;
    const doc = this.byCollection.get(collection)?.get(key) ?? null;
    if (!doc) return null;
    if (doc.deletedAt !== null && doc.deletedAt !== undefined) return null;
    return doc;
  }

  /**
   * A populated ARRAY. Mongoose drops the entries it cannot resolve from a
   * populated array (retainNullValues is false by default), so a scan whose
   * files were deleted arrives with a shorter array, not one full of nulls.
   */
  many(collection: string, ids: unknown): Document[] {
    if (!Array.isArray(ids)) return [];
    return ids.map((id) => this.get(collection, id)).filter((doc): doc is Document => doc !== null);
  }
}
