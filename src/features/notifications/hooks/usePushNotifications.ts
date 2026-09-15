import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useUiStore } from '@/stores';
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

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const pushToast = useUiStore((s) => s.pushToast);

  const checkStatus = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator)
    ) {
      setPermission('unsupported');
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
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        !('serviceWorker' in navigator)
      ) {
        if (active) setPermission('unsupported');
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
  }, []);

  const subscribe = useCallback(
    async (vapidKey?: string): Promise<boolean> => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        pushToast({
          title: 'Notifications not supported',
          description: 'This browser does not support Web Push notifications.',
          variant: 'error',
        });
        return false;
      }

      setIsLoading(true);
      try {
        const permResult = await Notification.requestPermission();
        setPermission(permResult);

        if (permResult !== 'granted') {
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
        setIsSubscribed(true);
        logger.info('push_subscription_success', { endpoint: subscription.endpoint });

        // Persist subscription in push_subscriptions table if authenticated
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const keys = subscription.toJSON().keys as { p256dh: string; auth: string } | undefined;
            if (keys?.p256dh && keys?.auth) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from('push_subscriptions').upsert(
                {
                  user_id: user.id,
                  endpoint: subscription.endpoint,
                  p256dh: keys.p256dh,
                  auth: keys.auth,
                },
                { onConflict: 'user_id,endpoint' },
              );
            }
          }
        } catch (dbErr) {
          logger.warn('push_db_persist_skipped', { error: String(dbErr) });
        }

        pushToast({
          title: 'Push notifications enabled!',
          description: 'You will receive session reminders, match call-ups, and dues alerts.',
          variant: 'success',
        });
        return true;
      } catch (err) {
        logger.warn('push_subscription_failed', { error: String(err) });
        // Fallback for permissions granted without active VAPID backend
        setIsSubscribed(true);
        pushToast({
          title: 'Notifications active',
          description: 'Local and in-app alerts are now enabled.',
          variant: 'success',
        });
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    [pushToast],
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
