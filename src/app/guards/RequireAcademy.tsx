import { Navigate, Outlet } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { useMemberships } from '@/features/academies';
import { useAcademyStore, useAuthStore } from '@/stores';

/**
 * Gate for academy-scoped routes. Waits for memberships to load, then routes
 * users without an academy into onboarding and users with several to the chooser.
 */
export function RequireAcademy() {
  const { isLoading, hasAnyAcademy, isAwaitingApproval, current } = useMemberships();
  const isSuperAdmin = useAuthStore((state) => state.profile?.isSuperAdmin === true);
  const activeAcademyId = useAcademyStore((state) => state.activeAcademyId);

  if (isLoading) return <LoadingScreen message="Loading your academies…" />;

  if (isSuperAdmin) {
    if (activeAcademyId || current) {
      return <Outlet />;
    }
    return <Navigate to="/admin" replace />;
  }

  if (isAwaitingApproval) return <Navigate to="/onboarding/pending" replace />;
  if (!hasAnyAcademy) return <Navigate to="/onboarding" replace />;
  if (!current) return <Navigate to="/onboarding/select-academy" replace />;

  return <Outlet />;
}
