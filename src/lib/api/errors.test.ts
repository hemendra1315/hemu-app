import { describe, expect, it } from 'vitest';

import { ApiErrorCode, errorMessage, toApiError } from './errors';

describe('errorMessage', () => {
  it('translates join-code identifiers raised by database functions', () => {
    const invalid = { code: '22023', message: 'E_JOIN_CODE_INVALID', details: null, hint: null };
    const already = { code: '23505', message: 'E_ALREADY_MEMBER', details: null, hint: null };

    expect(errorMessage(invalid)).toBe(
      'That join code is not valid. Check it with your academy and try again.',
    );
    expect(errorMessage(already)).toBe('You are already part of this academy.');
  });

  it('translates identifiers that carry extra context after a colon', () => {
    const error = {
      code: '22023',
      message: 'E_VALIDATION: academy name must contain letters or digits',
      details: null,
      hint: null,
    };

    expect(errorMessage(error)).not.toContain('E_VALIDATION');
  });

  it('never leaks an E_ identifier for a known domain failure', () => {
    for (const identifier of [
      'E_JOIN_CODE_EXPIRED',
      'E_JOIN_CODE_EXHAUSTED',
      'E_REQUEST_PENDING',
      'E_FORBIDDEN',
    ]) {
      expect(
        errorMessage({ code: '22023', message: identifier, details: null, hint: null }),
      ).not.toContain(identifier);
    }
  });

  it('maps postgres codes onto stable api error codes', () => {
    expect(toApiError({ code: '42501', message: 'denied', details: null, hint: null }).code).toBe(
      ApiErrorCode.FORBIDDEN,
    );
    expect(toApiError(new TypeError('fetch failed')).code).toBe(ApiErrorCode.NETWORK);
  });
});
