import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { Button, ThemeToggle } from '@/components/ui';
import { useAuth } from '@/features/auth';

/** Narrow layout for join-code / academy-creation / pending-approval steps. */
export function OnboardingLayout() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="bg-bg min-h-screen">
      <header className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-192.png"
            alt="CAM Logo"
            className="h-7 w-7 rounded-lg object-contain shadow-xs"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-primary font-mono text-base font-black">CAM</span>
            <span className="text-fg-muted hidden text-xs font-medium sm:inline">
              Cricket Academy Manager
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl p-4">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
