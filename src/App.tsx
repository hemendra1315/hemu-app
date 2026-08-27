import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { logger } from '@/lib/logger';

/** App root: providers wrap the router. */
export default function App() {
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', (event) => {
      try {
        const incomingUrl = event.url;
        const parsedUrl = new URL(incomingUrl);

        logger.debug('oauth_app_url_open', {
          url: parsedUrl.protocol + '//' + parsedUrl.hostname + parsedUrl.pathname,
        });

        const hasCode = parsedUrl.searchParams.has('code');

        logger.debug('oauth_callback_code_present', { hasCode });

        if (parsedUrl.hostname === 'auth' && parsedUrl.pathname === '/callback') {
          // Native deep link received, close the external browser
          if (Capacitor.isNativePlatform()) {
            Browser.close().catch(() => {});
          }
          // Navigate to the callback route safely via React Router
          router.navigate(`/auth/callback${parsedUrl.search}${parsedUrl.hash}`);
        }
      } catch (err) {
        logger.error('oauth_app_url_open_parse_failed', { error: err });
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
