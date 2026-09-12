import { describe, expect, it } from 'vitest';

import { displayTags, isMissingFiles, missingFilesTitle } from './scan-tags';

describe('displayTags', () => {
  it('labels the tags worth showing', () => {
    expect(displayTags(['expert_scan_review'])).toEqual([
      { id: 'expert_scan_review', label: 'Expert review' },
    ]);
    expect(displayTags(['dicom'])).toEqual([{ id: 'dicom', label: 'DICOM' }]);
    expect(displayTags(['resubmitted'])).toEqual([{ id: 'resubmitted', label: 'Resubmitted' }]);
  });

  it('never renders the completeness tags, which contradict the file count', () => {
    expect(displayTags(['complete'])).toEqual([]);
    expect(displayTags(['incomplete'])).toEqual([]);
    expect(displayTags(['incomplete', 'expert_scan_review', 'complete'])).toEqual([
      { id: 'expert_scan_review', label: 'Expert review' },
    ]);
  });

  it('drops a tag it has no label for rather than showing a raw token', () => {
    expect(displayTags(['some_new_server_tag'])).toEqual([]);
  });

  it('preserves server order and de-duplicates', () => {
    expect(displayTags(['dicom', 'resubmitted', 'dicom']).map((tag) => tag.id)).toEqual([
      'dicom',
      'resubmitted',
    ]);
  });

  it('normalises case and surrounding whitespace', () => {
    expect(displayTags([' Expert_Scan_Review '])).toEqual([
      { id: 'expert_scan_review', label: 'Expert review' },
    ]);
  });

  it('handles the empty and absent cases', () => {
    expect(displayTags([])).toEqual([]);
    expect(displayTags(null)).toEqual([]);
    expect(displayTags(undefined)).toEqual([]);
  });
});

describe('isMissingFiles', () => {
  it('is true only when fewer files arrived than were declared', () => {
    expect(isMissingFiles(1, 3)).toBe(true);
    expect(isMissingFiles(3, 3)).toBe(false);
  });

  it('is false when the scan declared no files, so a 0/0 row is not warned about', () => {
    expect(isMissingFiles(0, 0)).toBe(false);
  });

  it('is false when more files arrived than were declared', () => {
    expect(isMissingFiles(4, 3)).toBe(false);
  });
});

describe('missingFilesTitle', () => {
  it('names how many are missing', () => {
    expect(missingFilesTitle(1, 3)).toBe('2 of 3 files never finished uploading');
  });

  it('is singular for a one-file scan', () => {
    expect(missingFilesTitle(0, 1)).toBe('1 of 1 file never finished uploading');
  });

  it('is absent when nothing is missing, so no tooltip is attached', () => {
    expect(missingFilesTitle(3, 3)).toBeUndefined();
  });
});
