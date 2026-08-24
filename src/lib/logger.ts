import { env } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

type Context = Record<string, unknown>;

/**
 * Minimal level-aware logger. The single place allowed to touch `console`;
 * `reportError` is the hook where Sentry (or another sink) gets wired in later.
 */
function shouldLog(level: LogLevel): boolean {
  return RANK[level] >= RANK[env.logLevel];
}

function emit(level: Exclude<LogLevel, 'silent'>, message: string, context?: Context): void {
  if (!shouldLog(level)) return;
  const payload = { level, message, time: new Date().toISOString(), ...context };
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else if (env.isDev) console.warn(payload);
}

export const logger = {
  debug: (message: string, context?: Context) => emit('debug', message, context),
  info: (message: string, context?: Context) => emit('info', message, context),
  warn: (message: string, context?: Context) => emit('warn', message, context),
  error: (message: string, context?: Context) => emit('error', message, context),
};

/** Central funnel for unexpected errors (ErrorBoundary, query cache, unhandled rejections). */
export function reportError(error: unknown, context?: Context): void {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: error };
  logger.error('unhandled_error', { ...context, error: normalized });
  // Phase 10: forward to Sentry when env.sentryDsn is configured.
}
