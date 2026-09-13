import { describe, expect, it } from 'vitest';

import {
  courseSegmentsToChartData,
  groupScanChartToChartData,
  scanItemsToChartData,
} from './chart-adapters';

/** Echoes the key back, so a test failure names the exact i18n key involved. */
const identity = (key: string) => key;

describe('courseSegmentsToChartData', () => {
  it('derives code/tone from `key`, ignoring a renamed `label`', () => {
    const renamed = courseSegmentsToChartData(identity, [
      {
        key: 'completed',
        label: 'Terminé',
        count: 4,
        totalModules: 10,
        percentage: 40,
        tooltipLabel: '',
        legendLabel: '',
      },
    ]);
    expect(renamed).toEqual([
      { code: 'completed', label: 'home.courseStatus.completed', value: 4, tone: 'ok' },
    ]);
  });

  it('drops zero-count buckets', () => {
    const result = courseSegmentsToChartData(identity, [
      {
        key: 'not_started',
        label: 'Not Started',
        count: 0,
        totalModules: 10,
        percentage: 0,
        tooltipLabel: '',
        legendLabel: '',
      },
      {
        key: 'in_progress',
        label: 'In Progress',
        count: 3,
        totalModules: 10,
        percentage: 30,
        tooltipLabel: '',
        legendLabel: '',
      },
    ]);
    expect(result).toEqual([
      { code: 'in_progress', label: 'home.courseStatus.inProgress', value: 3, tone: 'warn' },
    ]);
  });
});

describe('scanItemsToChartData', () => {
  it('derives code/tone from `status`, ignoring a renamed `name`', () => {
    const result = scanItemsToChartData(identity, [
      { name: 'Whatever the server calls it today', value: 2, status: 'reviewed' },
    ]);
    expect(result).toEqual([{ code: 'reviewed', label: 'status.reviewed', value: 2, tone: 'ok' }]);
  });
});

describe('groupScanChartToChartData', () => {
  it('reads every one of the 7 positions, including the two a label-zip would drop', () => {
    const result = groupScanChartToChartData(identity, { data: [1, 0, 0, 0, 0, 5, 2] });
    expect(result.map((d) => d.code)).toEqual(['pending', 'submitted', 'reviewed']);
    expect(result.find((d) => d.code === 'submitted')?.value).toBe(5);
    expect(result.find((d) => d.code === 'reviewed')?.value).toBe(2);
  });
});
