import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { fetchMyMemberships } from '@/features/academies/api/academiesApi';
import { logger } from '@/lib/logger';
import {
  isNativePush,
  getNativePushPermission,
  isNativePushSubscribed,
  subscribeToNativePush,
} from '@/lib/push/nativePush';
import { useAcademyStore, useAuthStore, useUiStore } from '@/stores';
import { supabase } from '@/lib/supabase/client';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function detectPushPlatform(): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform();
  }
  if (typeof navigator !== 'undefined') {
    if (/android/i.test(navigator.userAgent)) return 'android';
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  }
  return 'web';
}

export function extractFcmToken(endpoint: string): string | null {
  if (endpoint.includes('fcm.googleapis.com')) {
    const parts = endpoint.split('/');
    return parts[parts.length - 1] || null;
  }
  return null;
}

export async function resolveUserAcademyId(userId?: string): Promise<string | null> {
  // 1. Primary: activeAcademyId from useAcademyStore
  const activeAcademyId = useAcademyStore.getState().activeAcademyId;
  if (activeAcademyId) return activeAcademyId;

  // 2. Secondary: active memberships stored in useAuthStore
  const storeMemberships = useAuthStore.getState().memberships;
  const activeStoreMembership = storeMemberships.find((m) => m.status === 'active');
  if (activeStoreMembership?.academyId) {
    return activeStoreMembership.academyId;
  }

  // 3. Fallback: Query live memberships directly from Supabase
  try {
    const liveMemberships = await fetchMyMemberships();
    const activeLiveMembership = liveMemberships.find((m) => m.status === 'active');
    if (activeLiveMembership?.academyId) {
      return activeLiveMembership.academyId;
    }
  } catch (err) {
    logger.warn('resolve_user_academy_error', { userId, error: String(err) });
  }

  // 4. Fallback: Check if user owns an active academy
  if (userId) {
    try {
      const { data: ownerAcademy } = await supabase
        .from('academies')
        .select('id')
        .eq('owner_user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (ownerAcademy?.id) {
        return ownerAcademy.id;
      }
    } catch (err) {
      logger.warn('resolve_owner_academy_error', { userId, error: String(err) });
    }
  }

  return null;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const pushToast = useUiStore((s) => s.pushToast);
  const isNative = isNativePush();

  const checkStatus = useCallback(async () => {
    if (isNative) {
      try {
        const perm = await getNativePushPermission();
        setPermission(perm);
        const subscribed = await isNativePushSubscribed();
        setIsSubscribed(subscribed);
      } catch {
        setPermission('unsupported');
        setIsSubscribed(false);
      }
      return;
    }

    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator)
    ) {
      setPermission('unsupported');
      setIsSubscribed(false);
      return;
    }

    setPermission(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    } catch {
      setIsSubscribed(false);
    }
  }, [isNative]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (isNative) {
        try {
          const perm = await getNativePushPermission();
          if (active) setPermission(perm);
          const subscribed = await isNativePushSubscribed();
          if (active) setIsSubscribed(subscribed);
        } catch {
          if (active) {
            setPermission('unsupported');
            setIsSubscribed(false);
          }
        }
        return;
      }

      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        !('serviceWorker' in navigator)
      ) {
        if (active) {
          setPermission('unsupported');
          setIsSubscribed(false);
        }
        return;
      }

      if (active) setPermission(Notification.permission);

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active) setIsSubscribed(Boolean(sub));
      } catch {
        if (active) setIsSubscribed(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isNative]);

  const subscribe = useCallback(
    async (vapidKey?: string, explicitAcademyId?: string): Promise<boolean> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        pushToast({
          title: 'Sign in required',
          description: 'You need to be signed in to enable notifications.',
          variant: 'error',
        });
        return false;
      }

      const resolvedAcademyId = explicitAcademyId || (await resolveUserAcademyId(user.id));
      if (!resolvedAcademyId) {
        pushToast({
          title: 'Select an academy first',
          description: 'Notifications are tied to an academy — pick one before enabling.',
          variant: 'error',
        });
        return false;
      }

      setIsLoading(true);
      try {
        if (isNative) {
          const result = await subscribeToNativePush(resolvedAcademyId);
          if (result.ok) {
            setPermission('granted');
            setIsSubscribed(true);
            pushToast({
              title: 'Push notifications enabled!',
              description: 'You will receive session reminders, match call-ups, and dues alerts.',
              variant: 'success',
            });
            return true;
          }

          setIsSubscribed(false);
          if (result.reason === 'permission_denied') {
            setPermission('denied');
            pushToast({
              title: 'Permission not granted',
              description:
                'Enable notifications for this app in Android Settings to receive alerts.',
              variant: 'info',
            });
          } else if (result.reason === 'registration_timeout') {
            pushToast({
              title: "Couldn't enable notifications",
              description:
                'Registration with Google Play services timed out. Check your connection and try again.',
              variant: 'error',
            });
          } else if (result.reason.startsWith('db_error:')) {
            pushToast({
              title: 'Registered, but not saved',
              description: "Your device registered for push, but we couldn't save it. Try again.",
              variant: 'error',
            });
          } else {
            pushToast({
              title: "Couldn't enable notifications",
              description: 'Device registration failed. Try again in a moment.',
              variant: 'error',
            });
          }
          return false;
        }

        // ─── Web Push path ───────────────────────────────────────────────
        if (typeof window === 'undefined' || !('Notification' in window)) {
          setIsSubscribed(false);
          setPermission('unsupported');
          pushToast({
            title: 'Notifications not supported',
            description: 'This browser does not support Web Push notifications.',
            variant: 'error',
          });
          return false;
        }

        const permResult = await Notification.requestPermission();
        setPermission(permResult);

        if (permResult !== 'granted') {
          setIsSubscribed(false);
          pushToast({
            title: 'Permission not granted',
            description: 'Enable notifications in browser settings to receive academy alerts.',
            variant: 'info',
          });
          return false;
        }

        const reg = await navigator.serviceWorker.ready;
        const effectiveVapidKey =
          vapidKey || (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined);

        const options: PushSubscriptionOptionsInit = {
          userVisibleOnly: true,
          applicationServerKey: effectiveVapidKey
            ? (urlBase64ToUint8Array(effectiveVapidKey) as unknown as BufferSource)
            : undefined,
        };

        const subscription = await reg.pushManager.subscribe(options);
        const keys = subscription.toJSON().keys as { p256dh: string; auth: string } | undefined;
        if (!keys?.p256dh || !keys?.auth) {
          setIsSubscribed(false);
          pushToast({
            title: "Couldn't enable notifications",
            description: 'Failed to generate encryption keys for browser push.',
            variant: 'error',
          });
          return false;
        }

        const platform = detectPushPlatform();
        const fcmToken = extractFcmToken(subscription.endpoint);

        const { error: dbError } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: user.id,
            academy_id: resolvedAcademyId,
            endpoint: subscription.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            platform,
            fcm_token: fcmToken,
          },
          { onConflict: 'user_id,endpoint' },
        );

        if (dbError) {
          logger.error('push_db_persist_failed', {
            error: dbError.message,
            academyId: resolvedAcademyId,
            userId: user.id,
          });
          setIsSubscribed(false);
          pushToast({
            title: 'Registered, but not saved',
            description:
              "Your browser subscribed, but we couldn't save it to the server. Try again.",
            variant: 'error',
          });
          return false;
        }

        setIsSubscribed(true);
        logger.info('push_subscription_success', { endpoint: subscription.endpoint });
        pushToast({
          title: 'Push notifications enabled!',
          description: 'You will receive session reminders, match call-ups, and dues alerts.',
          variant: 'success',
        });
        return true;
      } catch (err) {
        logger.warn('push_subscription_failed', { error: String(err) });
        setIsSubscribed(false);
        pushToast({
          title: "Couldn't enable notifications",
          description: 'Subscription failed. Please check permissions and try again.',
          variant: 'error',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isNative, pushToast],
  );

  const sendTestNotification = useCallback(
    async (
      title = 'CAM Academy Alert',
      body = 'Test notification: Session begins in 2 hours on Turf 1.',
    ) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      if (Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            icon: '/icons/pwa-192x192.png',
            badge: '/icons/pwa-192x192.png',
            tag: 'test-notification',
          });
          pushToast({ title: 'Test alert dispatched', variant: 'success' });
        } catch {
          new Notification(title, { body, icon: '/icons/pwa-192x192.png' });
        }
      } else {
        await subscribe();
      }
    },
    [subscribe, pushToast],
  );

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    sendTestNotification,
    checkStatus,
  };
}
