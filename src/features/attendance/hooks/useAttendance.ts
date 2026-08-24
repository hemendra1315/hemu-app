/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import type {
  AttendanceRecord,
  BatchAttendanceSession,
  PlayerAttendanceRecord,
} from '../api/attendanceTypes';
import {
  fetchBatchAttendance,
  fetchPlayerAttendance,
  fetchSessionAttendance,
  markAllPresent,
  markAttendance,
} from '../api/attendanceApi';

export function useSessionAttendance(sessionId: UUID | null, academyId: UUID | null) {
  return useQuery<AttendanceRecord[]>({
    queryKey: queryKeys.academy.sessionAttendance(academyId ?? 'none', sessionId ?? 'none'),
    enabled:
      Boolean(sessionId) &&
      Boolean(academyId) &&
      isUUID(sessionId ?? '') &&
      isUUID(academyId ?? ''),
    queryFn: () => fetchSessionAttendance(sessionId as UUID),
  });
}

export function useMarkAttendance(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      playerId,
      status,
    }: {
      sessionId: UUID;
      playerId: UUID;
      status: string;
    }) => markAttendance(sessionId, playerId, status as any, academyId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.academy.sessionAttendance(academyId, variables.sessionId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.academy.playerAttendance(academyId, variables.playerId),
      });
    },
  });
}

export function useMarkAllPresent(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, playerIds }: { sessionId: UUID; playerIds: UUID[] }) =>
      markAllPresent(sessionId, playerIds, academyId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.academy.sessionAttendance(academyId, variables.sessionId),
      });
    },
  });
}

export function usePlayerAttendance(playerId: UUID | null, academyId: UUID | null) {
  return useQuery<PlayerAttendanceRecord[]>({
    queryKey: queryKeys.academy.playerAttendance(academyId ?? 'none', playerId ?? 'none'),
    enabled:
      Boolean(playerId) && Boolean(academyId) && isUUID(playerId ?? '') && isUUID(academyId ?? ''),
    queryFn: () => fetchPlayerAttendance(playerId as UUID),
  });
}

export function useBatchAttendance(batchId: UUID | null, academyId: UUID | null) {
  return useQuery<BatchAttendanceSession[]>({
    queryKey: queryKeys.academy.batchAttendance(academyId ?? 'none', batchId ?? 'none'),
    enabled:
      Boolean(batchId) && Boolean(academyId) && isUUID(batchId ?? '') && isUUID(academyId ?? ''),
    queryFn: () => fetchBatchAttendance(batchId as UUID),
  });
}
