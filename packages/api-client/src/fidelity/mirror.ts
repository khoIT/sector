import { MongoClient, type Db } from 'mongodb';

/**
 * The production mirror: a LOCAL database restored from the dumps that sit
 * beside this repository, never the cluster itself.
 *
 * `scripts/data/restore-prod-mirror.sh` builds it. This module only opens it,
 * and refuses to open anything that is not on this machine. The production
 * cluster is read-only by rule, and the one way a replay harness could break
 * that rule is by being handed the wrong URI in an environment variable — so
 * the check is an allow-list of loopback hosts, not a deny-list of Atlas
 * domain names that a new hosting provider would slip past.
 */

export const DEFAULT_MIRROR_URI =
  'mongodb://localhost:27017/gusi_prod_mirror?directConnection=true';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

/**
 * Throws unless every host in the URI is a loopback address.
 *
 * Parsed by hand rather than with `new URL()`: a replica-set connection string
 * lists its hosts separated by commas, which the WHATWG parser rejects as an
 * invalid host, and a validator that cannot read the one URI shape a local
 * replica set needs would be worked around rather than used.
 */
export function assertLocalMirrorUri(uri: string): void {
  const match = /^([a-z+]+):\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri);
  if (!match) {
    throw new Error(`The mirror URI is not a connection string: ${describe(uri)}`);
  }

  const [, scheme, hostList] = match;
  if (scheme?.toLowerCase() !== 'mongodb') {
    // `mongodb+srv:` is how Atlas connection strings are written, and it can
    // only ever resolve through DNS to a remote cluster.
    throw new Error(`The mirror must be a plain mongodb:// URI, got ${scheme}:`);
  }

  const hosts = (hostList ?? '')
    .split(',')
    .map((entry) => entry.replace(/:\d+$/, '').toLowerCase())
    .filter((entry) => entry.length > 0);
  const remote = hosts.filter((host) => !LOOPBACK_HOSTS.has(host));
  if (hosts.length === 0 || remote.length > 0) {
    throw new Error(
      `The mirror must live on this machine; refusing to open ${remote.join(', ') || '<no host>'}. ` +
        'The production cluster is never a fidelity target.',
    );
  }
}

/** The URI with any credentials removed, for error messages. */
function describe(uri: string): string {
  return uri.replace(/\/\/[^@/]+@/, '//<credentials>@');
}

export type Mirror = {
  db: Db;
  uri: string;
  close: () => Promise<void>;
};

/**
 * Open the mirror named by SECTOR_FIDELITY_MONGODB_URI, or the default local one.
 * The database is the one named in the URI path.
 */
export async function openMirror(
  uri = process.env.SECTOR_FIDELITY_MONGODB_URI ?? DEFAULT_MIRROR_URI,
): Promise<Mirror> {
  assertLocalMirrorUri(uri);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();

  const db = client.db();
  if (!db.databaseName || db.databaseName === 'test') {
    await client.close();
    throw new Error('The mirror URI must name a database in its path, e.g. /gusi_prod_mirror');
  }

  return { db, uri, close: () => client.close() };
}
