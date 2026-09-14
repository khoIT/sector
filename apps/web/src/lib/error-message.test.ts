import { ApiError } from '@sector/api-client';
import { describe, expect, it } from 'vitest';

import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it('uses the server message for an ApiError, which is user-facing on these routes', () => {
    const error = new ApiError({
      kind: 'http',
      statusCode: 409,
      message: 'Cannot add learner: seat limit exceeded.',
      path: '/api/group-members/invite',
    });

    expect(errorMessage(error, 'fallback')).toBe('Cannot add learner: seat limit exceeded.');
  });

  // The regression: `isApiError(e) ? e.message : undefined` rendered NOTHING
  // for every failure the transport did not produce. Those are exactly the
  // ones that happen after a request has already succeeded — decoding an
  // export, handing a blob to the browser — and they were silent.
  it('falls back for a DOMException-style decode failure', () => {
    const error = new Error('The string to be decoded is not correctly encoded.');
    error.name = 'InvalidCharacterError';

    expect(errorMessage(error, 'The export could not be opened.')).toBe(
      'The export could not be opened.',
    );
  });

  it('falls back for a TypeError thrown by our own success path', () => {
    expect(errorMessage(new TypeError('anchor.click is not a function'), 'fallback')).toBe(
      'fallback',
    );
  });

  it.each([[undefined], [null], ['a bare string'], [{ message: 'not an ApiError' }]])(
    'falls back for a non-Error throw: %s',
    (thrown) => {
      expect(errorMessage(thrown, 'fallback')).toBe('fallback');
    },
  );

  it('never returns undefined, so a caller cannot render nothing by accident', () => {
    expect(errorMessage(new Error('x'), 'fallback')).toBeTypeOf('string');
    expect(errorMessage(undefined, 'fallback')).toBeTypeOf('string');
  });
});
