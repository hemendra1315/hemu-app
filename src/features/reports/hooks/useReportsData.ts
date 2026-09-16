import { useQuery } from '@tanstack/react-query';
import type { UUID } from '@/types';
import {
  fetchMonthlyAttendanceReportData,
  fetchPlayerPerformanceReportData,
  fetchBatchScheduleReportData,
} from '../api/reportsApi';

export const reportKeys = {
  all: ['reports'] as const,
  monthlyAttendance: (academyId: UUID, batchId: UUID, year: number, month: number) =>
    [...reportKeys.all, 'attendance', academyId, batchId, year, month] as const,
  playerPerformance: (academyId: UUID, playerId: UUID, start?: string, end?: string) =>
    [...reportKeys.all, 'player-performance', academyId, playerId, start, end] as const,
  batchSchedule: (academyId: UUID) => [...reportKeys.all, 'batch-schedule', academyId] as const,
};

export function useMonthlyAttendanceReport(
  academyId: UUID | null | undefined,
  batchId: UUID | null | undefined,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: reportKeys.monthlyAttendance(
      academyId ?? ('' as UUID),
      batchId ?? ('' as UUID),
      year,
      month,
    ),
    queryFn: () => fetchMonthlyAttendanceReportData(academyId!, batchId!, year, month),
    enabled: Boolean(academyId && batchId),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlayerPerformanceReport(
  academyId: UUID | null | undefined,
  playerId: UUID | null | undefined,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: reportKeys.playerPerformance(
      academyId ?? ('' as UUID),
      playerId ?? ('' as UUID),
      startDate,
      endDate,
    ),
    queryFn: () => fetchPlayerPerformanceReportData(academyId!, playerId!, startDate, endDate),
    enabled: Boolean(academyId && playerId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBatchScheduleReport(academyId: UUID | null | undefined) {
  return useQuery({
    queryKey: reportKeys.batchSchedule(academyId ?? ('' as UUID)),
    queryFn: () => fetchBatchScheduleReportData(academyId!),
    enabled: Boolean(academyId),
    staleTime: 5 * 60 * 1000,
  });
}
