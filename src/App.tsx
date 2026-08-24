import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';

/** App root: providers wrap the router. */
export default function App() {
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', (event) => {
      try {
        const incomingUrl = event.url;
        const parsedUrl = new URL(incomingUrl);

        /* eslint-disable no-console */
        console.log(
          '[OAuth] appUrlOpen:',
          parsedUrl.protocol + '//' + parsedUrl.hostname + parsedUrl.pathname,
        );

        const hasCode = parsedUrl.searchParams.has('code');

        console.log('[OAuth] callback code present:', hasCode);
        /* eslint-enable no-console */

        if (parsedUrl.hostname === 'auth' && parsedUrl.pathname === '/callback') {
          // Native deep link received, close the external browser
          if (Capacitor.isNativePlatform()) {
            Browser.close().catch(() => {});
          }
          // Navigate to the callback route safely via React Router
          router.navigate(`/auth/callback${parsedUrl.search}${parsedUrl.hash}`);
        }
      } catch (err) {
        console.error('[OAuth] Failed to parse appUrlOpen URL:', err);
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
