/**
 * Push Subscription Utility
 * Manages browser push subscriptions via the Web Push API + Supabase storage.
 *
 * VAPID_PUBLIC_KEY must be set in .env as VITE_VAPID_PUBLIC_KEY
 */

import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Returns true if the current browser already has an active push subscription
 * stored in Supabase for the current user.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  return sub !== null;
}

/**
 * Requests notification permission, subscribes to push via the browser PushManager,
 * and persists the subscription in the `push_subscriptions` Supabase table.
 *
 * @returns 'granted' | 'denied' | 'unsupported'
 */
export async function subscribeToPush(academyId: string): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    logger.info('push_unsupported');
    return 'unsupported';
  }

  if (!VAPID_PUBLIC_KEY) {
    logger.warn('push_vapid_key_missing');
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    logger.info('push_permission_denied');
    return 'denied';
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let sub = await registration.pushManager.getSubscription();

    if (!sub) {
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast to ArrayBuffer to satisfy strict TS lib types
        applicationServerKey: keyBytes.buffer as ArrayBuffer,
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const keys = sub.toJSON().keys as { p256dh: string; auth: string };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('push_subscriptions').upsert(
      {
        user_id: user.id,
        academy_id: academyId,
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: 'user_id,endpoint' },
    );

    if (error) throw error;

    logger.info('push_subscribed', { endpoint: sub.endpoint.slice(0, 40) });
    return 'granted';
  } catch (err) {
    logger.warn('push_subscribe_failed', { error: String(err) });
    return 'denied';
  }
}

/**
 * Unsubscribes the current browser from push and removes the record from Supabase.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
    logger.info('push_unsubscribed');
  } catch (err) {
    logger.warn('push_unsubscribe_failed', { error: String(err) });
  }
}

/**
 * Triggers subscription silently (no UI prompt if already decided).
 * Call this on app load after user is authenticated to keep subscriptions fresh.
 */
export async function ensurePushSubscribed(academyId: string): Promise<void> {
  if (Notification.permission === 'granted') {
    await subscribeToPush(academyId);
  }
}
