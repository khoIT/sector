import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CREATE_SCAN_FLOW,
  flowOwnsStep,
  readCreateScanFlow,
  stepForFlow,
  writeCreateScanFlow,
} from './create-scan-flow';

describe('reading the stored flow preference', () => {
  it('returns what was stored', () => {
    expect(readCreateScanFlow({ getItem: () => 'classic' })).toBe('classic');
  });

  it.each([[null], ['wizard'], ['']])('falls back to the default for %p', (stored) => {
    expect(readCreateScanFlow({ getItem: () => stored })).toBe(DEFAULT_CREATE_SCAN_FLOW);
  });

  it('survives storage that throws, as private mode does', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readCreateScanFlow(storage)).toBe(DEFAULT_CREATE_SCAN_FLOW);
  });

  it('survives having no storage at all', () => {
    expect(readCreateScanFlow(null)).toBe(DEFAULT_CREATE_SCAN_FLOW);
  });
});

describe('writing the flow preference', () => {
  it('stores the choice', () => {
    const written: Array<[string, string]> = [];
    writeCreateScanFlow({ setItem: (key, value) => written.push([key, value]) }, 'classic');

    expect(written).toEqual([['sector.create-scan.flow', 'classic']]);
  });

  it('does not throw when storage refuses', () => {
    // A preference that cannot be saved must not take the page down with it.
    expect(() =>
      writeCreateScanFlow(
        {
          setItem: () => {
            throw new Error('QuotaExceededError');
          },
        },
        'classic',
      ),
    ).not.toThrow();
  });
});

describe('which steps a flow can draw', () => {
  it.each([
    ['study', 'study', true],
    ['submit', 'study', false],
    ['submit', 'classic', false],
    ['files', 'study', false],
    ['files', 'classic', true],
    ['routing', 'classic', true],
    ['study', 'classic', false],
    ['submitted', 'study', true],
    ['submitted', 'classic', true],
  ] as const)('%s in the %s flow → %s', (step, flow, owned) => {
    expect(flowOwnsStep(step, flow)).toBe(owned);
  });
});

describe('carrying a draft across a flow change', () => {
  it.each([
    ['study', 'files'],
    ['submit', 'routing'],
  ] as const)('study flow %s becomes classic %s', (from, to) => {
    expect(stepForFlow(from, 'classic')).toBe(to);
  });

  it.each([
    ['files', 'study'],
    ['interpretation', 'study'],
    ['routing', 'study'],
  ] as const)('classic %s becomes study-flow %s', (from, to) => {
    expect(stepForFlow(from, 'study')).toBe(to);
  });

  it('lands a draft parked on the retired submit step somewhere drawable', () => {
    // The study flow submits through a confirm dialog now, so `submit` is a
    // step nothing renders. A draft saved on it before that change must still
    // open — on the surface in one flow, on the last wizard step in the other.
    expect(stepForFlow('submit', 'study')).toBe('study');
    expect(stepForFlow('submit', 'classic')).toBe('routing');
  });

  it('leaves the receipt alone in both directions', () => {
    // A submitted study has a scan id. Sending it back to a working surface
    // would invite a second submission of the same scan.
    expect(stepForFlow('submitted', 'classic')).toBe('submitted');
    expect(stepForFlow('submitted', 'study')).toBe('submitted');
  });

  it('leaves a step the flow already owns untouched', () => {
    expect(stepForFlow('interpretation', 'classic')).toBe('interpretation');
    expect(stepForFlow('study', 'study')).toBe('study');
  });
});
