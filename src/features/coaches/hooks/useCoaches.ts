import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import {
  addAssistantCoach,
  fetchBatchCoaches,
  fetchCoach,
  fetchCoaches,
  fetchMyCoachId,
  removeCoachFromBatch,
  setHeadCoach,
  updateCoachProfile,
} from '../api/coachesApi';
import type {
  BatchCoachRow,
  Coach,
  CoachWithBatches,
  UpdateCoachProfileInput,
} from '../api/coachesTypes';

export function useCoaches(academyId: UUID | null) {
  return useQuery<Coach[]>({
    queryKey: queryKeys.coaches(academyId ?? 'none'),
    enabled: Boolean(academyId) && isUUID(academyId ?? ''),
    queryFn: () => fetchCoaches(academyId as UUID),
  });
}

export function useCoach(academyId: UUID | null, coachId: UUID | null) {
  return useQuery<CoachWithBatches>({
    queryKey: ['academies', academyId ?? 'none', 'coaches', coachId ?? 'none'],
    enabled:
      Boolean(academyId) && Boolean(coachId) && isUUID(academyId ?? '') && isUUID(coachId ?? ''),
    queryFn: () => fetchCoach(academyId as UUID, coachId as UUID),
  });
}

/** Resolves the signed-in user's own `coaches.id` in this academy, if they have one. */
export function useMyCoachId(academyId: UUID | null, userId: UUID | null) {
  return useQuery<UUID | null>({
    queryKey: ['academies', academyId ?? 'none', 'coaches', 'me', userId ?? 'none'],
    enabled: Boolean(academyId) && Boolean(userId) && isUUID(academyId ?? ''),
    queryFn: () => fetchMyCoachId(academyId as UUID, userId as UUID),
  });
}

export function useBatchCoaches(batchId: UUID | null) {
  return useQuery<BatchCoachRow[]>({
    queryKey: ['batches', batchId ?? 'none', 'coaches'],
    enabled: Boolean(batchId) && isUUID(batchId ?? ''),
    queryFn: () => fetchBatchCoaches(batchId as UUID),
  });
}

export function useUpdateCoachProfile(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, input }: { coachId: UUID; input: UpdateCoachProfileInput }) =>
      updateCoachProfile(academyId, coachId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coaches(academyId) });
      void queryClient.invalidateQueries({ queryKey: ['academies', academyId, 'coaches'] });
    },
  });
}

/** Owner-only assignment actions on a batch's coaches. All three keep the
 * batch's own cache (`useBatches`) in sync too, since a head-coach change
 * also updates `batches.coach_id`. */
export function useBatchCoachAssignments(academyId: UUID, batchId: UUID) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['batches', batchId, 'coaches'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.academy.batches(academyId) });
  };

  const setPrimary = useMutation({
    mutationFn: (coach: { coachId: UUID; academyMemberId: UUID | null }) =>
      setHeadCoach(batchId, coach),
    onSuccess: invalidate,
  });

  const addAssistant = useMutation({
    mutationFn: (coachId: UUID) => addAssistantCoach(batchId, coachId),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: ({ coachId, wasHeadCoach }: { coachId: UUID; wasHeadCoach: boolean }) =>
      removeCoachFromBatch(batchId, coachId, wasHeadCoach),
    onSuccess: invalidate,
  });

  return { setPrimary, addAssistant, remove };
}
