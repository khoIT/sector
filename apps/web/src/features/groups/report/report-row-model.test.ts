import type { GroupScanReportEntry } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import {
  completionValue,
  formatLastActive,
  lastActiveValue,
  learnerName,
  sortReportRows,
} from './report-row-model';

function entry(overrides: Partial<GroupScanReportEntry> = {}): GroupScanReportEntry {
  return {
    'Class Name': 'Cohort A',
    'Course Name': 'POCUS Essentials',
    'Class Avg': '50%',
    'First Name': 'Ada',
    'Last Name': 'Lovelace',
    Username: 'ada',
    Email: 'ada@example.test',
    'Completed Steps': '5/10',
    'Completion Date': '',
    'Completion Percentage': '50%',
    lastAccessedAt: '2026-09-10T00:00:00.000Z',
    assignments: { total: 2, completed: 1, overdue: 0 },
    ...overrides,
  } as GroupScanReportEntry;
}

const translate = (key: string) => key;

describe('completionValue', () => {
  it('reads the percentage the wire sends as a string', () => {
    expect(completionValue(entry({ 'Completion Percentage': '73%' }))).toBe(73);
  });

  it('falls back to zero rather than NaN on an unparseable value', () => {
    expect(completionValue(entry({ 'Completion Percentage': '' }))).toBe(0);
  });
});

describe('lastActiveValue', () => {
  it('sorts a learner who never opened the course as the oldest', () => {
    // "Least recently active first" should surface the people who never
    // started — they are who the leader is looking for.
    expect(lastActiveValue(entry({ lastAccessedAt: null }))).toBe(Number.NEGATIVE_INFINITY);
  });

  it('treats an unparseable date the same as never', () => {
    expect(lastActiveValue(entry({ lastAccessedAt: 'not a date' }))).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('formatLastActive', () => {
  it('says "never" rather than leaving the cell blank', () => {
    // A blank cell reads as a rendering bug; "Never" is a fact.
    expect(formatLastActive(entry({ lastAccessedAt: null }), translate)).toBe(
      'groups.report.neverActive',
    );
    expect(formatLastActive(entry({ lastAccessedAt: '' }), translate)).toBe(
      'groups.report.neverActive',
    );
  });

  it('renders a real date as a date', () => {
    expect(formatLastActive(entry(), translate)).not.toBe('groups.report.neverActive');
  });
});

describe('learnerName', () => {
  it('falls back to the username when no name is recorded', () => {
    expect(learnerName(entry({ 'First Name': '', 'Last Name': '' }))).toBe('ada');
  });
});

describe('sortReportRows', () => {
  const low = entry({ Username: 'low', 'Completion Percentage': '10%' });
  const high = entry({ Username: 'high', 'Completion Percentage': '90%' });

  it('sorts ascending completion with the least complete first', () => {
    expect(sortReportRows([high, low], 'completion', 'asc').map((r) => r.Username)).toEqual([
      'low',
      'high',
    ]);
  });

  it('puts never-active learners first when sorting by last active ascending', () => {
    const never = entry({ Username: 'never', lastAccessedAt: null });
    const recent = entry({ Username: 'recent', lastAccessedAt: '2026-09-14T00:00:00.000Z' });

    expect(sortReportRows([recent, never], 'lastActive', 'asc').map((r) => r.Username)).toEqual([
      'never',
      'recent',
    ]);
    expect(sortReportRows([never, recent], 'lastActive', 'desc').map((r) => r.Username)).toEqual([
      'recent',
      'never',
    ]);
  });

  it('sorts by overdue count', () => {
    const clean = entry({ Username: 'clean', assignments: { total: 1, completed: 1, overdue: 0 } });
    const late = entry({ Username: 'late', assignments: { total: 3, completed: 0, overdue: 2 } });

    expect(sortReportRows([clean, late], 'overdue', 'desc').map((r) => r.Username)).toEqual([
      'late',
      'clean',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const rows = [high, low];
    sortReportRows(rows, 'completion', 'asc');
    expect(rows.map((r) => r.Username)).toEqual(['high', 'low']);
  });
});
