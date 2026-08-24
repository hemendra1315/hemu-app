import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { useAuth } from '@/features/auth';
import { isProfileComplete } from '@/features/auth/utils/profileCompletion';
import { useTestModeStore } from '@/stores';

/**
 * Route guard enforcing general profile & phone OTP verification.
 * If signed-in user's profile is incomplete, redirects them to `/onboarding/profile`.
 */
export function RequireProfileOnboarding() {
  const { status, profile, isIdentityReady } = useAuth();
  const testModeRole = useTestModeStore((s) => s.activeRole);
  const location = useLocation();

  if (status === 'loading' || !isIdentityReady) {
    return <LoadingScreen message="Checking your profile…" />;
  }

  // Super Admin in Test App As mode bypasses profile onboarding
  if (testModeRole !== null) {
    return <Outlet />;
  }

  const isComplete = isProfileComplete(profile);
  const isOnboardingRoute = location.pathname === '/onboarding/profile';

  if (!isComplete && !isOnboardingRoute) {
    return <Navigate to="/onboarding/profile" replace state={{ from: location.pathname }} />;
  }

  if (isComplete && isOnboardingRoute) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
