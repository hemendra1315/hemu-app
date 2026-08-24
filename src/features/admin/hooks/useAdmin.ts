import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import type { UUID } from '@/types';
import {
  fetchPlatformAnalytics,
  fetchPlatformAcademies,
  fetchPlatformUsers,
  fetchPlatformAcademyDetails,
  createPlatformAcademy,
  deletePlatformAcademy,
  regenerateOwnerInvitation,
  revokeOwnerInvitation,
  superAdminAddMember,
  superAdminSeedAcademyDemoData,
  type CreatePlatformAcademyPayload,
  type SuperAdminAddMemberPayload,
} from '../api/adminApi';

export function usePlatformAnalytics() {
  return useQuery({
    queryKey: ['admin-platform-analytics'],
    queryFn: fetchPlatformAnalytics,
  });
}

export function usePlatformAcademies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin-platform-academies'],
    queryFn: fetchPlatformAcademies,
    enabled: options?.enabled ?? true,
  });
}

export function usePlatformUsers() {
  return useQuery({
    queryKey: ['admin-platform-users'],
    queryFn: fetchPlatformUsers,
  });
}

export function usePlatformAcademyDetails(academyId: UUID | null) {
  return useQuery({
    queryKey: ['admin-platform-academy-details', academyId],
    queryFn: () =>
      academyId
        ? fetchPlatformAcademyDetails(academyId)
        : Promise.reject(new Error('No academy ID')),
    enabled: Boolean(academyId),
  });
}

export function useCreatePlatformAcademy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePlatformAcademyPayload) => createPlatformAcademy(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-academies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-users'] });
      void queryClient.invalidateQueries({ queryKey: ['academies-mine'] });
    },
  });
}

export function useDeletePlatformAcademy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (academyId: UUID) => deletePlatformAcademy(academyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-academies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-users'] });
      void queryClient.invalidateQueries({ queryKey: ['academies-mine'] });
    },
  });
}

/**
 * Invalidate academy-scoped + platform queries after a Super Admin writes to
 * an academy (add member/coach, seed demo data) so lists/dashboards refresh.
 *
 * We keep the legacy literal keys alongside the real app keys: academy-scoped
 * queries actually live under the `['academies', ...]` prefix (queryKeys.academy.*),
 * and dashboard analytics under `['dashboard-*']`, so those are what make the UI
 * refresh. The literal keys are retained for parity/safety.
 */
function invalidateAcademyQueries(queryClient: QueryClient, academyId: UUID | null) {
  void queryClient.invalidateQueries({ queryKey: ['academy-members'] });
  void queryClient.invalidateQueries({ queryKey: ['members'] });
  void queryClient.invalidateQueries({ queryKey: ['batches'] });
  void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  void queryClient.invalidateQueries({ queryKey: ['matches'] });
  void queryClient.invalidateQueries({ queryKey: ['attendance'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });

  // Real app keys (prefix matches every academy-scoped query + analytics per academy).
  if (academyId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.academy.detail(academyId) });
  } else {
    void queryClient.invalidateQueries({ queryKey: queryKeys.academy.all });
  }
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });

  void queryClient.invalidateQueries({ queryKey: ['admin-platform-academies'] });
  void queryClient.invalidateQueries({ queryKey: ['admin-platform-analytics'] });
}

export function useSuperAdminAddMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SuperAdminAddMemberPayload) => superAdminAddMember(payload),
    onSuccess: (_data, variables) => {
      invalidateAcademyQueries(queryClient, variables.academyId);
    },
  });
}

export function useSuperAdminSeedDemoData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (academyId: UUID) => superAdminSeedAcademyDemoData(academyId),
    onSuccess: (_data, academyId) => {
      invalidateAcademyQueries(queryClient, academyId);
    },
  });
}

export function useRegenerateOwnerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (academyId: UUID) => regenerateOwnerInvitation(academyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-academies'] });
    },
  });
}

export function useRevokeOwnerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: UUID) => revokeOwnerInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-academies'] });
    },
  });
}
