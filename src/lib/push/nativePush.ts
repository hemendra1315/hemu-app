/**
 * Native Android Push (Capacitor + Firebase Cloud Messaging)
 *
 * Separate from `pushSubscription.ts` (Web Push), which only works inside a
 * browser tab with a registered service worker -- the Capacitor-wrapped
 * Android app has neither, so it needs its own registration path through
 * `@capacitor/push-notifications`, which talks to FCM directly.
 *
 * Both paths write into the same `push_subscriptions` table, distinguished
 * by a `platform` column, so `send-push-notification` can dispatch each row
 * the right way (Web Push's RFC 8291 encryption vs. FCM's HTTP v1 API).
 */

import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
} from '@capacitor/push-notifications';

import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAcademyStore } from '@/stores/academyStore';

let currentAcademyId: string | null = null;
let listenersReady = false;

/**
 * FCM can hand us a token before we know which academy the user belongs to
 * (the prompt fires at app boot, but the academy is only known after sign-in
 * and the membership lookup). Holding it here means the token isn't lost --
 * it gets written as soon as the academy id arrives.
 */
let pendingToken: Token | null = null;

/**
 * Remembers that we've already shown the one automatic permission prompt, so
 * a user who declined isn't re-asked on every single launch. The Profile
 * page toggle is still there for anyone who changes their mind.
 */
const AUTO_PROMPT_KEY = 'cam.native-push-prompted';

export function isNativePush(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function hasAutoPrompted(): boolean {
  try {
    return localStorage.getItem(AUTO_PROMPT_KEY) === '1';
  } catch {
    // Private mode / storage disabled -- treat as "not yet asked" rather than
    // letting a storage error block the prompt entirely.
    return false;
  }
}

function markAutoPrompted(): void {
  try {
    localStorage.setItem(AUTO_PROMPT_KEY, '1');
  } catch {
    /* storage unavailable -- worst case we ask once more next launch */
  }
}

async function persistToken(token: Token): Promise<void> {
  if (!currentAcademyId) {
    // Not an error: stash it and write once the academy is known.
    pendingToken = token;
    logger.debug('native_push_token_pending_academy');
    return;
  }
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      pendingToken = token;
      return;
    }

    // Reuses the existing (user_id, endpoint) unique constraint with a
    // synthetic endpoint so this upsert works identically to the Web Push
    // path -- no separate conflict target needed per platform.
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        academy_id: currentAcademyId,
        platform: 'android',
        endpoint: `fcm:${token.value}`,
        fcm_token: token.value,
        p256dh: null,
        auth: null,
      },
      { onConflict: 'user_id,endpoint' },
    );
    if (error) throw error;
    pendingToken = null;
    logger.info('native_push_token_saved');
  } catch (err) {
    logger.warn('native_push_token_save_failed', { error: String(err) });
  }
}

/**
 * Called once the active academy is known (at boot if already signed in, or
 * via the academy store subscription after sign-in) to flush a token that
 * arrived earlier.
 */
export function setNativePushAcademy(academyId: string | null): void {
  if (!academyId || academyId === currentAcademyId) return;
  currentAcademyId = academyId;
  if (pendingToken) void persistToken(pendingToken);
}

function ensureListeners(): void {
  if (listenersReady || !isNativePush()) return;
  listenersReady = true;

  void PushNotifications.addListener('registration', (token: Token) => {
    void persistToken(token);
  });

  void PushNotifications.addListener('registrationError', (err) => {
    logger.warn('native_push_registration_error', { error: JSON.stringify(err) });
  });

  // Android doesn't show a system tray banner for a data/foreground push by
  // default -- log it so a silently-dropped notification is at least
  // visible in diagnostics instead of just disappearing.
  void PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      logger.info('native_push_received_foreground', { title: notification.title });
    },
  );

  // The permission prompt fires at boot, which is usually before sign-in has
  // resolved the user's academy. Watching the store means the token gets
  // written the moment that academy id lands, with no extra tap.
  useAcademyStore.subscribe((state) => {
    setNativePushAcademy(state.activeAcademyId);
  });
}

/**
 * Call once at app boot. If permission was already granted in a previous
 * session this silently re-registers -- picking up a token refresh (which
 * FCM issues after app updates or reinstalls) without any user action. If
 * permission has never been asked for, this shows the system prompt once,
 * so a freshly installed app asks on first open rather than waiting for the
 * user to find the toggle in Profile.
 */
export async function initNativePush(academyId: string | null): Promise<void> {
  if (!isNativePush()) return;
  if (academyId) currentAcademyId = academyId;
  ensureListeners();

  const status = await PushNotifications.checkPermissions();

  if (status.receive === 'granted') {
    await PushNotifications.register();
    return;
  }

  // 'prompt' / 'prompt-with-rationale' means Android has never been asked.
  // 'denied' means the user said no -- respect that and stay quiet.
  if (status.receive === 'denied' || hasAutoPrompted()) return;

  markAutoPrompted();
  const requested = await PushNotifications.requestPermissions();
  if (requested.receive === 'granted') {
    await PushNotifications.register();
    logger.info('native_push_auto_prompt_granted');
  } else {
    logger.info('native_push_auto_prompt_declined');
  }
}

export async function isNativePushSubscribed(): Promise<boolean> {
  if (!isNativePush()) return false;
  const status = await PushNotifications.checkPermissions();
  return status.receive === 'granted';
}

/** UI entry point for the "Enable Notifications" button on native Android. */
export async function subscribeToNativePush(
  academyId: string,
): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isNativePush()) return 'unsupported';
  currentAcademyId = academyId;
  ensureListeners();

  const status = await PushNotifications.requestPermissions();
  if (status.receive !== 'granted') {
    logger.info('native_push_permission_denied');
    return 'denied';
  }

  await PushNotifications.register();
  return 'granted';
}

/**
 * Android has no client-side "unregister" call worth relying on; removing
 * the server-side row is what actually stops future sends to this device.
 */
export async function unsubscribeFromNativePush(): Promise<void> {
  if (!isNativePush()) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'android');
    logger.info('native_push_unsubscribed');
  } catch (err) {
    logger.warn('native_push_unsubscribe_failed', { error: String(err) });
  }
}
