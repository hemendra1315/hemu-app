import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

// FIX: If using a local Supabase CLI (127.0.0.1) and testing on a physical device
// via Live Reload, 127.0.0.1 points to the phone itself and connection is refused.
// We dynamically map the local Supabase URL to the PC's LAN IP to resolve this.
let resolvedSupabaseUrl = env.supabaseUrl;
if (
  typeof window !== 'undefined' &&
  (resolvedSupabaseUrl.includes('127.0.0.1') || resolvedSupabaseUrl.includes('localhost'))
) {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const url = new URL(resolvedSupabaseUrl);
    url.hostname = window.location.hostname;
    resolvedSupabaseUrl = url.toString();
  }
}

/**
 * Single browser Supabase client. Sessions persist in localStorage and are
 * auto-refreshed; the OAuth redirect is detected on app boot.
 */
export const supabase: AppSupabaseClient = createClient<Database>(
  resolvedSupabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PKCE codes are exchanged manually in AuthCallbackPage (works for both
      // web full-page-load and native appUrlOpen router navigation).
      // detectSessionInUrl must be false to avoid a double-exchange race where
      // the SDK auto-exchanges on page load AND the page exchanges again with
      // the now-consumed code.
      detectSessionInUrl: false,
      flowType: 'pkce',
      storageKey: 'cam.auth',
    },
    global: {
      headers: { 'x-application-name': 'cricket-academy-manager' },
    },
  },
);
