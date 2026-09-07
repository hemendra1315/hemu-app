/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
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
  buildAttendanceInsights,
  buildMonthlyAttendanceTrend,
  monthBounds,
  recentMonths,
  type AttendanceMark,
} from '../api/attendanceInsights';
import {
  clearAttendance,
  fetchAttendanceMarks,
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

/** Put a player back to unmarked for a session — the undo for a mis-tap. */
export function useClearAttendance(academyId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, playerId }: { sessionId: UUID; playerId: UUID }) =>
      clearAttendance(sessionId, playerId),
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

/**
 * Aggregated attendance for one month: rate per player, rate per batch, and
 * who has been missing lately.
 *
 * The aggregation itself lives in `buildAttendanceInsights`, a pure function,
 * so it can be tested without a database or a rendered page.
 */
export function useAttendanceInsights(
  academyId: UUID | null,
  month: string,
  playerNames: Map<UUID, string>,
  batchNames: Map<UUID, string>,
) {
  const { from, to } = monthBounds(month);
  const marksQuery = useQuery<AttendanceMark[]>({
    queryKey: ['academies', academyId ?? 'none', 'attendance', 'insights', from, to],
    enabled: Boolean(academyId) && isUUID(academyId ?? ''),
    queryFn: () => fetchAttendanceMarks(academyId as UUID, from, to),
  });

  const insights = useMemo(
    () =>
      marksQuery.data
        ? buildAttendanceInsights({ marks: marksQuery.data, playerNames, batchNames, from, to })
        : null,
    [marksQuery.data, playerNames, batchNames, from, to],
  );

  return { ...marksQuery, insights };
}

/**
 * Overall attendance rate per month for the last `monthCount` months, oldest
 * first, for a trend chart. Fetches the whole window in one query rather than
 * one query per month.
 */
export function useAttendanceTrend(academyId: UUID | null, monthCount = 6) {
  const months = useMemo(() => [...recentMonths(monthCount)].reverse(), [monthCount]);
  const from = months[0] ? monthBounds(months[0].value).from : '';
  const to = months[months.length - 1] ? monthBounds(months[months.length - 1]!.value).to : '';

  const marksQuery = useQuery<AttendanceMark[]>({
    queryKey: ['academies', academyId ?? 'none', 'attendance', 'trend', from, to],
    enabled: Boolean(academyId) && isUUID(academyId ?? '') && Boolean(from) && Boolean(to),
    queryFn: () => fetchAttendanceMarks(academyId as UUID, from, to),
  });

  const trend = useMemo(
    () => (marksQuery.data ? buildMonthlyAttendanceTrend(marksQuery.data, months) : null),
    [marksQuery.data, months],
  );

  return { ...marksQuery, trend };
}
