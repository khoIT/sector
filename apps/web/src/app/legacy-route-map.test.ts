import { describe, expect, it } from 'vitest';

import { LEGACY_ROOTS, LEGACY_ROUTES, resolveLegacyPath } from './legacy-route-map';

/**
 * Every path the dashboard's router declared, copied from its App.tsx. The
 * test that this list resolves is the programme's acceptance criterion in
 * executable form: no legacy URL may 404 after cutover.
 */
const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/account',
  '/dashboard/orders',
  '/dashboard/referrals',
  '/dashboard/certificates',
  '/dashboard/dicom-upload',
  '/dashboard/scans/my-scans',
  '/dashboard/scans/my-scans/create',
  '/dashboard/scans/my-scans/6aa5df4a151345135ceb6f83',
  '/dashboard/scans/my-scans/6aa5df4a151345135ceb6f83/upload-file',
  '/dashboard/scans/shared-scans',
  '/dashboard/scans/shared-scans/6aa5df4a151345135ceb6f83',
  '/dashboard/scans/pending-scans',
  '/dashboard/scans/pending-scans/6aa5df4a151345135ceb6f83',
  '/dashboard/scans/reviewed-scans',
  '/dashboard/scans/reviewed-scans/6aa5df4a151345135ceb6f83',
  '/dashboard/scans/expert-scans',
  '/dashboard/scans/expert-scans/6aa5df4a151345135ceb6f83',
  '/dashboard/scans/expert-reviewed-scans',
  '/dashboard/scans/expert-reviewed-scans/6aa5df4a151345135ceb6f83',
  '/dashboard/scans/scan-vault',
  '/dashboard/manage-group',
  '/dashboard/manage-group/6a6ae3d759ab84398c7cee4f/learners',
  '/dashboard/manage-group/6a6ae3d759ab84398c7cee4f/assignments',
  '/dashboard/manage-group-v1',
  '/dashboard/manage-group-v2',
  '/dashboard/not-authorized',
  '/dashboard/fellowship',
  '/dashboard/fellowship/mentee',
  '/dashboard/pathology-gallery',
  '/dashboard/question-banks',
  '/dashboard/question-banks/echo-basics',
  '/dashboard/knowledge-challenge',
  '/dashboard/interpretation-challenge',
  '/dashboard/resources',
  '/dashboard/my-courses',
  '/dashboard/my-courses/681a4b50779a0d9e6c9cc4f2/list',
  '/dashboard/my-courses/681a4b50779a0d9e6c9cc4f2',
  '/dashboard/my-courses/681a4b50779a0d9e6c9cc4f2/lessons/681a4d0facc6f28eaec5e013',
  '/dashboard/my-courses/681a4b50779a0d9e6c9cc4f2/lessons/681a4d0facc6f28eaec5e013/topics/681a4d0facc6f28eaec5e014',
  '/dashboard/my-courses/681a4b50779a0d9e6c9cc4f2/lessons/681a4d0facc6f28eaec5e013/topics/681a4d0facc6f28eaec5e014/quizzes/681a4ee04bc509ae575979c3',
  '/dashboard/my-courses/681a4b50779a0d9e6c9cc4f2/lessons/681a4d0facc6f28eaec5e013/quizzes/681a4ee04bc509ae575979c3',
  '/dashboard/my-courses/681a4b50779a0d9e6c9cc4f2/quizzes/681a4ee04bc509ae575979c3',
  '/dashboard/sage-ai',
  '/dashboard/payment-methods',
  '/dashboard/notifications',
  '/dashboard/notifications/68deb53a394f8fec3ad7ad00',
  '/dashboard/settings',
  '/dashboard/checkout',
  '/dashboard/thank-you',
  '/switch-user',
  '/certificates/68deb53a394f8fec3ad7ad00',
  '/register',
  '/register/verify',
  '/store-listing/checkout',
  '/store-listing/thank-you',
];

describe('every dashboard route has a destination or a reason', () => {
  it.each(DASHBOARD_ROUTES)('%s', (path) => {
    expect(resolveLegacyPath(path).kind).not.toBe('unknown');
  });

  it('declines what the dashboard never routed either', () => {
    expect(resolveLegacyPath('/dashboard/courses').kind).toBe('unknown');
    expect(resolveLegacyPath('/dashboard/scans/qbank-scans').kind).toBe('unknown');
    expect(resolveLegacyPath('/scans/my').kind).toBe('unknown');
  });

  it('starts every legacy path at a root the router claims', () => {
    for (const route of LEGACY_ROUTES) {
      const root = route.legacy.split('/')[1];
      expect(LEGACY_ROOTS, route.legacy).toContain(root);
    }
  });

  it('gives every retirement a non-empty note, because the document prints it', () => {
    for (const route of LEGACY_ROUTES) {
      const resolution = route.resolve({});
      if (resolution.kind === 'retired')
        expect(route.note.length, route.legacy).toBeGreaterThan(20);
    }
  });
});

describe('scan links', () => {
  // This exact shape is what the API puts in every scan notification email.
  it('sends a legacy scan link to the same scan here', () => {
    expect(resolveLegacyPath('/dashboard/scans/my-scans/6aa5df4a151345135ceb6f83')).toEqual({
      kind: 'redirect',
      to: '/scans/my/6aa5df4a151345135ceb6f83',
    });
  });

  it('maps every legacy list', () => {
    const to = (path: string) => (resolveLegacyPath(path) as { to: string }).to;
    expect(to('/dashboard/scans/my-scans')).toBe('/scans/my');
    expect(to('/dashboard/scans/shared-scans')).toBe('/scans/shared');
    expect(to('/dashboard/scans/pending-scans')).toBe('/scans/group/unreviewed');
    expect(to('/dashboard/scans/reviewed-scans')).toBe('/scans/group/reviewed');
    expect(to('/dashboard/scans/expert-scans')).toBe('/scans/expert/unreviewed');
    expect(to('/dashboard/scans/expert-reviewed-scans')).toBe('/scans/expert/reviewed');
  });

  // Otherwise "create" is read as a scan id and the wizard link opens a detail
  // page for a scan that does not exist.
  it('knows create is the wizard, not a scan id', () => {
    expect(resolveLegacyPath('/dashboard/scans/my-scans/create')).toEqual({
      kind: 'redirect',
      to: '/scans/create',
    });
  });

  it('tolerates a trailing slash', () => {
    expect(resolveLegacyPath('/dashboard/scans/my-scans/')).toEqual({
      kind: 'redirect',
      to: '/scans/my',
    });
  });

  it('drops the upload-file tail and lands on the scan', () => {
    expect(
      resolveLegacyPath('/dashboard/scans/my-scans/6aa5df4a151345135ceb6f83/upload-file'),
    ).toEqual({ kind: 'redirect', to: '/scans/my/6aa5df4a151345135ceb6f83' });
  });
});

describe('course links', () => {
  it('collapses the four quiz nestings onto one item route', () => {
    const c = '681a4b50779a0d9e6c9cc4f2';
    const q = '681a4ee04bc509ae575979c3';
    const expected = { kind: 'redirect', to: `/learn/courses/${c}/${q}` };
    expect(resolveLegacyPath(`/dashboard/my-courses/${c}/quizzes/${q}`)).toEqual(expected);
    expect(resolveLegacyPath(`/dashboard/my-courses/${c}/lessons/l1/quizzes/${q}`)).toEqual(
      expected,
    );
    expect(
      resolveLegacyPath(`/dashboard/my-courses/${c}/lessons/l1/topics/t1/quizzes/${q}`),
    ).toEqual(expected);
  });

  it('keeps the slug of a question bank', () => {
    expect(resolveLegacyPath('/dashboard/question-banks/echo-basics')).toEqual({
      kind: 'redirect',
      to: '/learn/question-banks/echo-basics',
    });
  });
});

describe('retired surfaces', () => {
  it('names the reason and offers the nearest live surface', () => {
    expect(resolveLegacyPath('/dashboard/orders')).toEqual({
      kind: 'retired',
      reason: 'commerce',
      alternative: '/scans/create',
    });
    expect(resolveLegacyPath('/dashboard/fellowship/mentee')).toMatchObject({
      kind: 'retired',
      reason: 'fellowship',
    });
    expect(resolveLegacyPath('/register/verify')).toMatchObject({
      kind: 'retired',
      reason: 'registration',
      alternative: '/login',
    });
  });

  it('decodes an encoded segment before handing it on', () => {
    expect(resolveLegacyPath('/dashboard/question-banks/echo%20basics')).toEqual({
      kind: 'redirect',
      to: '/learn/question-banks/echo basics',
    });
  });
});
