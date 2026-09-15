/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Inject precache manifest from Vite PWA plugin
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    data?: { url?: string };
    actions?: Array<{ action: string; title: string }>;
  };

  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: 'CAM', body: event.data.text() };
  }

  const title = payload.title ?? 'CAM';
  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icons/pwa-192x192.png',
    badge: payload.badge ?? '/icons/pwa-192x192.png',
    data: payload.data ?? { url: '/notifications' },
    tag: 'cam-alert',
    vibrate: [200, 100, 200],
    actions: payload.actions ?? [
      { action: 'open', title: 'Open CAM' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options as NotificationOptions));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl: string = (event.notification.data as { url?: string })?.url ?? '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client && client.url.includes(self.location.origin)) {
          void (client as WindowClient).navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
