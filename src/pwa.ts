import { registerSW } from 'virtual:pwa-register';

import { logger } from './lib/logger';

/**
 * Registers the generated service worker. `registerType: 'prompt'` means a new
 * build never swaps under the user mid-session; Phase 10 adds the update UI.
 */
export function registerPwa(): void {
  if (import.meta.env.DEV) return;

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
