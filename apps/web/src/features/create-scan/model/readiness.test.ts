import type { FindingDefinition } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import type { DraftFile, DraftFileStatus } from './draft-types';
import { readinessFor, submitBlockers } from './readiness';

function file(status: DraftFileStatus, id: string = status): DraftFile {
  return {
    id,
    name: `${id}.mp4`,
    size: 1,
    type: 'video/mp4',
    status,
    confidence: 'verified',
    blob: null,
    storageKey: status === 'stored' ? `storage/${id}` : null,
    error: null,
    progress: 0,
  } as unknown as DraftFile;
}

function definition(partial: Partial<FindingDefinition> & { key: string }): FindingDefinition {
  return {
    id: partial.key,
    name: partial.key,
    required: false,
    options: [],
    type: 'select',
    dataType: 'text',
    ...partial,
  } as FindingDefinition;
}

const EMPTY = { files: [], scanTypeId: null, definitions: [], findings: {}, note: '' };

function itemFor(input: Parameters<typeof readinessFor>[0], id: string) {
  return readinessFor(input).find((item) => item.id === id);
}

describe('readinessFor — files', () => {
  it('is empty with no files', () => {
    expect(itemFor(EMPTY, 'files')).toMatchObject({ state: 'empty', detail: 'none yet' });
  });

  it('is done only when every tracked file is in storage', () => {
    expect(itemFor({ ...EMPTY, files: [file('stored', 'a'), file('stored', 'b')] }, 'files')).toMatchObject(
      { state: 'done', detail: '2' },
    );
  });

  it('is partial while a file is still moving', () => {
    expect(
      itemFor({ ...EMPTY, files: [file('stored', 'a'), file('uploading', 'b')] }, 'files'),
    ).toMatchObject({ state: 'partial', detail: '1 of 2' });
  });

  it('counts a failed or detached file as not yet safe to submit', () => {
    expect(itemFor({ ...EMPTY, files: [file('stored', 'a'), file('failed', 'b')] }, 'files')).toMatchObject(
      { state: 'partial' },
    );
    expect(
      itemFor({ ...EMPTY, files: [file('stored', 'a'), file('detached', 'b')] }, 'files'),
    ).toMatchObject({ state: 'partial' });
  });

  it('ignores rejected and cancelled files, so cleaning up never looks like a loss', () => {
    expect(
      itemFor(
        { ...EMPTY, files: [file('stored', 'a'), file('rejected', 'b'), file('cancelled', 'c')] },
        'files',
      ),
    ).toMatchObject({ state: 'done', detail: '1' });
  });
});

describe('readinessFor — findings', () => {
  const definitions = [
    definition({ key: 'a', required: true }),
    definition({ key: 'b', required: true }),
    definition({ key: 'c' }),
  ];

  it('says nothing until a scan type is chosen', () => {
    expect(itemFor({ ...EMPTY, definitions, findings: { a: 'Yes' } }, 'findings')).toMatchObject({
      state: 'empty',
      detail: null,
    });
  });

  it('counts against the required rows, not against every row', () => {
    // A study with 40 optional rows and 2 required ones is ready at 2. Counting
    // every row would report "1 of 41" on a study that is one answer from done.
    expect(
      itemFor({ ...EMPTY, scanTypeId: 't', definitions, findings: { a: 'Yes' } }, 'findings'),
    ).toMatchObject({ state: 'partial', detail: '1 of 2' });
  });

  it('is done once every required row is answered', () => {
    expect(
      itemFor(
        { ...EMPTY, scanTypeId: 't', definitions, findings: { a: 'Yes', b: 'No' } },
        'findings',
      ),
    ).toMatchObject({ state: 'done', detail: '2' });
  });

  it('is empty when a type is chosen and nothing is answered', () => {
    expect(
      itemFor({ ...EMPTY, scanTypeId: 't', definitions, findings: {} }, 'findings'),
    ).toMatchObject({ state: 'empty' });
  });

  it('is done on a type whose rows are all optional once any is answered', () => {
    expect(
      itemFor(
        { ...EMPTY, scanTypeId: 't', definitions: [definition({ key: 'c' })], findings: { c: 'X' } },
        'findings',
      ),
    ).toMatchObject({ state: 'done', detail: '1' });
  });
});

describe('readinessFor — exam and note', () => {
  it('tracks the scan type', () => {
    expect(itemFor(EMPTY, 'exam')).toMatchObject({ state: 'empty' });
    expect(itemFor({ ...EMPTY, scanTypeId: 't' }, 'exam')).toMatchObject({ state: 'done' });
  });

  it('treats the note as optional — never partial', () => {
    expect(itemFor(EMPTY, 'note')).toMatchObject({ state: 'empty' });
    expect(itemFor({ ...EMPTY, note: '   ' }, 'note')).toMatchObject({ state: 'empty' });
    expect(itemFor({ ...EMPTY, note: 'Poor window' }, 'note')).toMatchObject({ state: 'done' });
  });
});

describe('submitBlockers', () => {
  it('blocks on files and exam only', () => {
    const items = readinessFor({ ...EMPTY, scanTypeId: null });
    expect(submitBlockers(items).map((item) => item.id)).toEqual(['files', 'exam']);
  });

  it('does not block on an unanswered finding', () => {
    // The server does not enforce required findings either, and refusing to
    // submit over a row someone could not assess pushes people to invent one.
    const items = readinessFor({
      ...EMPTY,
      files: [file('stored', 'a')],
      scanTypeId: 't',
      definitions: [definition({ key: 'a', required: true })],
      findings: {},
    });
    expect(submitBlockers(items)).toEqual([]);
  });

  it('blocks while a file is still uploading', () => {
    const items = readinessFor({
      ...EMPTY,
      files: [file('uploading', 'a')],
      scanTypeId: 't',
    });
    expect(submitBlockers(items).map((item) => item.id)).toEqual(['files']);
  });
});
