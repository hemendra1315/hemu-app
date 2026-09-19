import { logger } from '../logger';

export type DomainErrorCode =
  | 'E_NOT_AUTHORIZED'
  | 'E_INVALID_JOIN_CODE'
  | 'E_ALREADY_MEMBER'
  | 'E_PARENT_LINK_EXPIRED'
  | 'E_CANNOT_LINK_SELF'
  | 'E_RATE_LIMIT_EXCEEDED'
  | 'E_BATCH_FULL'
  | 'E_FEE_PLAN_NOT_FOUND'
  | 'E_INVOICE_NOT_FOUND'
  | 'E_INVOICE_ALREADY_SETTLED'
  | 'E_PAYMENT_EXCEEDS_INVOICE_TOTAL'
  | 'E_PAYMENT_NOT_FOUND'
  | 'E_PAYMENT_ALREADY_PROCESSED'
  | 'E_INVALID_AMOUNT'
  | 'E_INVALID_ACTION'
  | 'E_INVALID_ARGUMENT'
  | 'E_NETWORK_ERROR'
  | 'E_UNKNOWN';

export interface AppError {
  code: DomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
  originalError?: unknown;
}

const ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  E_NOT_AUTHORIZED: 'You do not have permission to perform this action.',
  E_INVALID_JOIN_CODE: 'The academy join code is invalid or has expired.',
  E_ALREADY_MEMBER: 'You are already an active member of this academy.',
  E_PARENT_LINK_EXPIRED: 'This parent link code is invalid or has expired.',
  E_CANNOT_LINK_SELF: 'You cannot link yourself as your own parent/player.',
  E_RATE_LIMIT_EXCEEDED: 'Too many attempts. Please wait 15 minutes before trying again.',
  E_BATCH_FULL: 'This batch has reached its maximum player capacity.',
  E_FEE_PLAN_NOT_FOUND: 'The selected fee plan is no longer available.',
  E_INVOICE_NOT_FOUND: 'The requested invoice could not be found.',
  E_INVOICE_ALREADY_SETTLED: 'This invoice is already settled or paid in full.',
  E_PAYMENT_EXCEEDS_INVOICE_TOTAL: 'Payment amount exceeds the total invoice balance.',
  E_PAYMENT_NOT_FOUND: 'Payment record not found.',
  E_PAYMENT_ALREADY_PROCESSED: 'This payment submission has already been processed.',
  E_INVALID_AMOUNT: 'Please enter a valid payment amount.',
  E_INVALID_ACTION: 'Invalid verification action specified.',
  E_INVALID_ARGUMENT: 'Please check your inputs and try again.',
  E_NETWORK_ERROR: 'Network connection issue. Please check your internet connection.',
  E_UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Parses any unknown error (Supabase PostgREST error, RPC error, Network error)
 * into a structured AppError following Rule 5.
 */
export function parseAppError(error: unknown): AppError {
  if (!error) {
    return { code: 'E_UNKNOWN', message: ERROR_MESSAGES.E_UNKNOWN };
  }

  let code: DomainErrorCode = 'E_UNKNOWN';
  let rawMessage = '';

  if (typeof error === 'object' && error !== null) {
    const err = error as { message?: string; code?: string; details?: string; hint?: string };
    rawMessage = err.message || err.details || '';

    // Check for known domain error tokens
    for (const [key] of Object.entries(ERROR_MESSAGES)) {
      if (rawMessage.includes(key) || err.code === key) {
        code = key as DomainErrorCode;
        break;
      }
    }

    if (code === 'E_UNKNOWN') {
      if (rawMessage.includes('Failed to fetch') || rawMessage.includes('NetworkError')) {
        code = 'E_NETWORK_ERROR';
      } else if (rawMessage.includes('JWT') || rawMessage.includes('auth')) {
        code = 'E_NOT_AUTHORIZED';
      }
    }
  } else if (typeof error === 'string') {
    rawMessage = error;
    for (const [key] of Object.entries(ERROR_MESSAGES)) {
      if (error.includes(key)) {
        code = key as DomainErrorCode;
        break;
      }
    }
  }

  const appError: AppError = {
    code,
    message: ERROR_MESSAGES[code] || rawMessage || ERROR_MESSAGES.E_UNKNOWN,
    originalError: error,
  };

  // Rule 10: Centralized observability logging
  logger.warn(`[AppError: ${code}] ${appError.message}`, {
    code,
    rawMessage,
  });

  return appError;
}

export function getErrorMessage(code: DomainErrorCode): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.E_UNKNOWN;
}
