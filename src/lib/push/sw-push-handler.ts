/**
 * Service Worker Push Event Handler
 *
 * This file is injected into the Vite PWA service worker via vite.config.ts
 * `injectManifest.injectionPoint` or via `workbox.additionalManifestEntries`.
 *
 * It handles:
 *  - `push` events: display an OS-level notification
 *  - `notificationclick` events: focus or open the app at the target URL
 */

// Extend ServiceWorkerGlobalScope for TypeScript
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; icon?: string; data?: { url?: string } };
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: 'New Notification', body: event.data.text() };
  }

  const title = payload.title ?? 'Cricket Academy';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: payload.data ?? { url: '/announcements' },
    tag: 'academy-announcement', // Replaces previous notification of same tag
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl: string = (event.notification.data as { url?: string })?.url ?? '/announcements';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app window is already open — focus it and navigate
        for (const client of clientList) {
          if ('focus' in client && 'navigate' in client) {
            void (client as WindowClient).navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
