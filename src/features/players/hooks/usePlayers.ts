/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import type {
  PlayerCareerHighlight,
  PlayerChartData,
  PlayerCoachNote,
  PlayerDrillSummary,
  PlayerMatch,
  PlayerAward,
  PlayerMilestone,
  PlayerProfile,
  PlayerStatistics,
  PlayerAttendanceSummary,
} from '../api/playersTypes';
import {
  fetchPlayerProfile,
  fetchPlayerStatistics,
  fetchPlayerMatches,
  fetchPlayerAwards,
  fetchPlayerMilestones,
  fetchPlayerCoachNotes,
  fetchPlayerAttendanceSummary,
  fetchPlayerDrillSummary,
  fetchPlayerCareerHighlights,
  fetchPlayerChartData,
  updateCricketProfile,
} from '../api/playersApi';

// ============================================================
// PLAYER PROFILE
// ============================================================

export function usePlayerProfile(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerProfile>({
    queryKey: queryKeys.academy.member(academyId ?? 'none', playerId ?? 'none'),
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerProfile(academyId as UUID, playerId as UUID),
  });
}

export function useUpdateCricketProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      academyId,
      playerId,
      data,
    }: {
      academyId: UUID;
      playerId: UUID;
      data: {
        bio?: string | null;
        battingStyle?: string | null;
        bowlingStyle?: string | null;
        playerRole?: string | null;
        jerseyNumber?: number | null;
      };
    }) => updateCricketProfile(academyId, playerId, data),
    onSuccess: (_, { academyId, playerId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.academy.member(academyId, playerId),
      });
    },
  });
}

// ============================================================
// PLAYER STATISTICS
// ============================================================

export function usePlayerStatistics(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerStatistics | null>({
    queryKey: ['player-statistics', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerStatistics(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER MATCHES
// ============================================================

export function usePlayerMatches(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerMatch[]>({
    queryKey: ['player-matches', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerMatches(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER AWARDS
// ============================================================

export function usePlayerAwards(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerAward[]>({
    queryKey: ['player-awards', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerAwards(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER MILESTONES
// ============================================================

export function usePlayerMilestones(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerMilestone[]>({
    queryKey: ['player-milestones', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerMilestones(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER COACH NOTES
// ============================================================

export function usePlayerCoachNotes(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerCoachNote[]>({
    queryKey: ['player-coach-notes', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerCoachNotes(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER ATTENDANCE SUMMARY
// ============================================================

export function usePlayerAttendanceSummary(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerAttendanceSummary>({
    queryKey: ['player-attendance-summary', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerAttendanceSummary(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER DRILL SUMMARY
// ============================================================

export function usePlayerDrillSummary(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerDrillSummary>({
    queryKey: ['player-drill-summary', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerDrillSummary(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER CAREER HIGHLIGHTS
// ============================================================

export function usePlayerCareerHighlights(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerCareerHighlight[]>({
    queryKey: ['player-career-highlights', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerCareerHighlights(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// PLAYER CHART DATA
// ============================================================

export function usePlayerChartData(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerChartData>({
    queryKey: ['player-chart-data', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerChartData(academyId as UUID, playerId as UUID),
  });
}

// ============================================================
// BATCH DATA (for upcoming sessions)
// ============================================================

export function usePlayerUpcomingSessions(playerId: UUID | null, academyId: UUID | null) {
  return useQuery<
    Array<{
      id: UUID;
      title: string;
      sessionDate: string;
      startAt: string;
      endAt: string;
      ground: string | null;
      coachName: string | null;
    }>
  >({
    queryKey: ['player-upcoming-sessions', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('training_sessions')
        .select(
          `
          id, title, session_date, start_at, end_at,
          academy_members!training_sessions_coach_id_fkey!inner(id, profiles!academy_members_user_id_fkey!inner(full_name))
        `,
        )
        .eq('academy_id', academyId)
        .eq('status', 'scheduled')
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        sessionDate: row.session_date,
        startAt: row.start_at,
        endAt: row.end_at,
        ground: null,
        coachName: row.academy_members?.profiles?.full_name ?? null,
      }));
    },
  });
}
