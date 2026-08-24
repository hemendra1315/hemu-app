import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import type {
  CreateDrillAssignmentInput,
  CreateDrillInput,
  Drill,
  DrillAssignment,
  UpdateDrillAssignmentInput,
  UpdateDrillInput,
} from '../api/drillsTypes';
import {
  assignDrill,
  createDrill,
  deleteDrill,
  deleteDrillAssignment,
  fetchDrillAssignments,
  fetchAcademyDrills,
  fetchPlayerDrillAssignments,
  updateDrill,
  updateDrillAssignment,
} from '../api/drillsApi';

export function useDrills(academyId: UUID | null) {
  return useQuery<Drill[]>({
    queryKey: queryKeys.academy.drills(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchAcademyDrills(academyId as UUID),
  });
}

export function useDrillAssignments(academyId: UUID | null) {
  return useQuery<DrillAssignment[]>({
    queryKey: queryKeys.academy.drillAssignments(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchDrillAssignments(academyId as UUID),
  });
}

export function usePlayerDrillAssignments(playerId: UUID | null, academyId: UUID | null) {
  return useQuery<DrillAssignment[]>({
    queryKey: queryKeys.academy.playerDrillAssignments(academyId ?? 'none', playerId ?? 'none'),
    enabled:
      Boolean(playerId) && Boolean(academyId) && isUUID(playerId ?? '') && isUUID(academyId ?? ''),
    queryFn: () => fetchPlayerDrillAssignments(playerId as UUID, academyId as UUID),
  });
}

export function useCreateDrill(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDrillInput) => createDrill(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.drills(academyId) }),
  });
}

export function useUpdateDrill(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ drillId, input }: { drillId: UUID; input: UpdateDrillInput }) =>
      updateDrill(drillId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.drills(academyId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.academy.drill(academyId, variables.drillId),
      });
    },
  });
}

export function useDeleteDrill(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ drillId }: { drillId: UUID }) => deleteDrill(drillId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.drills(academyId) }),
  });
}

export function useAssignDrill(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDrillAssignmentInput) => assignDrill(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.drillAssignments(academyId) });
      if (variables.playerId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.academy.playerDrillAssignments(academyId, variables.playerId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['academies', academyId, 'players'],
        exact: false,
      });
    },
  });
}

export function useUpdateDrillAssignment(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      input,
    }: {
      assignmentId: UUID;
      input: UpdateDrillAssignmentInput;
    }) => updateDrillAssignment(assignmentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.drillAssignments(academyId) });
      queryClient.invalidateQueries({
        queryKey: ['academies', academyId, 'players'],
        exact: false,
      });
    },
  });
}

export function useDeleteDrillAssignment(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: UUID }) => deleteDrillAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.drillAssignments(academyId) });
      queryClient.invalidateQueries({
        queryKey: ['academies', academyId, 'players'],
        exact: false,
      });
    },
  });
}
