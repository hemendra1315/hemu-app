import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { ThemeToggle } from '@/components/ui';

/** Centred layout for unauthenticated screens (sign-in, OAuth callback). */
export function AuthLayout() {
  return (
    <div className="bg-bg flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
