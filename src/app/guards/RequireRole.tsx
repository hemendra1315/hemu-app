import { Navigate, Outlet } from 'react-router-dom';

import { useActiveRoles } from '@/lib/rbac';
import { useAuthStore, useTestModeStore } from '@/stores';
import type { AppRole } from '@/types/enums';

/**
 * Role-based route gate. Server-side RLS is still the authority; this only
 * prevents users from landing on screens they cannot use.
 */
export function RequireRole({ allow }: { allow: readonly AppRole[] }) {
  const roles = useActiveRoles();
  const isSuperAdmin = useAuthStore((state) => state.profile?.isSuperAdmin === true);
  const testModeRole = useTestModeStore((state) => state.activeRole);

  const effectiveSuperAdmin = isSuperAdmin && !testModeRole;
  const permitted = effectiveSuperAdmin || roles.some((role) => allow.includes(role));

  if (!permitted) return <Navigate to="/forbidden" replace />;

  return <Outlet />;
}
