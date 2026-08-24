import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/feedback';
import { Toaster } from '@/components/ui';
import { AuthProvider } from '@/features/auth';
import { useThemeEffect } from '@/hooks';
import { env } from '@/lib/env';
import { queryClient } from '@/lib/query/queryClient';

/**
 * Single composition point for app-wide providers, ordered outside-in:
 * error boundary → query cache → auth session → theme + toasts.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemedShell>{children}</ThemedShell>
        </AuthProvider>
        {env.enableDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function ThemedShell({ children }: { children: ReactNode }) {
  useThemeEffect();
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
