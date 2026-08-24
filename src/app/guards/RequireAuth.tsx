import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { useAuth } from '@/features/auth';

/** Blocks unauthenticated access and remembers the attempted location. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingScreen message="Checking your session…" />;
  if (status === 'unauthenticated') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
