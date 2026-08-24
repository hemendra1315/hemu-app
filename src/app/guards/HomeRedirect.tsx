import { Navigate } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { useMemberships } from '@/features/academies';
import { useAuth } from '@/features/auth';
import { isProfileComplete } from '@/features/auth/utils/profileCompletion';
import { useTestModeStore } from '@/stores';
import { ROLE_HOME } from '@/types/enums';

/**
 * Decides where a signed-in user lands: onboarding, the pending screen, the
 * academy chooser, or the dashboard matching their role in the active academy.
 */
export function HomeRedirect() {
  const { profile } = useAuth();
  const { isLoading, active, hasAnyAcademy, isAwaitingApproval, current } = useMemberships();
  const testModeRole = useTestModeStore((state) => state.activeRole);

  if (isLoading) return <LoadingScreen message="Setting things up…" />;

  if (testModeRole) {
    if (testModeRole === 'student') return <Navigate to="/player" replace />;
    if (testModeRole === 'coach') return <Navigate to="/coach" replace />;
    if (testModeRole === 'academy_owner') return <Navigate to="/dashboard" replace />;
  }

  // General Profile & Phone OTP Onboarding check
  if (!testModeRole && profile && !isProfileComplete(profile)) {
    return <Navigate to="/onboarding/profile" replace />;
  }

  if (profile?.isSuperAdmin) return <Navigate to="/admin" replace />;
  if (isAwaitingApproval) return <Navigate to="/onboarding/pending" replace />;
  if (!hasAnyAcademy) return <Navigate to="/onboarding" replace />;
  if (!current) {
    return active.length > 1 ? (
      <Navigate to="/onboarding/select-academy" replace />
    ) : (
      <LoadingScreen message="Selecting your academy…" />
    );
  }

  return <Navigate to={ROLE_HOME[current.role]} replace />;
}
