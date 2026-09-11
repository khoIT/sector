import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SIGNED_IN_PATH,
  loginPathFor,
  returnPathFrom,
  safeRedirect,
} from './safe-redirect';

/**
 * The `?from=` value reaches safeRedirect straight off the query string, so
 * every case here is an attacker-supplied string. A miss turns the post-login
 * navigate() into an open redirect.
 */
describe('safeRedirect', () => {
  it('keeps ordinary in-app paths, query strings included', () => {
    expect(safeRedirect('/scans/group/unreviewed')).toBe('/scans/group/unreviewed');
    expect(safeRedirect('/scans/my?page=3&sort=-createdAt')).toBe(
      '/scans/my?page=3&sort=-createdAt',
    );
  });

  it('falls back when there is nothing to return to', () => {
    expect(safeRedirect(null)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeRedirect(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeRedirect('')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirect('https://evil.example/steal')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeRedirect('http://evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeRedirect('javascript:alert(1)')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('rejects protocol-relative URLs in both slash and backslash form', () => {
    // Browsers normalise `\` to `/`, so `/\host` is protocol-relative too and a
    // naive startsWith('/') check would let it through.
    expect(safeRedirect('//evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeRedirect('/\\evil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('honours an explicit fallback', () => {
    expect(safeRedirect('//evil.example', '/scans/my')).toBe('/scans/my');
  });
});

describe('loginPathFor', () => {
  it('carries the attempted location, encoded', () => {
    expect(loginPathFor({ pathname: '/scans/my', search: '?page=2' })).toBe(
      '/login?from=%2Fscans%2Fmy%3Fpage%3D2',
    );
  });

  it('omits the round trip when the target is the default landing path', () => {
    expect(loginPathFor({ pathname: '/', search: '' })).toBe('/login');
  });
});

describe('returnPathFrom', () => {
  it('round-trips what loginPathFor wrote', () => {
    const search = loginPathFor({ pathname: '/scans/expert/unreviewed', search: '' }).replace(
      '/login',
      '',
    );
    expect(returnPathFrom(search)).toBe('/scans/expert/unreviewed');
  });

  it('sanitises a hand-crafted from value', () => {
    expect(returnPathFrom('?from=https%3A%2F%2Fevil.example')).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
