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

        // Both auth deep links land here: OAuth sign-in (/callback) and the
        // emailed password-recovery link (/reset-password). Each carries a
        // one-time PKCE code that its own page exchanges for a session.
        const isAuthDeepLink =
          parsedUrl.hostname === 'auth' &&
          (parsedUrl.pathname === '/callback' || parsedUrl.pathname === '/reset-password');

        if (isAuthDeepLink) {
          // Native deep link received, close the external browser
          if (Capacitor.isNativePlatform()) {
            Browser.close().catch(() => {});
          }
          // Navigate to the matching route safely via React Router
          router.navigate(`/auth${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`);
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
