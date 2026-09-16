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
  if (isNativePush()) {
    void findActiveAcademyId()
      .then((academyId) => initNativePush(academyId))
      .catch((err) => logger.debug('native_push_init_skipped', { reason: String(err) }));
    return;
  }

  if (import.meta.env.DEV) return;

  const updateSW = registerSW({
    immediate: true,
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: membership } = await supabase
          .from('academy_members')
          .select('academy_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .single();

        if (membership?.academy_id) {
          await ensurePushSubscribed(membership.academy_id);
        }
      } catch (err) {
        logger.debug('pwa_push_renew_skipped', { reason: String(err) });
      }
    },
  });
}
