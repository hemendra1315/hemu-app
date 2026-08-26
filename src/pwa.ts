import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

import { logger } from './lib/logger';

/**
 * Registers the generated service worker — web only.
 *
 * The Capacitor native shell already serves each build's files straight out
 * of the APK on disk: every install is guaranteed current, no network or
 * cache involved. Layering a Workbox service worker on top there doesn't
 * just do nothing, it actively causes staleness. Android preserves a WebView's
 * storage (IndexedDB, Cache Storage, service worker registrations) across an
 * in-place APK update — only a full uninstall clears it. So a service worker
 * registered by an earlier build stays active after a fresh APK install,
 * keeps controlling navigation, and serves ITS OWN precached (old)
 * index.html/JS/CSS instead of the new files Capacitor just deployed. That
 * is exactly what "the UI is of the old one" looks like right after
 * installing a freshly rebuilt APK.
 *
 * `cleanUpStaleServiceWorker` actively unregisters and clears anything a
 * pre-fix build left behind, so an existing install self-heals the next time
 * it's opened rather than needing a full uninstall.
 */
export function registerPwa(): void {
  if (import.meta.env.DEV) return;

  if (Capacitor.isNativePlatform()) {
    void cleanUpStaleServiceWorker();
    return;
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      logger.info('pwa_update_available');
      void updateSW(true);
    },
    onOfflineReady() {
      logger.info('pwa_offline_ready');
    },
  });
}

async function cleanUpStaleServiceWorker(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        logger.info('pwa_native_sw_cleared', { count: registrations.length });
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => caches.delete(key)));
        logger.info('pwa_native_cache_cleared', { count: keys.length });
      }
    }
  } catch (err) {
    logger.error('pwa_cleanup_failed', { error: String(err) });
  }
}
