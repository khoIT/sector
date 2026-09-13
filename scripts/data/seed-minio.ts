import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MongoClient, type Db, type Document } from 'mongodb';

import { assertLocalMirrorUri } from '../../packages/api-client/src/fidelity/mirror';

/**
 * Put an object behind a sample of the mirror's `files` rows, so the media
 * surfaces have bytes to fetch when the API is pointed at local MinIO.
 *
 *   pnpm tsx scripts/data/seed-minio.ts [--db gusi_prod_mirror] [--bucket gusi-local]
 *       [--endpoint http://localhost:9000] [--email reviewer@sector.test]... [--scans 12]
 *
 * The dumps carry file RECORDS, not the objects: every `filepath` points into
 * an S3 bucket this machine cannot reach. Real playback of real media needs
 * staging object storage, which is an ask, not a script. What this proves
 * instead is the surface — that a viewer given a resolvable URL for a real
 * production key plays, magnifies and pages — with synthetic bytes:
 *
 *   - images get a generated PNG (a labelled colour field, so magnification
 *     shows edges); browsers render PNG bytes served as image/jpeg
 *   - videos get the API repo's own tiny MP4 test fixture
 *   - DICOM, PDF and archive keys are skipped and reported
 *
 * Scans are chosen from what the named accounts can see — their own studies
 * and the queues of the groups they lead — because those are the pages that
 * get opened in a browser check.
 */

function args(name: string): string[] {
  const values: string[] = [];
  process.argv.forEach((entry, index) => {
    if (entry === name && process.argv[index + 1]) values.push(process.argv[index + 1] as string);
  });
  return values;
}
const arg = (name: string, fallback: string) => args(name)[0] ?? fallback;

const uri = arg('--uri', 'mongodb://localhost:27017/?directConnection=true');
const dbName = arg('--db', 'gusi_prod_mirror');
const bucket = arg('--bucket', 'gusi-local');
const endpoint = arg('--endpoint', 'http://localhost:9000');
const scansPerAccount = Number(arg('--scans', '12'));
const emails = args('--email').length
  ? args('--email')
  : [
      'learner@scanvault.test',
      'reviewer@scanvault.test',
      'leader@scanvault.test',
      'learner@sector.test',
      'reviewer@sector.test',
      'leader@sector.test',
    ];
const VIDEO_FIXTURE = arg(
  '--video',
  new URL('../../../gusi_nodejs_api/tests/fixtures/media/sample-with-metadata.mp4', import.meta.url)
    .pathname,
);

assertLocalMirrorUri(uri);
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(endpoint)) {
  throw new Error(`refusing endpoint '${endpoint}': the object store must be local`);
}

// ─── a PNG without a dependency ─────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

/**
 * A 640×480 field with a diagonal, a border and a checker corner. Something
 * that has edges to magnify and differs from frame to frame across a scan, so
 * paging through stills visibly changes the image.
 */
function syntheticPng(seed: number): Buffer {
  const width = 640;
  const height = 480;
  const hue = (seed * 47) % 360;
  const [r, g, b] = hsl(hue, 0.35, 0.28);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const border = x < 8 || y < 8 || x >= width - 8 || y >= height - 8;
      const diagonal = Math.abs(x - y * (width / height)) < 3;
      const checker = x < 96 && y < 96 && ((x >> 4) + (y >> 4)) % 2 === 0;
      const bright = border || diagonal || checker;
      raw[offset] = bright ? 235 : r;
      raw[offset + 1] = bright ? 225 : g;
      raw[offset + 2] = bright ? 200 : b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ─── which files ────────────────────────────────────────────────────────────

const IMAGE = /^(image\/(jpeg|png|bmp|gif|webp)|jpe?g|png|bmp|gif|webp)$/i;
const VIDEO = /^(video\/(mp4|quicktime)|mp4|mov)$/i;

function contentTypeFor(filetype: string): string {
  if (VIDEO.test(filetype)) return 'video/mp4';
  if (/png$/i.test(filetype)) return 'image/png';
  return 'image/jpeg';
}

async function visibleScanIds(db: Db, email: string): Promise<Document[]> {
  const user = await db.collection('users').findOne({ email });
  if (!user) return [];

  const own = await db
    .collection('scans')
    .find({ user: user._id, deletedAt: null, 'files.0': { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(scansPerAccount)
    .toArray();

  const led = await db
    .collection('groupmembers')
    .find({ user: user._id, role: 'leader', deletedAt: null })
    .toArray();
  const routed = led.length
    ? await db
        .collection('groupuserscans')
        .find({ group: { $in: led.map((m) => m.group) }, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(scansPerAccount * 3)
        .toArray()
    : [];
  const queue = routed.length
    ? await db
        .collection('scans')
        .find({
          _id: { $in: routed.map((r) => r.scan) },
          deletedAt: null,
          'files.0': { $exists: true },
        })
        .sort({ createdAt: 1 })
        .limit(scansPerAccount)
        .toArray()
    : [];

  return [...own, ...queue];
}

async function main(): Promise<void> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();
  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    },
  });

  try {
    const db = client.db(dbName);

    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      process.stdout.write(`created bucket ${bucket}\n`);
    }

    const video = readFileSync(VIDEO_FIXTURE);
    const seen = new Set<string>();
    const counts = { image: 0, video: 0, skipped: 0 };
    const skippedTypes = new Map<string, number>();

    for (const email of emails) {
      const scans = await visibleScanIds(db, email);
      for (const scan of scans) {
        if (seen.has(String(scan._id))) continue;
        seen.add(String(scan._id));

        const files = await db
          .collection('files')
          .find({ _id: { $in: scan.files }, deletedAt: null })
          .toArray();

        let index = 0;
        for (const file of files) {
          const filetype = String(file.filetype ?? '');
          let body: Buffer;
          if (IMAGE.test(filetype)) {
            body = syntheticPng(index);
            counts.image += 1;
          } else if (VIDEO.test(filetype)) {
            body = video;
            counts.video += 1;
          } else {
            counts.skipped += 1;
            skippedTypes.set(filetype, (skippedTypes.get(filetype) ?? 0) + 1);
            continue;
          }
          index += 1;
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: String(file.filepath),
              Body: body,
              ContentType: contentTypeFor(filetype),
            }),
          );
        }
        process.stdout.write(
          `${email.padEnd(26)} ${String(scan.title).padEnd(22)} ${files.length} files\n`,
        );
      }
    }

    process.stdout.write(
      `\nobjects written: ${counts.image} images, ${counts.video} videos; skipped ${counts.skipped}` +
        (skippedTypes.size
          ? ` (${[...skippedTypes].map(([t, n]) => `${t}×${n}`).join(', ')})`
          : '') +
        `\nscans covered: ${seen.size}\n`,
    );
  } finally {
    await client.close();
    s3.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
