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
        <span className="text-fg font-semibold">Cricket Academy Manager</span>
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
