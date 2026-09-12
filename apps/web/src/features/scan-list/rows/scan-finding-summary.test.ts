import { describe, expect, it } from 'vitest';

import { isGapFinding, summariseFindings } from './scan-finding-summary';

function finding(value: string, id = value) {
  return { id, key: 'v2_aaa_long_lvl1', value };
}

describe('isGapFinding', () => {
  it('catches the values that mean the item was not examined', () => {
    expect(isGapFinding('Not Examined')).toBe(true);
    expect(isGapFinding('Not assessed')).toBe(true);
    expect(isGapFinding('Not Measured')).toBe(true);
    expect(isGapFinding('not done')).toBe(true);
    expect(isGapFinding('not applicable')).toBe(true);
    expect(isGapFinding('not recorded ')).toBe(true);
    expect(isGapFinding('N/A')).toBe(true);
  });

  it('never flags a real finding that happens to start with "not"', () => {
    // 243 stored rows. Flagging these accuses a learner of skipping an
    // examination they performed and recorded as normal.
    expect(isGapFinding('Not Widened')).toBe(false);
    expect(isGapFinding('Not Distended')).toBe(false);
    expect(isGapFinding('Not thick')).toBe(false);
  });

  it('survives the case and spacing drift in the stored vocabulary', () => {
    expect(isGapFinding('NotMeasured')).toBe(true);
    expect(isGapFinding('not measured ')).toBe(true);
    expect(isGapFinding('Not Assessed')).toBe(true);
    expect(isGapFinding('not examined')).toBe(true);
    expect(isGapFinding('Not Examined.')).toBe(true);
    expect(isGapFinding('Notapplicable')).toBe(true);
  });

  it('recovers the rows where a measurement was typed through the word', () => {
    expect(isGapFinding('Not Exa270.6mined')).toBe(true);
    expect(isGapFinding('Not Examined 31.71')).toBe(true);
    expect(isGapFinding('Not Examined31.78cm35w5d')).toBe(true);
  });

  it('reads anything it does not recognise as a finding, not a gap', () => {
    expect(isGapFinding('Normal')).toBe(false);
    expect(isGapFinding('Present')).toBe(false);
    expect(isGapFinding('Compressible')).toBe(false);
    expect(isGapFinding('≤ 3cm')).toBe(false);
    expect(isGapFinding('')).toBe(false);
    expect(isGapFinding(null)).toBe(false);
    expect(isGapFinding(undefined)).toBe(false);
  });
});

describe('summariseFindings', () => {
  it('counts every finding and the gaps among them', () => {
    expect(
      summariseFindings([finding('Normal', 'a'), finding('Not Examined', 'b'), finding('Present', 'c')]),
    ).toEqual({ count: 3, gaps: 1 });
  });

  it('counts no gaps when every item was examined', () => {
    expect(summariseFindings([finding('Normal', 'a'), finding('Not Widened', 'b')])).toEqual({
      count: 2,
      gaps: 0,
    });
  });

  it('handles an absent list', () => {
    expect(summariseFindings(null)).toEqual({ count: 0, gaps: 0 });
    expect(summariseFindings([])).toEqual({ count: 0, gaps: 0 });
  });
});
