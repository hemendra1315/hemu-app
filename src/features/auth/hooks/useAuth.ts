import { useCallback } from 'react';

import { queryClient } from '@/lib/query/queryClient';
import { logger } from '@/lib/logger';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';

import { signInWithGoogle, signInWithPassword, signOut } from '../api/authApi';

/** Read-only view of auth state plus the two actions the UI needs. */
export function useAuth() {
  const status = useAuthStore((state) => state.status);
  const identityStatus = useAuthStore((state) => state.identityStatus);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const memberships = useAuthStore((state) => state.memberships);
  const joinRequests = useAuthStore((state) => state.joinRequests);
  const reset = useAuthStore((state) => state.reset);
  const setSigningOut = useAuthStore((state) => state.setSigningOut);
  const setActiveAcademy = useAcademyStore((state) => state.setActiveAcademy);
  const exitTestMode = useTestModeStore((state) => state.exitTestMode);

  const logout = useCallback(async () => {
    // Set identityStatus to 'ready' so the onAuthStateChange listener skips
    // any events that fire during the signOut call itself.
    useAuthStore.getState().setIdentityStatus('ready');
    // Set signingOut so the listener also skips any *delayed* events that
    // fire after reset() (which sets identityStatus back to 'idle').
    setSigningOut(true);

    try {
      await signOut();
    } catch (error) {
      logger.warn('logout_signout_failed', { error: String(error) });
    } finally {
      // Clear E2E auth from sessionStorage so a stale mock session can't
      // resurrect an authenticated state.
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('cam.e2e_auth');
      }
      exitTestMode();
      reset();
      setActiveAcademy(null);
      queryClient.clear();
      // Re-enable the onAuthStateChange listener now that everything is cleared.
      setSigningOut(false);
    }
  }, [reset, setSigningOut, setActiveAcademy, exitTestMode]);

  return {
    status,
    identityStatus,
    user,
    session,
    profile,
    memberships,
    joinRequests,
    displayName: profile?.fullName ?? profile?.email ?? user?.email ?? '',
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    /** Signed in *and* profile/memberships resolved — routing waits for this. */
    isIdentityReady: status === 'authenticated' && identityStatus === 'ready',
    login: signInWithGoogle,
    loginWithPassword: signInWithPassword,
    logout,
  };
}
