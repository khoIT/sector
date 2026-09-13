import type { FindingDefinition } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { planFindingTransfer } from './transfer-findings';

function definition(partial: Partial<FindingDefinition> & { key: string; name: string }): FindingDefinition {
  return {
    id: partial.key,
    required: false,
    options: [],
    type: 'select',
    dataType: 'text',
    ...partial,
  } as FindingDefinition;
}

describe('planFindingTransfer', () => {
  it('carries an answer whose row is the same on both sides, onto the new key', () => {
    const from = [
      definition({ key: 'v2_fast_ruq', name: 'RUQ - Free Fluid', options: ['Absent', 'Present'] }),
    ];
    const to = [
      definition({ key: 'v5_fast_ruq', name: 'RUQ - Free Fluid', options: ['Absent', 'Present'] }),
    ];

    const plan = planFindingTransfer(from, to, { v2_fast_ruq: 'Present' });

    expect(plan.carried).toEqual({ v5_fast_ruq: 'Present' });
    expect(plan.kept).toEqual([{ key: 'v5_fast_ruq', name: 'RUQ - Free Fluid', value: 'Present' }]);
    expect(plan.cleared).toEqual([]);
  });

  it('ignores case, punctuation and spacing in the name', () => {
    const from = [definition({ key: 'a', name: 'Free fluid — RUQ', options: ['Absent'] })];
    const to = [definition({ key: 'b', name: 'free fluid - ruq', options: ['Absent'] })];

    expect(planFindingTransfer(from, to, { a: 'Absent' }).carried).toEqual({ b: 'Absent' });
  });

  it('clears a same-named row whose options differ', () => {
    // Measured on the real data: AAA's "Long" offers aorta diameters
    // (≤ 3cm / >3 cm / Indeterminate / Not Examined) and Gallbladder's "Long"
    // offers Long / Not Examined. A name-only rule files an aortic measurement
    // as a gallbladder finding, in a control that cannot even display it.
    const from = [
      definition({
        key: 'v2_aaa_long_lvl1',
        name: 'Long',
        options: ['≤ 3cm', '>3 cm', 'Indeterminate', 'Not Examined'],
      }),
    ];
    const to = [
      definition({ key: 'v2_gb_long_lvl1', name: 'Long', options: ['Long', 'Not Examined'] }),
    ];

    const plan = planFindingTransfer(from, to, { v2_aaa_long_lvl1: '≤ 3cm' });

    expect(plan.carried).toEqual({});
    expect(plan.cleared).toEqual([{ key: 'v2_aaa_long_lvl1', name: 'Long', value: '≤ 3cm' }]);
  });

  it('clears when the option sets differ only by one value', () => {
    // FAST and FASH both carry "RUQ - Free Fluid Abdomen"; FAST adds
    // "Not Examined". Close enough to look transferable, different enough that
    // one direction can file a value the destination does not offer.
    const from = [
      definition({
        key: 'fast_ruq',
        name: 'RUQ - Free Fluid Abdomen',
        options: ['Absent', 'Present', 'Indeterminate', 'Not Examined'],
      }),
    ];
    const to = [
      definition({
        key: 'fash_ruq',
        name: 'RUQ - Free Fluid Abdomen',
        options: ['Absent', 'Present', 'Indeterminate'],
      }),
    ];

    expect(planFindingTransfer(from, to, { fast_ruq: 'Absent' }).cleared).toHaveLength(1);
  });

  it('treats option order as irrelevant', () => {
    const from = [definition({ key: 'a', name: 'Effusion', options: ['Present', 'Absent'] })];
    const to = [definition({ key: 'b', name: 'Effusion', options: ['Absent', 'Present'] })];

    expect(planFindingTransfer(from, to, { a: 'Present' }).carried).toEqual({ b: 'Present' });
  });

  it('clears when the control kind differs, even with the same name', () => {
    const from = [definition({ key: 'a', name: 'Diameter', type: 'input', dataType: 'number' })];
    const to = [definition({ key: 'b', name: 'Diameter', options: ['Small', 'Large'] })];

    expect(planFindingTransfer(from, to, { a: '3.2' }).carried).toEqual({});
  });

  it('separates a single-select from a multi-select of the same name and options', () => {
    const from = [
      definition({ key: 'a', name: 'Views', options: ['TA', 'TV'], dataType: 'array' }),
    ];
    const to = [definition({ key: 'b', name: 'Views', options: ['TA', 'TV'], dataType: 'text' })];

    expect(planFindingTransfer(from, to, { a: 'TA,TV' }).cleared).toHaveLength(1);
  });

  it('transfers free text between rows of the same name, options being irrelevant there', () => {
    const from = [definition({ key: 'a', name: 'Comments', type: 'input', dataType: 'text' })];
    const to = [definition({ key: 'b', name: 'Comments', type: 'input', dataType: 'text' })];

    expect(planFindingTransfer(from, to, { a: 'Poor window' }).carried).toEqual({
      b: 'Poor window',
    });
  });

  it('lists neither a row that was never answered', () => {
    const from = [
      definition({ key: 'a', name: 'Answered', options: ['Yes'] }),
      definition({ key: 'b', name: 'Untouched', options: ['Yes'] }),
    ];
    const to: FindingDefinition[] = [];

    const plan = planFindingTransfer(from, to, { a: 'Yes', b: '' });

    expect(plan.cleared).toEqual([{ key: 'a', name: 'Answered', value: 'Yes' }]);
  });

  it('reports an answer whose definition has gone, rather than dropping it silently', () => {
    const plan = planFindingTransfer([], [], { orphan_key: 'Present' });

    expect(plan.cleared).toEqual([{ key: 'orphan_key', name: 'orphan_key', value: 'Present' }]);
    expect(plan.carried).toEqual({});
  });

  it('never matches a heading, which has no answer to carry', () => {
    const from = [definition({ key: 'a', name: 'Views Obtained', options: ['X'] })];
    const to = [definition({ key: 'b', name: 'Views Obtained', type: null })];

    expect(planFindingTransfer(from, to, { a: 'X' }).carried).toEqual({});
  });

  it('plans nothing at all for an empty answer set', () => {
    const plan = planFindingTransfer([definition({ key: 'a', name: 'A' })], [], {});
    expect(plan).toEqual({ carried: {}, kept: [], cleared: [] });
  });
});

describe('planFindingTransfer with duplicate identities', () => {
  // MSK v1 carries six rows called "Effusion", one per joint. They differ only
  // by parent, which the identity deliberately ignores, so they collide.
  const source = [
    definition({ key: 'knee-effusion', name: 'Effusion', options: ['Present', 'Absent'] }),
    definition({ key: 'ankle-effusion', name: 'Effusion', options: ['Present', 'Absent'] }),
  ];
  const destination = [
    definition({ key: 'effusion', name: 'Effusion', options: ['Present', 'Absent'] }),
  ];

  it('carries the first and reports the rest as lost, not as kept', () => {
    const plan = planFindingTransfer(source, destination, {
      'knee-effusion': 'Present',
      'ankle-effusion': 'Absent',
    });

    expect(plan.carried).toEqual({ effusion: 'Present' });
    expect(plan.kept).toEqual([{ key: 'effusion', name: 'Effusion', value: 'Present' }]);
    expect(plan.cleared).toEqual([{ key: 'ankle-effusion', name: 'Effusion', value: 'Absent' }]);
  });

  it('never reports more answers than it carries', () => {
    const plan = planFindingTransfer(source, destination, {
      'knee-effusion': 'Present',
      'ankle-effusion': 'Absent',
    });

    expect(plan.kept.length).toBe(Object.keys(plan.carried).length);
  });
});

describe('planFindingTransfer when the source definitions are unavailable', () => {
  // The definitions query has no retry override, so a failed lookup leaves the
  // source list empty for the rest of the session. Every switch after that
  // used to clear every answer and list raw keys as their names.
  const destination = [
    definition({ key: 'shared', name: 'Free fluid', options: ['Absent', 'Present'] }),
    definition({ key: 'only-there', name: 'Aortic diameter', options: [] }),
  ];

  it('keeps an answer the new scan type still defines under the same key', () => {
    const plan = planFindingTransfer([], destination, { shared: 'Present' });

    expect(plan.carried).toEqual({ shared: 'Present' });
    expect(plan.kept).toEqual([{ key: 'shared', name: 'Free fluid', value: 'Present' }]);
    expect(plan.cleared).toEqual([]);
  });

  it('clears an answer the new scan type has no row for', () => {
    const plan = planFindingTransfer([], destination, { gone: 'Present' });

    expect(plan.carried).toEqual({});
    expect(plan.cleared).toEqual([{ key: 'gone', name: 'gone', value: 'Present' }]);
  });
});
