import { registerSW } from 'virtual:pwa-register';

import { logger } from './lib/logger';
import { ensurePushSubscribed } from './lib/push/pushSubscription';
import { isNativePush, initNativePush } from './lib/push/nativePush';
import { supabase } from './lib/supabase/client';

async function findActiveAcademyId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('academy_members')
    .select('academy_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single();

  return membership?.academy_id ?? null;
}

/**
 * Registers the generated service worker. `registerType: 'prompt'` means a new
 * build never swaps under the user mid-session; Phase 10 adds the update UI.
 *
 * After the SW is active, we silently renew the user's push subscription so
 * that the stored endpoint in Supabase is always current.
 */
export function registerPwa(): void {
  // The native Android app runs this same bundled JS inside a Capacitor
  // WebView, but there is no service worker to register and no
  // `virtual:pwa-register` module to matter there -- it needs its own
  // (non-service-worker) push registration path instead.
  if (isNativePush()) {
    void findActiveAcademyId()
      .then((academyId) => initNativePush(academyId))
      .catch((err) => logger.debug('native_push_init_skipped', { reason: String(err) }));
    return;
  }

  if (import.meta.env.DEV) return;

  const updateSW = registerSW({
    onNeedRefresh() {
      logger.info('pwa_update_available');
      void updateSW(true);
    },
    onOfflineReady() {
      logger.info('pwa_offline_ready');
    },
    async onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      logger.info('pwa_sw_registered');

      // Silently renew push subscription once the service worker is active
      try {
        const academyId = await findActiveAcademyId();
        if (academyId) {
          await ensurePushSubscribed(academyId);
        }
      } catch (err) {
        logger.debug('pwa_push_renew_skipped', { reason: String(err) });
      }
    },
  });
}
