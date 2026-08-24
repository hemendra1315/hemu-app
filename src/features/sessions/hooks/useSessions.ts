import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import type {
  CreateTrainingSessionInput,
  TrainingSession,
  UpdateTrainingSessionInput,
} from '../api/sessionsTypes';
import {
  createTrainingSession,
  deleteTrainingSession,
  fetchAcademyTrainingSessions,
  fetchTrainingSession,
  updateTrainingSession,
} from '../api/sessionsApi';

export function useTrainingSessions(academyId: UUID | null) {
  return useQuery<TrainingSession[]>({
    queryKey: queryKeys.academy.sessions(academyId ?? 'none'),
    enabled: Boolean(academyId),
    queryFn: () => fetchAcademyTrainingSessions(academyId as UUID),
  });
}

export function useTrainingSession(sessionId: UUID | null, academyId: UUID | null) {
  return useQuery<TrainingSession>({
    queryKey: queryKeys.academy.session(academyId ?? 'none', sessionId ?? 'none'),
    enabled:
      Boolean(sessionId) &&
      Boolean(academyId) &&
      isUUID(sessionId ?? '') &&
      isUUID(academyId ?? ''),
    queryFn: () => fetchTrainingSession(sessionId as UUID),
  });
}

export function useCreateTrainingSession(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTrainingSessionInput) => createTrainingSession(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.sessions(academyId) }),
  });
}

export function useUpdateTrainingSession(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: UUID; input: UpdateTrainingSessionInput }) =>
      updateTrainingSession(sessionId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.sessions(academyId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.academy.session(academyId, variables.sessionId),
      });
    },
  });
}

export function useDeleteTrainingSession(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId }: { sessionId: UUID }) => deleteTrainingSession(sessionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.sessions(academyId) }),
  });
}
