import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { toApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';

/**
 * Auth transport only — no business rules.
 */
export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  // Rely on Capacitor's built-in platform detection, with a fallback check just in case
  const isNative =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' &&
      !!(window as unknown as { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative);

  // Force the native intent scheme if we are in the Android/iOS app
  const defaultRedirectTo = isNative
    ? 'com.hemu.cricketacademy://auth/callback'
    : `${window.location.origin}/auth/callback`;

  const actualRedirectTo = redirectTo || defaultRedirectTo;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: actualRedirectTo,
      skipBrowserRedirect: isNative,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) throw toApiError(error);

  if (isNative && data?.url) {
    await Browser.open({ url: data.url });
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw toApiError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toApiError(error);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw toApiError(error);
  return data.session;
}
