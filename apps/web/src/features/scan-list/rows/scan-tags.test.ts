import { describe, expect, it } from 'vitest';

import {
  COMPLETE_TAG,
  completionTagMutation,
  displayTags,
  INCOMPLETE_TAG,
  isMissingFiles,
} from './scan-tags';

describe('displayTags', () => {
  it('labels the tags worth showing', () => {
    expect(displayTags(['expert_scan_review'])).toEqual([
      { id: 'expert_scan_review', labelKey: 'row.expertReview' },
    ]);
    expect(displayTags(['dicom'])).toEqual([{ id: 'dicom', labelKey: 'row.dicom' }]);
    expect(displayTags(['resubmitted'])).toEqual([
      { id: 'resubmitted', labelKey: 'row.resubmitted' },
    ]);
  });

  it('never renders the completeness tags, which contradict the file count', () => {
    expect(displayTags(['complete'])).toEqual([]);
    expect(displayTags(['incomplete'])).toEqual([]);
    expect(displayTags(['incomplete', 'expert_scan_review', 'complete'])).toEqual([
      { id: 'expert_scan_review', labelKey: 'row.expertReview' },
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
      { id: 'expert_scan_review', labelKey: 'row.expertReview' },
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

describe('completionTagMutation', () => {
  it('adds complete on an untagged scan and removes nothing', () => {
    expect(completionTagMutation([], COMPLETE_TAG)).toEqual({ add: COMPLETE_TAG, remove: null });
  });

  it('marking complete removes an existing incomplete tag — the server does not', () => {
    // scanService.addTag uses $push, not $addToSet or a replace, so the two
    // tags coexisting is exactly what the audit found: the client is the only
    // thing enforcing mutual exclusion.
    expect(completionTagMutation([INCOMPLETE_TAG], COMPLETE_TAG)).toEqual({
      add: COMPLETE_TAG,
      remove: INCOMPLETE_TAG,
    });
  });

  it('marking incomplete removes an existing complete tag', () => {
    expect(completionTagMutation([COMPLETE_TAG], INCOMPLETE_TAG)).toEqual({
      add: INCOMPLETE_TAG,
      remove: COMPLETE_TAG,
    });
  });

  it('does not re-add a tag the scan already carries, avoiding a duplicate $push', () => {
    expect(completionTagMutation([COMPLETE_TAG], COMPLETE_TAG)).toEqual({
      add: null,
      remove: null,
    });
  });

  it('leaves unrelated tags alone', () => {
    expect(completionTagMutation(['dicom', INCOMPLETE_TAG], COMPLETE_TAG)).toEqual({
      add: COMPLETE_TAG,
      remove: INCOMPLETE_TAG,
    });
  });

  it('normalises case, matching how the server stores tags', () => {
    expect(completionTagMutation(['INCOMPLETE'], COMPLETE_TAG)).toEqual({
      add: COMPLETE_TAG,
      remove: INCOMPLETE_TAG,
    });
  });

  it('handles a scan with no tags at all', () => {
    expect(completionTagMutation(null, INCOMPLETE_TAG)).toEqual({
      add: INCOMPLETE_TAG,
      remove: null,
    });
    expect(completionTagMutation(undefined, INCOMPLETE_TAG)).toEqual({
      add: INCOMPLETE_TAG,
      remove: null,
    });
  });
});
