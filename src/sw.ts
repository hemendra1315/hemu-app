/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Inject precache manifest from Vite PWA plugin
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; icon?: string; data?: { url?: string } };
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: 'Cricket Academy', body: event.data.text() };
  }

  const title = payload.title ?? 'Cricket Academy';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    data: payload.data ?? { url: '/announcements' },
    tag: 'academy-announcement',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl: string =
    (event.notification.data as { url?: string })?.url ?? '/announcements';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('navigate' in client) {
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
