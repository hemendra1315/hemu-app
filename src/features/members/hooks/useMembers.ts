import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { AcademyMember, PendingJoinRequest, UUID } from '@/types';
import type { AppRole, JoinableRole, MemberStatus } from '@/types/enums';

import {
  approveJoinRequest,
  fetchAcademyMember,
  fetchAcademyMembers,
  fetchPendingJoinRequests,
  rejectJoinRequest,
  updateMemberRole,
  updateMemberStatus,
} from '../api/membersApi';

type Filters = { role?: AppRole; status?: MemberStatus };

export function useAcademyMembers(academyId: UUID | null, filters: Filters = {}) {
  return useQuery<AcademyMember[]>({
    queryKey: queryKeys.academy.members(academyId ?? 'none', {
      role: filters.role,
      status: filters.status,
    }),
    enabled: Boolean(academyId),
    queryFn: () => fetchAcademyMembers(academyId as UUID, filters),
  });
}

export function useAcademyMember(memberId: UUID | null) {
  return useQuery<AcademyMember>({
    queryKey: queryKeys.academy.member('none', memberId ?? 'none'),
    enabled: Boolean(memberId) && isUUID(memberId ?? ''),
    queryFn: () => fetchAcademyMember(memberId as UUID),
  });
}

export function usePendingJoinRequests(academyId: UUID | null) {
  return useQuery<PendingJoinRequest[]>({
    queryKey: queryKeys.academy.pendingRequests(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchPendingJoinRequests(academyId as UUID),
  });
}

/** Owner-only writes; RLS rejects the request for anyone else. */
export function useUpdateMember(academyId: UUID) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['academies', academyId, 'members'] });

  const invalidatePendingRequests = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.academy.pendingRequests(academyId) });

  const changeRole = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: UUID; role: JoinableRole }) =>
      updateMemberRole(membershipId, role),
    onSuccess: invalidate,
  });

  const changeStatus = useMutation({
    mutationFn: ({
      membershipId,
      status,
    }: {
      membershipId: UUID;
      status: Extract<MemberStatus, 'active' | 'suspended' | 'left'>;
    }) => updateMemberStatus(membershipId, status),
    onSuccess: invalidate,
  });

  const removeMember = useMutation({
    mutationFn: ({ membershipId }: { membershipId: UUID }) =>
      updateMemberStatus(membershipId, 'left'),
    onSuccess: invalidate,
  });

  const approveRequest = useMutation({
    mutationFn: ({ requestId, batchIds }: { requestId: UUID; batchIds?: UUID[] | null }) =>
      approveJoinRequest(requestId, batchIds),
    onSuccess: () => {
      invalidate();
      invalidatePendingRequests();
    },
  });

  const rejectRequest = useMutation({
    mutationFn: ({ requestId }: { requestId: UUID }) => rejectJoinRequest(requestId),
    onSuccess: () => {
      invalidatePendingRequests();
    },
  });

  return { changeRole, changeStatus, removeMember, approveRequest, rejectRequest };
}
