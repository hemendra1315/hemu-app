import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { DehydratedState } from '@tanstack/react-query';
import { hydrate } from '@tanstack/react-query';

import App from './App';
import { registerPwa } from './pwa';
import { reportError } from './lib/logger';
import { loadOfflineQueryCache } from '@/lib/offline/indexedDb';
import { queryClient } from '@/lib/query/queryClient';
import './styles/index.css';

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, { scope: 'unhandledrejection' });
});

async function initApp() {
  if (typeof window !== 'undefined') {
    // Add safe area classes for Capacitor native app and standalone PWA
    const isCapacitor = Boolean(
      (
        window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
      ).Capacitor?.isNativePlatform?.() || /capacitor/i.test(window.navigator.userAgent),
    );
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isCapacitor) {
      document.documentElement.classList.add('is-native-app');
    }
    if (isStandalone) {
      document.documentElement.classList.add('is-standalone');
    }

    try {
      const cached = await loadOfflineQueryCache();
      if (cached) {
        hydrate(queryClient, cached as DehydratedState);
      }
    } catch (err) {
      console.error('[HYDRATION] Failed to load offline cache from IndexedDB:', err);
    }
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Root element #root not found.');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void initApp();
registerPwa();
