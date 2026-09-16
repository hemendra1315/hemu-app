import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';

import { resolveBackButtonAction } from '@/app/backButtonAction';
import type { router as appRouter } from '@/app/router';

/**
 * Registers exactly one Android hardware/gesture back-button listener for
 * the whole app. Native-only: in a browser tab or installed PWA there is no
 * `backButton` event, and the browser's own back behavior already works
 * correctly there, so this must not register anything in that environment.
 *
 * Any component that wants back to close it (a modal, a bottom sheet)
 * participates via the shared overlay stack (`useOverlayStackStore`)
 * instead of adding its own listener — see `Modal.tsx`.
 */
export function useAndroidBackButton(router: typeof appRouter): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const action = resolveBackButtonAction(router.state.location.pathname, canGoBack);
      switch (action) {
        case 'overlay-closed':
          return;
        case 'navigate-back':
          router.navigate(-1);
          return;
        case 'exit-app':
          CapacitorApp.exitApp().catch(() => {});
          return;
        case 'navigate-home':
          router.navigate('/');
          return;
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [router]);
}
