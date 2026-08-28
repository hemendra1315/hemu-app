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

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ session: import('@supabase/supabase-js').Session | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw toApiError(error);
  return { session: data.session };
}

/**
 * Sends the "reset your password" email. Deliberately does NOT report whether
 * the address exists — Supabase returns success either way, and surfacing the
 * difference would turn this form into a way to test which emails have
 * accounts here. The UI says "if that address has an account" for the same
 * reason.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Same native/web split as Google sign-in: inside the Android app the
  // recovery link has to come back through the app's own URL scheme, not the
  // website, or the user ends up resetting their password in a browser that
  // the app knows nothing about.
  const isNative =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' &&
      !!(window as unknown as { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative);

  const redirectTo = isNative
    ? 'com.hemu.cricketacademy://auth/reset-password'
    : `${window.location.origin}/auth/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw toApiError(error);
}

/**
 * Sets a new password for the currently-authenticated user. The recovery link
 * signs the user in temporarily, which is what authorises this call.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
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
