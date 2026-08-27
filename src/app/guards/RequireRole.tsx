import { Navigate, Outlet } from 'react-router-dom';

import { useActiveRoles } from '@/lib/rbac';
import { useAuthStore, useTestModeStore } from '@/stores';
import { ROLE_HOME, type AppRole } from '@/types/enums';

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

  if (!permitted) {
    /**
     * In "Test App As", an unpermitted route is usually not a real denial — it
     * is the page the super admin was standing on at the moment they switched
     * preview role.
     *
     * Switching role writes to a Zustand store, which re-renders synchronously
     * (`useSyncExternalStore`) before React Router commits the new location. For
     * that one render the *old* route is still mounted and now re-evaluates
     * itself against the *new* role — leaving the owner dashboard as "coach"
     * fails its own `allow={['academy_owner', 'super_admin']}`. Redirecting to
     * /forbidden there wins the race against the modal's own `navigate()` and
     * strands the user on a 403, which is what made Test App As dead-end for
     * every role except the one whose home they already happened to be on.
     *
     * The previewed role's own home is both the correct destination and
     * loop-free: `useActiveRoles` maps the test role to exactly one AppRole, and
     * that role's home route allows that role by construction.
     */
    const previewedRole = testModeRole ? roles[0] : undefined;
    if (previewedRole && ROLE_HOME[previewedRole]) {
      return <Navigate to={ROLE_HOME[previewedRole]} replace />;
    }
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
