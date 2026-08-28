import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';

import { Button } from '@/components/ui';
import { logger } from '@/lib/logger';
import { useUiStore } from '@/stores';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/push/pushSubscription';
import {
  isNativePush,
  isNativePushSubscribed,
  subscribeToNativePush,
  unsubscribeFromNativePush,
} from '@/lib/push/nativePush';

type Status = 'checking' | 'unsupported' | 'blocked' | 'subscribed' | 'unsubscribed';

/**
 * The only UI entry point that actually calls `subscribeToPush()` — without
 * this, `ensurePushSubscribed()` on app boot only ever renews an existing
 * grant, so a user who has never been prompted would never be asked.
 */
export function PushNotificationToggle({ academyId }: { academyId: string | null }) {
  const pushToast = useUiStore((state) => state.pushToast);
  const [status, setStatus] = useState<Status>('checking');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (isNativePush()) {
        const subscribed = await isNativePushSubscribed();
        if (!cancelled) setStatus(subscribed ? 'subscribed' : 'unsubscribed');
        return;
      }

      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) {
        if (!cancelled) setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('blocked');
        return;
      }
      // Deliberately not `navigator.serviceWorker.ready` here — that promise
      // never resolves if no service worker ever registers (e.g. local dev,
      // where registration is skipped), which would leave this stuck
      // "checking" forever. getRegistration() resolves immediately either way.
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        if (!cancelled) setStatus('unsubscribed');
        return;
      }
      const sub = await registration.pushManager.getSubscription();
      if (!cancelled) setStatus(sub ? 'subscribed' : 'unsubscribed');
    }

    void checkStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async () => {
    if (!academyId) {
      pushToast({
        title: 'Join an academy first',
        description: 'Notifications are tied to an academy membership.',
        variant: 'error',
      });
      return;
    }
    setIsBusy(true);
    try {
      const result = isNativePush()
        ? await subscribeToNativePush(academyId)
        : await subscribeToPush(academyId);
      if (result === 'granted') {
        setStatus('subscribed');
        pushToast({ title: 'Notifications enabled', variant: 'success' });
      } else if (result === 'denied') {
        // The web `Notification` API doesn't exist in the native Android
        // WebView, so only consult it on the web path.
        const blocked = !isNativePush() && Notification.permission === 'denied';
        setStatus(blocked ? 'blocked' : 'unsubscribed');
        pushToast({
          title: 'Could not enable notifications',
          description: 'Permission was not granted.',
          variant: 'error',
        });
      } else {
        setStatus('unsupported');
      }
    } catch (err) {
      logger.warn('push_toggle_enable_failed', { error: String(err) });
      pushToast({ title: 'Could not enable notifications', variant: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisable = async () => {
    setIsBusy(true);
    try {
      if (isNativePush()) {
        await unsubscribeFromNativePush();
      } else {
        await unsubscribeFromPush();
      }
      setStatus('unsubscribed');
      pushToast({ title: 'Notifications disabled', variant: 'success' });
    } catch (err) {
      logger.warn('push_toggle_disable_failed', { error: String(err) });
      pushToast({ title: 'Could not disable notifications', variant: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  if (status === 'unsupported') {
    return (
      <p className="text-fg-muted text-sm">Push notifications aren't supported in this browser.</p>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex items-center gap-2.5">
        <BellOff className="text-fg-muted h-4 w-4 shrink-0" aria-hidden />
        <p className="text-fg-muted text-sm">
          Notifications are blocked for this site. Enable them in your browser's site settings.
        </p>
      </div>
    );
  }

  if (status === 'subscribed') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BellRing className="text-primary h-4 w-4 shrink-0" aria-hidden />
          <p className="text-fg text-sm font-medium">Notifications are on</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleDisable} isLoading={isBusy}>
          Disable
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Bell className="text-fg-muted h-4 w-4 shrink-0" aria-hidden />
        <p className="text-fg-muted text-sm">
          Get notified about announcements and updates from your academy.
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={handleEnable}
        isLoading={isBusy || status === 'checking'}
        disabled={status === 'checking'}
      >
        Enable Notifications
      </Button>
    </div>
  );
}
