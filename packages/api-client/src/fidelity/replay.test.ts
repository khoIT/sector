import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { assertLocalMirrorUri } from './mirror';
import { issueSignature } from './replay';
import { pick, toWire } from './wire';

describe('toWire', () => {
  it('reproduces the transform-id plugin at every level', () => {
    const id = new ObjectId('64b8f3a2c1d2e3f4a5b6c7d8');
    const nested = new ObjectId('64b8f3a2c1d2e3f4a5b6c7d9');
    const when = new Date('2026-09-13T10:00:00.000Z');

    expect(
      toWire({
        _id: id,
        __v: 3,
        title: 'x',
        createdAt: when,
        files: [{ _id: nested, __v: 0, filepath: 'a' }],
        review: null,
        parent: nested,
      }),
    ).toEqual({
      id: '64b8f3a2c1d2e3f4a5b6c7d8',
      title: 'x',
      createdAt: '2026-09-13T10:00:00.000Z',
      files: [{ id: '64b8f3a2c1d2e3f4a5b6c7d9', filepath: 'a' }],
      review: null,
      parent: '64b8f3a2c1d2e3f4a5b6c7d9',
    });
  });

  it('leaves scalars alone', () => {
    expect(toWire(3)).toBe(3);
    expect(toWire('s')).toBe('s');
    expect(toWire(undefined)).toBeUndefined();
  });
});

describe('pick', () => {
  it('keeps the id and only the selected fields, absent ones included as absent', () => {
    const doc = { _id: 'i', userName: 'u', email: 'e', password: 'p' };
    expect(pick(doc, ['userName', 'email', 'firstName'])).toEqual({
      _id: 'i',
      userName: 'u',
      email: 'e',
    });
  });
});

describe('issueSignature', () => {
  const schema = z.object({
    files: z.array(z.object({ url: z.string().nullable(), size: z.number() })),
    status: z.enum(['pending', 'reviewed']),
  });

  it('collapses array indexes so rows differ only by field and failure', () => {
    const a = schema.safeParse({ files: [{ url: null, size: 'big' }], status: 'pending' });
    const b = schema.safeParse({
      files: [
        { url: null, size: 1 },
        { url: null, size: 'big' },
      ],
      status: 'pending',
    });
    if (a.success || b.success) throw new Error('both parses were expected to fail');
    expect(issueSignature(a.error.issues)).toBe(issueSignature(b.error.issues));
    expect(issueSignature(a.error.issues)).toBe('files.[].size:invalid_type(number←string)');
  });

  it('keeps an enum value but never a free string', () => {
    const result = schema.safeParse({ files: [], status: 'deleted' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(issueSignature(result.error.issues)).toBe('status:invalid_enum_value(deleted)');
    }
  });

  it('sorts, so the order zod reports in does not split one shape in two', () => {
    const result = schema.safeParse({ files: 'no', status: 3 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const forwards = issueSignature(result.error.issues);
      const backwards = issueSignature([...result.error.issues].reverse());
      expect(forwards).toBe(backwards);
    }
  });
});

describe('assertLocalMirrorUri', () => {
  it('accepts loopback hosts, with a port and a replica-set list', () => {
    expect(() => assertLocalMirrorUri('mongodb://localhost:27017/gusi_prod_mirror')).not.toThrow();
    expect(() =>
      assertLocalMirrorUri('mongodb://127.0.0.1:27017,localhost:27018/m?replicaSet=rs0'),
    ).not.toThrow();
  });

  it('refuses anything that is not on this machine', () => {
    expect(() =>
      assertLocalMirrorUri('mongodb+srv://u:p@gusi-cluster-production.6ljc5.mongodb.net/gusi'),
    ).toThrow(/plain mongodb/);
    expect(() => assertLocalMirrorUri('mongodb://u:p@db.example.com:27017/gusi')).toThrow(
      /this machine/,
    );
    expect(() =>
      assertLocalMirrorUri('mongodb://localhost:27017,shard-00.mongodb.net:27017/gusi'),
    ).toThrow(/mongodb\.net/);
  });

  it('never echoes credentials in the error', () => {
    expect(() => assertLocalMirrorUri('not a uri at all')).toThrow(/not a connection string/);
    try {
      assertLocalMirrorUri('mongodb://:secret-password@nope');
    } catch (error) {
      expect(String(error)).not.toContain('secret-password');
    }
  });
});
