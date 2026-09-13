import { describe, expect, it } from 'vitest';

import {
  GROUP_SCAN_PROGRESS_STATUS_ORDER,
  courseProgressChartSchema,
  courseProgressStatusLabelKey,
  groupScanProgressChartSchema,
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

  it('reads the group scan chart by fixed position, not by the mismatched labels array', () => {
    // The real bug this schema works around: the wire's `data` has one entry
    // per GROUP_SCAN_PROGRESS_STATUS_ORDER (7), but `labels` only ever has 5 —
    // see dashboard.controller.ts#getChartsData. A schema keyed on `labels[i]`
    // would silently drop the submitted/reviewed counts (indices 5 and 6).
    const parsed = groupScanProgressChartSchema.parse({
      labels: ['Pending', 'Processing', 'Failed', 'Submitted', 'Reviewed'],
      data: [10, 2, 1, 0, 3, 40, 12],
    });
    const byCode = Object.fromEntries(
      GROUP_SCAN_PROGRESS_STATUS_ORDER.map((code, index) => [code, parsed.data[index]]),
    );
    expect(byCode.submitted).toBe(40);
    expect(byCode.reviewed).toBe(12);
    // The mismatched `labels` array never survives parsing — reading it back
    // off the parsed value is a compile error, which is the point.
    expect(Object.keys(parsed)).toEqual(['data']);
  });

  it('rejects a data array of the wrong length rather than silently mis-mapping it', () => {
    const result = groupScanProgressChartSchema.safeParse({ data: [1, 2, 3] });
    expect(result.success).toBe(false);
  });
});
