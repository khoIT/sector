import { describe, expect, it } from 'vitest';

import {
  courseSegmentsToChartData,
  groupCourseChartQuery,
  groupScanBars,
  scanItemsToChartData,
  selectedOptionValue,
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

describe('groupScanBars', () => {
  it('reads the group-scoped route, including the statuses a label-zip would drop', () => {
    const bars = groupScanBars(identity, {
      chartData: [
        { name: 'Pending', value: 8, status: 'pending' },
        { name: 'Failed Upload', value: 1, status: 'failed_upload' },
        { name: 'Partially Uploaded', value: 0, status: 'partially_uploaded' },
        { name: 'Submitted', value: 3776, status: 'submitted' },
        { name: 'Reviewed', value: 3065, status: 'reviewed' },
      ],
      summary: {
        totalScans: 6850,
        completedScans: 3065,
        failedScans: 1,
        pendingScans: 3784,
        successRate: 45,
        failureRate: 0,
      },
    });

    expect(bars.map((bar) => bar.code)).toEqual([
      'pending',
      'failed_upload',
      'submitted',
      'reviewed',
    ]);
    expect(bars.find((bar) => bar.code === 'submitted')?.value).toBe(3776);
    expect(bars.find((bar) => bar.code === 'reviewed')?.value).toBe(3065);
    expect(bars.find((bar) => bar.code === 'failed_upload')?.label).toBe('status.failedUpload');
  });

  it('shows nothing when the scoped route has nothing to show', () => {
    // A group with no members scopes to zero scans. The instance-wide counts
    // that GET /api/dashboard/charts would return for the same group must not
    // appear in their place.
    expect(groupScanBars(identity, undefined)).toEqual([]);
    expect(
      groupScanBars(identity, {
        chartData: [
          { name: 'Pending', value: 0, status: 'pending' },
          { name: 'Submitted', value: 0, status: 'submitted' },
        ],
        summary: {
          totalScans: 0,
          completedScans: 0,
          failedScans: 0,
          pendingScans: 0,
          successRate: 0,
          failureRate: 0,
        },
      }),
    ).toEqual([]);
  });
});

describe('groupCourseChartQuery', () => {
  it('asks for the group charts only once a course is chosen', () => {
    // Without a courseId the route answers [0,0,0] for every group, however
    // many learners it has — a donut that can never draw.
    expect(groupCourseChartQuery('group-1', undefined)).toBeUndefined();
    expect(groupCourseChartQuery('group-1', '')).toBeUndefined();
    expect(groupCourseChartQuery('', 'course-1')).toBeUndefined();
    expect(groupCourseChartQuery('group-1', 'course-1')).toEqual({
      groupId: 'group-1',
      courseId: 'course-1',
    });
  });
});

describe('selectedOptionValue', () => {
  const options = [{ value: 'a' }, { value: 'b' }];

  it('keeps a choice that is still in the list', () => {
    expect(selectedOptionValue(options, 'b')).toBe('b');
  });

  it('falls back to the first option when the choice is stale or unset', () => {
    expect(selectedOptionValue(options, 'gone')).toBe('a');
    expect(selectedOptionValue(options, undefined)).toBe('a');
  });

  it('is empty when there is nothing to choose', () => {
    expect(selectedOptionValue([], 'a')).toBe('');
  });
});
