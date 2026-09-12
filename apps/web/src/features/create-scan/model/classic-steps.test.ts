import { describe, expect, it } from 'vitest';

import { canEnterClassicStep, nextClassicStep, previousClassicStep } from './classic-steps';
import type { DraftFile, DraftFileStatus } from './draft-types';

function file(status: DraftFileStatus, id: string = status): DraftFile {
  return {
    id,
    name: `${id}.mp4`,
    size: 1_000,
    type: 'video/mp4',
    status,
    progress: 0,
    storageKey: null,
    confidence: null,
    error: null,
    blob: null,
  };
}

const NOTHING = { files: [], scanTypeId: null };

describe('moving through the classic wizard', () => {
  it('always allows the first step', () => {
    expect(canEnterClassicStep('files', NOTHING)).toBe(true);
  });

  it('needs a file the study actually has before interpretation', () => {
    expect(canEnterClassicStep('interpretation', NOTHING)).toBe(false);
    expect(
      canEnterClassicStep('interpretation', { files: [file('uploading')], scanTypeId: null }),
    ).toBe(true);
  });

  it.each([['cancelled'], ['rejected']] as const)(
    'does not count a %s file as a file',
    (status) => {
      // The four-step build read files.length here and let a study with
      // nothing in it walk forward.
      expect(
        canEnterClassicStep('interpretation', { files: [file(status)], scanTypeId: null }),
      ).toBe(false);
    },
  );

  it('needs an exam type before routing, but not a stored file', () => {
    // A study with no stored file is stopped at Submit, where the reason can
    // be explained, rather than by a Next button that is simply grey.
    expect(canEnterClassicStep('routing', { files: [file('queued')], scanTypeId: null })).toBe(
      false,
    );
    expect(canEnterClassicStep('routing', { files: [file('queued')], scanTypeId: 'st-1' })).toBe(
      true,
    );
  });

  it('is never reached by navigating to the receipt', () => {
    expect(canEnterClassicStep('submitted', { files: [file('stored')], scanTypeId: 'st-1' })).toBe(
      false,
    );
  });
});

describe('the order of the classic steps', () => {
  it('walks forward and stops at the last ordered step', () => {
    expect(nextClassicStep('files')).toBe('interpretation');
    expect(nextClassicStep('interpretation')).toBe('routing');
    expect(nextClassicStep('routing')).toBeNull();
  });

  it('walks back and stops at the first', () => {
    expect(previousClassicStep('routing')).toBe('interpretation');
    expect(previousClassicStep('interpretation')).toBe('files');
    expect(previousClassicStep('files')).toBeNull();
  });

  it('has no opinion about a step from the other flow', () => {
    expect(nextClassicStep('study')).toBeNull();
    expect(previousClassicStep('submit')).toBeNull();
  });
});
