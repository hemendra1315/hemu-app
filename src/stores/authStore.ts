import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { JoinRequest, Membership, Profile } from '@/types';

/**
 * Auth *state container only* — no fetching happens here. AuthProvider pushes
 * Supabase session changes in and useIdentity pushes the profile, memberships
 * and pending join requests in once they are loaded.
 *
 * `identityStatus` is separate from `status` because a signed-in user whose
 * memberships are still loading must not be routed as "has no academy".
 */
type AuthState = {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  identityStatus: 'idle' | 'loading' | 'ready' | 'error';
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  memberships: Membership[];
  joinRequests: JoinRequest[];
  /**
   * Guards the `onAuthStateChange` listener during logout so a delayed
   * SIGNED_IN event (e.g. from a token-refresh race) cannot resurrect
   * an authenticated state after the user has already signed out.
   */
  signingOut: boolean;
  setSession: (session: Session | null) => void;
  setIdentityStatus: (identityStatus: AuthState['identityStatus']) => void;
  setProfile: (profile: Profile | null) => void;
  setMemberships: (memberships: Membership[]) => void;
  setJoinRequests: (joinRequests: JoinRequest[]) => void;
  setSigningOut: (signingOut: boolean) => void;
  reset: () => void;
};

const signedOutState = {
  status: 'unauthenticated',
  identityStatus: 'idle',
  session: null,
  user: null,
  profile: null,
  memberships: [],
  joinRequests: [],
  signingOut: false,
} satisfies Partial<AuthState>;

const getInitialState = (): Partial<AuthState> => {
  if (typeof window !== 'undefined') {
    const storedAuth = sessionStorage.getItem('cam.e2e_auth');
    if (storedAuth) {
      try {
        const { user, profile, memberships, joinRequests = [] } = JSON.parse(storedAuth);
        const mockSession = user
          ? ({
              user,
              access_token: 'e2e-token',
              refresh_token: 'e2e-refresh',
              expires_in: 3600,
              token_type: 'bearer',
            } as unknown as Session)
          : null;
        return {
          status: mockSession ? 'authenticated' : 'unauthenticated',
          identityStatus: 'ready',
          session: mockSession,
          user: mockSession?.user ?? null,
          profile: (profile as Profile) ?? null,
          memberships: (memberships as Membership[]) ?? [],
          joinRequests: (joinRequests as JoinRequest[]) ?? [],
        };
      } catch {
        // ignore
      }
    }
  }
  return {
    ...signedOutState,
    status: 'loading',
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...signedOutState,
  status: 'loading',
  ...getInitialState(),
  setSession: (session) =>
    set((state) => ({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
      // Dropping the session invalidates everything derived from it.
      ...(session
        ? null
        : { identityStatus: 'idle', profile: null, memberships: [], joinRequests: [] }),
      ...(session && session.user.id !== state.user?.id
        ? { identityStatus: 'loading', profile: null, memberships: [], joinRequests: [] }
        : null),
    })),
  setIdentityStatus: (identityStatus) => set({ identityStatus }),
  setProfile: (profile) => set({ profile }),
  setMemberships: (memberships) => set({ memberships }),
  setJoinRequests: (joinRequests) => set({ joinRequests }),
  setSigningOut: (signingOut) => set({ signingOut }),
  reset: () => set(signedOutState),
}));

/** Active (approved) memberships only — pending ones grant no access. */
export function selectActiveMemberships(state: AuthState): Membership[] {
  return state.memberships.filter((membership) => membership.status === 'active');
}
