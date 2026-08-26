import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchMyJoinRequests, fetchMyMemberships } from '@/features/academies/api/academiesApi';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/query/keys';
import { useAcademyStore, useAuthStore } from '@/stores';
import type { JoinRequest, Membership, Profile } from '@/types';

import { ensureMyProfile } from '../api/profileApi';

type Identity = { profile: Profile; memberships: Membership[]; joinRequests: JoinRequest[] };

/**
 * Loads everything routing decisions depend on (profile, memberships, pending
 * requests) in one query, mirrors it into the auth store, and keeps the active
 * academy pointing at a membership the user actually still holds.
 */
export function useIdentity() {
  const user = useAuthStore((state) => state.user);
  const memberships = useAuthStore((state) => state.memberships);
  const setProfile = useAuthStore((state) => state.setProfile);
  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setJoinRequests = useAuthStore((state) => state.setJoinRequests);
  const setIdentityStatus = useAuthStore((state) => state.setIdentityStatus);
  const activeAcademyId = useAcademyStore((state) => state.activeAcademyId);
  const setActiveAcademy = useAcademyStore((state) => state.setActiveAcademy);

  const userId = user?.id;
  const email = user?.email;

  const query = useQuery<Identity>({
    queryKey: queryKeys.identity(userId ?? 'anonymous'),
    /**
     * Enabled for as long as someone is signed in.
     *
     * This used to switch off the moment `identityStatus` reached 'ready',
     * which froze identity for the rest of the session: a join request approved
     * after sign-in, a role changed by an owner, or an academy added could never
     * reach the running app. "Check again" on the pending screen had nothing
     * left to call. Logout safety does not depend on this — `reset()` clears the
     * user, which disables the query through `userId` below.
     */
    enabled: Boolean(userId && email),
    staleTime: 30_000,
    queryFn: async () => {
      // Non-null: the query is disabled until both are present.
      const id = userId as string;
      const metadata = user?.user_metadata ?? {};
      const [profile, memberships, joinRequests] = await Promise.all([
        ensureMyProfile(id, {
          email: email as string,
          fullName:
            (metadata.full_name as string | undefined) ??
            (metadata.name as string | undefined) ??
            null,
          avatarUrl: (metadata.avatar_url as string | undefined) ?? null,
        }),
        fetchMyMemberships(),
        fetchMyJoinRequests(),
      ]);
      return { profile, memberships, joinRequests };
    },
  });

  const { data, isPending, isError, error } = query;

  useEffect(() => {
    if (!userId) return;
    // No early return once 'ready': every successful load, including a refetch
    // triggered by "Check again", must reach the store. Bailing here was the
    // second half of the frozen-identity bug — even when the query did run, the
    // fresh memberships were thrown away.
    //
    // `isPending` is only true when there is no data at all, so a background
    // refetch cannot flash the app back to a loading screen mid-session.
    if (isPending) {
      setIdentityStatus('loading');
      return;
    }
    if (isError) {
      logger.error('identity_load_failed', { error: String(error) });
      setIdentityStatus('error');
      return;
    }
    if (!data) return;

    setProfile(data.profile);
    setMemberships(data.memberships);
    setJoinRequests(data.joinRequests);
    setIdentityStatus('ready');
  }, [
    userId,
    data,
    isPending,
    isError,
    error,
    setProfile,
    setMemberships,
    setJoinRequests,
    setIdentityStatus,
  ]);

  useEffect(() => {
    const profile = useAuthStore.getState().profile;
    const isSuperAdmin = profile?.isSuperAdmin === true;
    if (isSuperAdmin) return;

    const active = memberships.filter((membership) => membership.status === 'active');
    const stillValid = active.some((membership) => membership.academyId === activeAcademyId);

    if (!stillValid && active.length > 0) {
      setActiveAcademy(active.length === 1 ? (active[0]?.academyId ?? null) : null);
    }
  }, [memberships, activeAcademyId, setActiveAcademy]);

  return query;
}
