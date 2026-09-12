import { describe, expect, it } from 'vitest';

import { legacyScanPath } from './legacy-paths';

describe('legacyScanPath', () => {
  // This exact shape is what the API puts in every scan notification email.
  it('sends a legacy scan link to the same scan here', () => {
    expect(legacyScanPath('/dashboard/scans/my-scans/6aa5df4a151345135ceb6f83')).toBe(
      '/scans/my/6aa5df4a151345135ceb6f83',
    );
  });

  it('maps every legacy list', () => {
    expect(legacyScanPath('/dashboard/scans/my-scans')).toBe('/scans/my');
    expect(legacyScanPath('/dashboard/scans/shared-scans')).toBe('/scans/shared');
    expect(legacyScanPath('/dashboard/scans/pending-scans')).toBe('/scans/group/unreviewed');
    expect(legacyScanPath('/dashboard/scans/reviewed-scans')).toBe('/scans/group/reviewed');
    expect(legacyScanPath('/dashboard/scans/expert-scans')).toBe('/scans/expert/unreviewed');
    expect(legacyScanPath('/dashboard/scans/expert-reviewed-scans')).toBe(
      '/scans/expert/reviewed',
    );
  });

  // Otherwise "create" is read as a scan id and the wizard link opens a detail
  // page for a scan that does not exist.
  it('knows create is the wizard, not a scan id', () => {
    expect(legacyScanPath('/dashboard/scans/my-scans/create')).toBe('/scans/create');
  });

  it('tolerates a trailing slash', () => {
    expect(legacyScanPath('/dashboard/scans/my-scans/')).toBe('/scans/my');
  });

  it('lands a bare /dashboard/scans on my scans', () => {
    expect(legacyScanPath('/dashboard/scans')).toBe('/scans/my');
  });

  it('declines anything outside the legacy scan tree, which then 404s normally', () => {
    expect(legacyScanPath('/dashboard/courses')).toBeNull();
    expect(legacyScanPath('/dashboard/scans/qbank-scans')).toBeNull();
    expect(legacyScanPath('/scans/my')).toBeNull();
  });
});
