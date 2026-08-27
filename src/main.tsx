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
