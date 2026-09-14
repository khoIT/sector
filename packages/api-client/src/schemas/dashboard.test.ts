import { describe, expect, it } from 'vitest';

import {
  dashboardGroupChartsSchema,
  courseProgressChartSchema,
  courseProgressStatusLabelKey,
  scanProgressByUserSchema,
  scanProgressStatusLabelKey,
} from './dashboard';

/**
 * The regression this whole module exists to prevent: renaming or localising
 * the server's English `label` must change NOTHING about which colour or
 * i18n key a dashboard shows, because both are derived from the status
 * `key`/`status` code, never from `label`.
 */
describe('course/scan progress: colour and i18n key come from the code, not the label', () => {
  it('derives the same i18n key regardless of a renamed segment label', () => {
    const original = courseProgressChartSchema.parse({
      data: [1, 2, 3],
      totalModules: 6,
      segments: [
        {
          key: 'in_progress',
          label: 'In Progress',
          count: 1,
          totalModules: 6,
          percentage: 17,
          tooltipLabel: '',
          legendLabel: '',
        },
        {
          key: 'completed',
          label: 'Completed',
          count: 2,
          totalModules: 6,
          percentage: 33,
          tooltipLabel: '',
          legendLabel: '',
        },
        {
          key: 'not_started',
          label: 'Not Started',
          count: 3,
          totalModules: 6,
          percentage: 50,
          tooltipLabel: '',
          legendLabel: '',
        },
      ],
    });

    // Server renames (or localises) the label server-side; the code is untouched.
    const renamed = courseProgressChartSchema.parse({
      ...original,
      segments: original.segments.map((segment) =>
        segment.key === 'completed' ? { ...segment, label: 'Terminé' } : segment,
      ),
    });

    for (const status of ['in_progress', 'completed', 'not_started'] as const) {
      const before = original.segments.find((s) => s.key === status)!;
      const after = renamed.segments.find((s) => s.key === status)!;
      expect(courseProgressStatusLabelKey(before.key)).toBe(
        courseProgressStatusLabelKey(after.key),
      );
    }
    // The old failure mode: `label === 'Completed'` silently stops matching a
    // renamed label. Confirm the key lookup never touches `label` at all —
    // it is keyed purely on the enum.
    expect(courseProgressStatusLabelKey('completed')).toBe('home.courseStatus.completed');
  });

  it('an unrecognised segment key fails to parse instead of rendering untranslated', () => {
    const result = courseProgressChartSchema.safeParse({
      data: [1, 2, 3],
      totalModules: 6,
      segments: [
        {
          key: 'archived',
          label: 'Archived',
          count: 1,
          totalModules: 6,
          percentage: 17,
          tooltipLabel: '',
          legendLabel: '',
        },
        {
          key: 'completed',
          label: 'Completed',
          count: 2,
          totalModules: 6,
          percentage: 33,
          tooltipLabel: '',
          legendLabel: '',
        },
        {
          key: 'not_started',
          label: 'Not Started',
          count: 3,
          totalModules: 6,
          percentage: 50,
          tooltipLabel: '',
          legendLabel: '',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('scan status i18n key comes from the status enum, reusing the Scan Vault status.* namespace', () => {
    expect(scanProgressStatusLabelKey('reviewed')).toBe('status.reviewed');
    expect(scanProgressStatusLabelKey('partially_uploaded')).toBe('status.partiallyUploaded');
  });

  it('parses the full scan-progress-by-user response by status code, never by name', () => {
    const parsed = scanProgressByUserSchema.parse({
      chartData: [
        { name: 'Anything the server wants to call it', value: 4, status: 'reviewed' },
        { name: 'Renamed label', value: 1, status: 'pending' },
      ],
      summary: {
        totalScans: 5,
        completedScans: 4,
        failedScans: 0,
        pendingScans: 1,
        successRate: 80,
        failureRate: 0,
      },
    });
    expect(parsed.chartData.map((item) => item.status)).toEqual(['reviewed', 'pending']);
  });

  it('drops the group charts scan array instead of parsing it', () => {
    // GET /api/dashboard/charts carries a scanProgressChart whose counts are
    // NOT scoped to the group: getChartsData only narrows its scan query
    // `if (groupUserIds.length > 0)`, so a group with no learners is counted
    // across every scan in the database. A group's scan figures come from
    // scan-progress-by-user?groupId= instead, and the field is left out of the
    // parsed shape so no caller can reach the wrong numbers by accident.
    const parsed = dashboardGroupChartsSchema.parse({
      courseProgressChart: {
        data: [1, 2, 3],
        totalLearners: 6,
        segments: [
          {
            key: 'in_progress',
            count: 1,
            totalLearners: 6,
            percentage: 17,
            tooltipLabel: '',
            legendLabel: '',
          },
          {
            key: 'completed',
            count: 2,
            totalLearners: 6,
            percentage: 33,
            tooltipLabel: '',
            legendLabel: '',
          },
          {
            key: 'not_started',
            count: 3,
            totalLearners: 6,
            percentage: 50,
            tooltipLabel: '',
            legendLabel: '',
          },
        ],
      },
      scanProgressChart: {
        labels: ['Pending', 'Processing', 'Failed', 'Submitted', 'Reviewed'],
        data: [453, 662, 1965, 2, 3, 11576, 15499],
      },
    });

    expect(Object.keys(parsed)).toEqual(['courseProgressChart']);
    expect(JSON.stringify(parsed)).not.toContain('11576');
  });
});
