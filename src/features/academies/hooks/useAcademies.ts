import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { queryKeys } from '@/lib/query/keys';
import { useAcademyStore, useAuthStore } from '@/stores';
import type { Academy, Membership, UUID } from '@/types';
import type { JoinableRole } from '@/types/enums';

import {
  createAcademy,
  fetchAcademy,
  fetchActiveJoinCode,
  regenerateJoinCode,
  requestJoinByCode,
  updateAcademy,
  type CreateAcademyInput,
  type UpdateAcademyInput,
} from '../api/academiesApi';

/** Memberships split by status, plus the currently selected one. */
export function useMemberships() {
  const memberships = useAuthStore((state) => state.memberships);
  const joinRequests = useAuthStore((state) => state.joinRequests);
  const identityStatus = useAuthStore((state) => state.identityStatus);
  const activeAcademyId = useAcademyStore((state) => state.activeAcademyId);

  return useMemo(() => {
    const active = memberships.filter((membership) => membership.status === 'active');
    const pending = memberships.filter((membership) => membership.status === 'pending');
    const pendingRequests = joinRequests.filter((request) => request.status === 'pending');
    return {
      isLoading: identityStatus === 'loading' || identityStatus === 'idle',
      isError: identityStatus === 'error',
      all: memberships,
      active,
      pending,
      pendingRequests,
      hasAnyAcademy: active.length > 0,
      isAwaitingApproval: active.length === 0 && (pending.length > 0 || pendingRequests.length > 0),
      current: activeAcademyId
        ? (active.find((membership) => membership.academyId === activeAcademyId) ?? null)
        : (active[0] ?? null),
    };
  }, [memberships, joinRequests, identityStatus, activeAcademyId]);
}

/** The active academy's membership plus a switcher. */
export function useActiveAcademy(): {
  academyId: UUID | null;
  membership: Membership | null;
  switchAcademy: (academyId: UUID) => void;
} {
  const { current } = useMemberships();
  const activeAcademyId = useAcademyStore((state) => state.activeAcademyId);
  const setActiveAcademy = useAcademyStore((state) => state.setActiveAcademy);
  const profile = useAuthStore((state) => state.profile);
  const isSuperAdmin = profile?.isSuperAdmin === true;
  const queryClient = useQueryClient();

  const academyQuery = useAcademy(isSuperAdmin && !current ? activeAcademyId : null);

  const switchAcademy = useCallback(
    (academyId: UUID) => {
      if (academyId === activeAcademyId) return;
      setActiveAcademy(academyId);
      // Keys are academy-scoped, but dropping the old tenant's cache keeps
      // memory bounded and guarantees a fresh read after switching.
      void queryClient.invalidateQueries({ queryKey: queryKeys.academy.all });
    },
    [activeAcademyId, setActiveAcademy, queryClient],
  );

  const effectiveMembership = useMemo(() => {
    if (current) return current;
    if (isSuperAdmin && activeAcademyId) {
      const validMembershipId = profile?.id ?? activeAcademyId;
      return {
        id: validMembershipId,
        userId: profile?.id ?? '',
        academyId: activeAcademyId,
        role: 'academy_owner' as const,
        status: 'active' as const,
        joinedAt: academyQuery.data?.createdAt ?? new Date().toISOString(),
        academyName: academyQuery.data?.name ?? 'Academy',
        academySlug: academyQuery.data?.slug ?? '',
        slug: academyQuery.data?.slug ?? '',
        logoUrl: academyQuery.data?.logoUrl ?? null,
        city: academyQuery.data?.city ?? null,
        timezone: 'UTC',
      };
    }
    return null;
  }, [current, isSuperAdmin, activeAcademyId, academyQuery.data, profile]);

  return {
    academyId: activeAcademyId ?? current?.academyId ?? null,
    membership: effectiveMembership,
    switchAcademy,
  };
}

export function useAcademy(academyId: UUID | null) {
  return useQuery<Academy>({
    queryKey: queryKeys.academy.detail(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchAcademy(academyId as UUID),
  });
}

function useInvalidateIdentity() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.identity(userId ?? 'anonymous') }),
    [queryClient, userId],
  );
}

export function useCreateAcademy() {
  const invalidateIdentity = useInvalidateIdentity();
  const setActiveAcademy = useAcademyStore((state) => state.setActiveAcademy);

  return useMutation({
    mutationFn: (input: CreateAcademyInput) => createAcademy(input),
    onSuccess: async (academy) => {
      setActiveAcademy(academy.id);
      await invalidateIdentity();
    },
  });
}

export function useJoinAcademy() {
  const invalidateIdentity = useInvalidateIdentity();

  return useMutation({
    mutationFn: ({ code, message }: { code: string; message?: string }) =>
      requestJoinByCode(code, message),
    onSuccess: async () => {
      await invalidateIdentity();
    },
  });
}

export function useUpdateAcademy(academyId: UUID) {
  const queryClient = useQueryClient();
  const invalidateIdentity = useInvalidateIdentity();

  return useMutation({
    mutationFn: (input: UpdateAcademyInput) => updateAcademy(academyId, input),
    onSuccess: async (academy) => {
      queryClient.setQueryData(queryKeys.academy.detail(academyId), academy);
      await queryClient.invalidateQueries({ queryKey: queryKeys.academy.all });
      await queryClient.invalidateQueries({ queryKey: ['admin-platform-academies'] });
      await invalidateIdentity();
    },
  });
}

export function useJoinCode(academyId: UUID | null, role: JoinableRole = 'player') {
  return useQuery<string | null>({
    queryKey: queryKeys.academy.joinCode(academyId ?? 'none', role),
    enabled: Boolean(academyId),
    queryFn: () => fetchActiveJoinCode(academyId as UUID, role),
  });
}

export function useRegenerateJoinCode(academyId: UUID, role: JoinableRole = 'player') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => regenerateJoinCode(academyId, role),
    onSuccess: (code) => {
      queryClient.setQueryData(queryKeys.academy.joinCode(academyId, role), code);
    },
  });
}
