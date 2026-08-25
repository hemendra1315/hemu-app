import type { PostgrestError } from '@supabase/supabase-js';

/** Stable error codes shared with the API plan's Edge Function contract. */
export const ApiErrorCode = {
  UNKNOWN: 'E_UNKNOWN',
  NETWORK: 'E_NETWORK',
  UNAUTHENTICATED: 'E_UNAUTHENTICATED',
  FORBIDDEN: 'E_FORBIDDEN',
  NOT_FOUND: 'E_NOT_FOUND',
  CONFLICT: 'E_CONFLICT',
  VALIDATION: 'E_VALIDATION',
  RATE_LIMITED: 'E_RATE_LIMITED',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    options?: { status?: number; details?: unknown },
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

const PG_CODE_MAP: Record<string, ApiErrorCode> = {
  '23505': ApiErrorCode.CONFLICT, // unique violation
  '23503': ApiErrorCode.VALIDATION, // fk violation
  '42501': ApiErrorCode.FORBIDDEN, // insufficient privilege / RLS
  PGRST301: ApiErrorCode.UNAUTHENTICATED,
};

/** Normalizes any thrown value (Postgrest, fetch, Error) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isPostgrestError(error)) {
    let code = PG_CODE_MAP[error.code];
    if (!code) {
      if (error.code.startsWith('PGRST1') || error.code.startsWith('PGRST2')) {
        code = ApiErrorCode.VALIDATION;
      } else {
        code = ApiErrorCode.UNKNOWN;
      }
    }
    return new ApiError(code, error.message, { details: error.details });
  }

  if (error instanceof TypeError) {
    return new ApiError(ApiErrorCode.NETWORK, 'Network request failed. Check your connection.');
  }

  if (error instanceof Error) {
    return new ApiError(ApiErrorCode.UNKNOWN, error.message);
  }

  return new ApiError(ApiErrorCode.UNKNOWN, 'Something went wrong.');
}

function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

/**
 * Database functions raise stable `E_*` identifiers so behaviour can be asserted
 * without matching on prose; those identifiers are never shown to a user.
 */
const DOMAIN_MESSAGES: Record<string, string> = {
  E_UNAUTHENTICATED: 'Your session expired. Please sign in again.',
  E_FORBIDDEN: 'You do not have permission to do that.',
  E_JOIN_CODE_INVALID: 'That join code is not valid. Check it with your academy and try again.',
  E_JOIN_CODE_EXPIRED: 'That join code has expired. Ask your academy for a new one.',
  E_JOIN_CODE_EXHAUSTED:
    'That join code has been used too many times. Ask your academy for a new one.',
  E_ALREADY_MEMBER: 'You are already part of this academy.',
  E_REQUEST_PENDING: 'Your request is already waiting for the academy owner to approve it.',
};

function domainMessage(message: string): string | undefined {
  const separator = message.indexOf(':');
  const identifier = (separator === -1 ? message : message.slice(0, separator)).trim();
  if (!identifier.startsWith('E_')) return undefined;

  const known = DOMAIN_MESSAGES[identifier];
  if (known) return known;

  // Identifiers such as `E_VALIDATION` carry their own explanation after the colon.
  const detail = separator === -1 ? '' : message.slice(separator + 1).trim();
  return detail === '' ? 'Something went wrong.' : capitalize(detail);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Human-readable message for UI surfaces. */
export function errorMessage(error: unknown): string {
  const apiError = toApiError(error);
  const domain = domainMessage(apiError.message);
  if (domain) return domain;

  switch (apiError.code) {
    case ApiErrorCode.UNAUTHENTICATED:
      return 'Your session expired. Please sign in again.';
    case ApiErrorCode.FORBIDDEN:
      return 'You do not have permission to do that.';
    case ApiErrorCode.NOT_FOUND:
      return 'We could not find what you were looking for.';
    case ApiErrorCode.NETWORK:
      return 'You appear to be offline. We will retry automatically.';
    case ApiErrorCode.RATE_LIMITED:
      return 'Too many attempts. Please try again in a few minutes.';
    default:
      // Never surface raw database/provider text to the user. Domain errors are
      // already translated above via `domainMessage` (E_*) or the explicit case
      // branches; everything else falls back to a safe, generic message.
      return 'Something went wrong. Please try again.';
  }
}
