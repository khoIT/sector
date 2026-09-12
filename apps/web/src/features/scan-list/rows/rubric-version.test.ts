import { describe, expect, it } from 'vitest';

import { rubricVersionLabel } from './rubric-version';

describe('rubricVersionLabel', () => {
  it('prints the version the scan was submitted under', () => {
    expect(rubricVersionLabel({ version: 5 })).toBe('v5');
    expect(rubricVersionLabel({ version: 1 })).toBe('v1');
    expect(rubricVersionLabel({ version: 6 })).toBe('v6');
  });

  it('prints nothing rather than a broken label when the version is missing', () => {
    expect(rubricVersionLabel({ version: undefined })).toBeNull();
    expect(rubricVersionLabel({})).toBeNull();
    expect(rubricVersionLabel({ version: 0 })).toBeNull();
    expect(rubricVersionLabel({ version: Number.NaN })).toBeNull();
  });
});
