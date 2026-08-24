import { z } from 'zod';

/**
 * Validates `import.meta.env` once at startup so a missing/typo'd variable fails
 * loudly here instead of as an obscure runtime error deep in the app.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_APP_NAME: z.string().default('Cricket Academy Manager'),
  VITE_APP_URL: z.string().url().default('http://localhost:5173'),
  VITE_DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  VITE_DEFAULT_LOCALE: z.enum(['en', 'hi']).default('en'),
  VITE_VAPID_PUBLIC_KEY: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  VITE_ENABLE_DEVTOOLS: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
  appName: parsed.data.VITE_APP_NAME,
  appUrl: parsed.data.VITE_APP_URL,
  defaultTimezone: parsed.data.VITE_DEFAULT_TIMEZONE,
  defaultLocale: parsed.data.VITE_DEFAULT_LOCALE,
  vapidPublicKey: parsed.data.VITE_VAPID_PUBLIC_KEY,
  sentryDsn: parsed.data.VITE_SENTRY_DSN,
  logLevel: parsed.data.VITE_LOG_LEVEL,
  enableDevtools: parsed.data.VITE_ENABLE_DEVTOOLS,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

export type Env = typeof env;
