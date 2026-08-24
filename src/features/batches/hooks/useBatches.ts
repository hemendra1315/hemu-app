import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { AcademyMember, Batch, BatchPlayer, UUID } from '@/types';
import type { CreateBatchInput, UpdateBatchInput } from '../api/batchesTypes';

import {
  addPlayerToBatch,
  createBatch,
  deleteBatch,
  fetchAcademyBatches,
  fetchBatchAvailablePlayers,
  fetchBatchPlayers,
  removePlayerFromBatch,
  updateBatch,
} from '../api/batchesApi';

export function useBatches(academyId: UUID | null) {
  return useQuery<Batch[]>({
    queryKey: queryKeys.academy.batches(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchAcademyBatches(academyId as UUID),
  });
}

export function useBatchPlayers(batchId: UUID | null, academyId: UUID | null) {
  return useQuery<BatchPlayer[]>({
    queryKey: queryKeys.academy.batchPlayers(academyId ?? 'none', batchId ?? 'none'),
    enabled:
      Boolean(batchId) && Boolean(academyId) && isUUID(batchId ?? '') && isUUID(academyId ?? ''),
    queryFn: () => fetchBatchPlayers(batchId as UUID),
  });
}

export function useBatchAvailablePlayers(academyId: UUID | null) {
  return useQuery<AcademyMember[]>({
    queryKey: queryKeys.academy.batchAvailablePlayers(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchBatchAvailablePlayers(academyId as UUID),
  });
}

export function useCreateBatch(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) => createBatch(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.batches(academyId) }),
  });
}

export function useUpdateBatch(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, input }: { batchId: UUID; input: UpdateBatchInput }) =>
      updateBatch(batchId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.batches(academyId) }),
  });
}

export function useDeleteBatch(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId }: { batchId: UUID }) => deleteBatch(batchId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.batches(academyId) }),
  });
}

export function useBatchMemberships(batchId: UUID, academyId: UUID) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.academy.batchPlayers(academyId, batchId) });

  const addPlayer = useMutation({
    mutationFn: ({ academyMemberId }: { academyMemberId: UUID }) =>
      addPlayerToBatch(batchId, academyMemberId),
    onSuccess: invalidate,
  });

  const removePlayer = useMutation({
    mutationFn: ({ batchMemberId }: { batchMemberId: UUID }) =>
      removePlayerFromBatch(batchMemberId),
    onSuccess: invalidate,
  });

  return { addPlayer, removePlayer };
}
